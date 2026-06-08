/**
 * 选品引擎主接口 - 第八阶段
 * POST /api/selection/run
 * 参数: shopId, categoryId(可选), strategy(可选)
 * 返回: taskId 和结果（同步执行）
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  batchScore,
  sortAndDeduplicate,
  getStrategyWeights,
  createDegradationContext,
  fetchWithDegradation,
  SelectionStrategy,
} from '@/lib/selection-engine';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, and } from 'drizzle-orm';

const { opportunities, shops } = schema;

// 内存任务存储（用于短期轮询）
const taskResults = new Map<string, {
  status: 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: number;
}>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shopId, categoryId, strategy = 'follow_default' } = body;
    
    if (!shopId) {
      return NextResponse.json(
        { success: false, error: '缺少shopId参数' },
        { status: 400 }
      );
    }
    
    // 生成任务ID
    const taskId = `sel_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    // 初始化任务状态
    taskResults.set(taskId, { status: 'running', createdAt: Date.now() });
    
    // 同步执行选品任务
    const result = await executeSelectionTask(shopId, categoryId, strategy as SelectionStrategy);
    
    // 更新任务状态
    taskResults.set(taskId, { 
      status: 'completed', 
      result, 
      createdAt: Date.now() 
    });
    
    // 清理过期任务（保留最近100个）
    if (taskResults.size > 100) {
      const entries = Array.from(taskResults.entries());
      entries.slice(0, 50).forEach(([key]) => taskResults.delete(key));
    }
    
    // 返回完整结果（前端可选择轮询或直接使用结果）
    return NextResponse.json({
      success: true,
      taskId,
      status: 'completed',
      message: '选品任务执行完成',
      pollUrl: `/api/selection/run/${taskId}`,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '执行失败' },
      { status: 500 }
    );
  }
}

/**
 * 执行选品任务
 */
async function executeSelectionTask(
  shopId: string,
  categoryId?: number,
  strategy: SelectionStrategy = 'follow_default'
): Promise<{
  shop: { found: boolean; name?: string };
  opportunities: { total: number };
  dataSources: Array<{ name: string; status: string; count?: number }>;
  scoring: { processed: number; successful: number; failed: number };
  dedup: { original: number; kept: number; removed: number };
  warnings: string[];
  completedLayers: number[];
}> {
  const warnings: string[] = [];
  const dataSources: Array<{ name: string; status: string; count?: number }> = [];
  const completedLayers: number[] = [];
  
  // ========== 第0层：店铺信息获取 ==========
  let shopName: string | undefined;
  try {
    const shop = await db
      .select()
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1);
    
    if (shop[0]) {
      shopName = shop[0].name;
      dataSources.push({ name: 'shop', status: 'success' });
      completedLayers.push(0);
    } else {
      warnings.push('店铺信息获取失败，使用默认配置');
      dataSources.push({ name: 'shop', status: 'failed' });
    }
  } catch (err) {
    warnings.push('店铺查询失败，使用默认配置');
    dataSources.push({ name: 'shop', status: 'failed' });
  }
  
  // ========== 第1层：候选品获取 ==========
  let opportunityList: typeof opportunities.$inferSelect[] = [];
  try {
    const conditions = [eq(opportunities.shopId, shopId)];
    if (categoryId) {
      conditions.push(eq(opportunities.targetCategoryId, categoryId));
    }
    
    opportunityList = await db
      .select()
      .from(opportunities)
      .where(and(...conditions));
    
    dataSources.push({ name: 'opportunities', status: 'success', count: opportunityList.length });
    completedLayers.push(1);
  } catch (err) {
    warnings.push('候选品获取失败');
    dataSources.push({ name: 'opportunities', status: 'failed' });
  }
  
  // ========== 第2层：数据源获取（带降级） ==========
  const degradationCtx = createDegradationContext();
  
  // Ozon数据源
  const ozonResult = await fetchWithDegradation(
    'ozon',
    async () => ({ products: [], count: 0 }),
    degradationCtx
  );
  dataSources.push({ name: 'ozon', status: ozonResult.success ? 'success' : 'failed' });
  
  // 速卖通数据源
  const aliexpressResult = await fetchWithDegradation(
    'aliexpress',
    async () => ({ products: [], count: 0 }),
    degradationCtx
  );
  dataSources.push({ name: 'aliexpress', status: aliexpressResult.success ? 'success' : 'failed' });
  
  // 1688数据源
  const alibabaResult = await fetchWithDegradation(
    'alibaba1688',
    async () => ({ products: [], count: 0 }),
    degradationCtx
  );
  dataSources.push({ name: 'alibaba1688', status: alibabaResult.success ? 'success' : 'failed' });
  
  // 记录数据充分性警告
  if (degradationCtx.warningFlags.length > 0) {
    warnings.push(...degradationCtx.warningFlags);
  }
  completedLayers.push(2);
  
  // ========== 第3层：批量评分 ==========
  let scoringResult = { processed: 0, results: [] as unknown[], errors: [] as unknown[] };
  try {
    if (opportunityList.length > 0) {
      const weights = getStrategyWeights(strategy);
      scoringResult = await batchScore({
        shopId,
        categoryId: categoryId,
        weights,
      });
      completedLayers.push(3);
      
      if (degradationCtx.discountFactor < 1) {
        warnings.push(`评分已应用降级折扣: ${(degradationCtx.discountFactor * 100).toFixed(0)}%`);
      }
    } else {
      completedLayers.push(3);
    }
  } catch (err) {
    warnings.push('批量评分执行失败');
  }
  
  // ========== 第4层：排序和去重 ==========
  let dedupResult = { sorted: [] as unknown[], dedupStats: { original: 0, kept: 0, removed: 0 } };
  try {
    if (opportunityList.length > 0) {
      dedupResult = await sortAndDeduplicate(shopId, strategy);
      completedLayers.push(4);
    } else {
      completedLayers.push(4);
    }
  } catch (err) {
    warnings.push('排序去重执行失败');
  }
  
  return {
    shop: { found: !!shopName, name: shopName },
    opportunities: { total: opportunityList.length },
    dataSources,
    scoring: {
      processed: scoringResult.processed,
      successful: scoringResult.results.length,
      failed: scoringResult.errors.length,
    },
    dedup: dedupResult.dedupStats,
    warnings,
    completedLayers,
  };
}
