/**
 * 选品引擎主接口 - 第八阶段
 * POST /api/selection/run
 * 参数: shopId, categoryId(可选), strategy(可选)
 * 返回: taskId (前端轮询查询进度)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createTask,
  startTask,
  updateProgress,
  markDataSource,
  addWarning,
  markLayerCompleted,
  completeTask,
  failTask,
} from '@/lib/selection-task-manager';
import {
  batchScore,
  sortAndDeduplicate,
  getStrategyWeights,
  createDegradationContext,
  fetchWithDegradation,
  applyDegradationDiscount,
  executeLayer,
  getCompletedLayersSummary,
  SelectionStrategy,
  LayerExecutionContext,
} from '@/lib/selection-engine';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, and } from 'drizzle-orm';

const { opportunities, shops } = schema;

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
    
    // 1. 创建任务
    const task = createTask(shopId, categoryId, strategy as SelectionStrategy);
    
    // 2. 异步执行选品流程（不阻塞响应）
    runSelectionTask(task.id, shopId, categoryId, strategy as SelectionStrategy);
    
    // 3. 立即返回taskId
    return NextResponse.json({
      success: true,
      taskId: task.id,
      message: '选品任务已创建，请轮询查询进度',
      pollUrl: `/api/selection/run/${task.id}`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '创建任务失败' },
      { status: 500 }
    );
  }
}

/**
 * 异步执行选品任务
 */
async function runSelectionTask(
  taskId: string,
  shopId: string,
  categoryId?: number,
  strategy: SelectionStrategy = 'follow_default'
): Promise<void> {
  // 分层执行上下文
  const layerContext: LayerExecutionContext = {
    taskId,
    completedLayers: [],
    currentLayer: 0,
  };
  
  // 降级上下文
  const degradationCtx = createDegradationContext();
  
  try {
    // 标记任务开始
    startTask(taskId);
    
    // ========== 第0层：店铺信息获取 ==========
    updateProgress(taskId, 0, 5, '获取店铺信息');
    
    const shopResult = await executeLayer(
      0,
      '店铺信息获取',
      async () => {
        const shop = await db
          .select()
          .from(shops)
          .where(eq(shops.id, shopId))
          .limit(1);
        return shop[0] || null;
      },
      layerContext
    );
    
    if (!shopResult.success || !shopResult.data) {
      addWarning(taskId, '店铺信息获取失败，使用默认配置');
      markDataSource(taskId, 'shop', 'failed', '店铺不存在');
    } else {
      markDataSource(taskId, 'shop', 'success', undefined, 1);
      markLayerCompleted(taskId, 0);
    }
    
    // ========== 第1层：候选品获取 ==========
    updateProgress(taskId, 1, 5, '获取候选品列表');
    
    const opportunitiesResult = await executeLayer(
      1,
      '候选品获取',
      async () => {
        // 构建查询条件
        const conditions = [eq(opportunities.shopId, shopId)];
        if (categoryId) {
          conditions.push(eq(opportunities.targetCategoryId, categoryId));
        }
        
        const items = await db
          .select()
          .from(opportunities)
          .where(and(...conditions));
        return items;
      },
      layerContext
    );
    
    let opportunityList: typeof opportunities.$inferSelect[] = [];
    if (opportunitiesResult.success && opportunitiesResult.data) {
      opportunityList = opportunitiesResult.data;
      markDataSource(taskId, 'opportunities', 'success', undefined, opportunityList.length);
      markLayerCompleted(taskId, 1);
    } else {
      markDataSource(taskId, 'opportunities', 'failed', opportunitiesResult.error);
      // 即使候选品获取失败，也继续执行（返回空结果）
    }
    
    // ========== 第2层：数据源获取（带降级） ==========
    updateProgress(taskId, 2, 5, '获取外部数据源');
    
    // Ozon数据源
    const ozonResult = await fetchWithDegradation(
      'ozon',
      async () => {
        // TODO: 实际调用Ozon API
        // 模拟数据
        return { products: [], count: 0 };
      },
      degradationCtx
    );
    markDataSource(taskId, 'ozon', ozonResult.success ? 'success' : 'failed', ozonResult.error);
    
    // 速卖通数据源
    const aliexpressResult = await fetchWithDegradation(
      'aliexpress',
      async () => {
        // TODO: 实际调用速卖通API
        return { products: [], count: 0 };
      },
      degradationCtx
    );
    markDataSource(taskId, 'aliexpress', aliexpressResult.success ? 'success' : 'failed', aliexpressResult.error);
    
    // 1688数据源
    const alibabaResult = await fetchWithDegradation(
      'alibaba1688',
      async () => {
        // TODO: 实际调用1688 API
        return { products: [], count: 0 };
      },
      degradationCtx
    );
    markDataSource(taskId, 'alibaba1688', alibabaResult.success ? 'success' : 'failed', alibabaResult.error);
    
    // 记录数据充分性警告
    if (degradationCtx.warningFlags.length > 0) {
      for (const warning of degradationCtx.warningFlags) {
        addWarning(taskId, warning);
      }
    }
    
    markLayerCompleted(taskId, 2);
    
    // ========== 第3层：批量评分 ==========
    updateProgress(taskId, 3, 5, '计算候选品评分');
    
    const scoringResult = await executeLayer(
      3,
      '批量评分',
      async () => {
        if (opportunityList.length === 0) {
          return { processed: 0, results: [], errors: [] };
        }
        
        // 获取策略权重
        const weights = getStrategyWeights(strategy);
        
        // 调用批量评分
        return await batchScore({
          shopId,
          categoryId: categoryId,
          weights,
        });
      },
      layerContext
    );
    
    let processedCount = 0;
    let successfulCount = 0;
    let failedCount = 0;
    
    if (scoringResult.success && scoringResult.data) {
      processedCount = scoringResult.data.processed || 0;
      successfulCount = scoringResult.data.results?.length || 0;
      failedCount = scoringResult.data.errors?.length || 0;
      markLayerCompleted(taskId, 3);
      
      // 应用数据降级折扣
      if (degradationCtx.discountFactor < 1) {
        addWarning(taskId, `评分已应用降级折扣: ${(degradationCtx.discountFactor * 100).toFixed(0)}%`);
      }
    }
    
    // ========== 第4层：排序和去重 ==========
    updateProgress(taskId, 4, 5, '执行排序和去重');
    
    const sortResult = await executeLayer(
      4,
      '排序去重',
      async () => {
        return await sortAndDeduplicate(shopId, strategy);
      },
      layerContext
    );
    
    let topCandidates: Array<{ id: number; score: number; grade: string; name?: string }> = [];
    let dedupStats = { original: 0, kept: 0, removed: 0 };
    
    if (sortResult.success && sortResult.data) {
      topCandidates = sortResult.data.sorted.slice(0, 20).map(r => ({
        id: r.opportunityId,
        score: r.finalScore,
        grade: r.compositeScore >= 80 ? 'A' : r.compositeScore >= 60 ? 'B' : r.compositeScore >= 40 ? 'C' : 'D',
      }));
      dedupStats = sortResult.data.dedupStats;
      markLayerCompleted(taskId, 4);
    }
    
    // ========== 完成 ==========
    updateProgress(taskId, 5, 5, '完成');
    
    completeTask(taskId, {
      processed: processedCount,
      successful: successfulCount,
      failed: failedCount,
      topCandidates,
      dedupStats,
    });
    
  } catch (error) {
    // 异常时返回已完成层结果
    const { completed, failed, lastSuccessfulLayer } = getCompletedLayersSummary(layerContext);
    
    addWarning(taskId, `处理异常: ${error instanceof Error ? error.message : '未知错误'}`);
    addWarning(taskId, `已完成${completed.length}层，失败${failed.length}层，最高完成层${lastSuccessfulLayer}`);
    
    failTask(taskId, error instanceof Error ? error.message : '任务执行失败');
  }
}

/**
 * GET 方法：获取当前任务列表
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get('shopId');
  
  if (!shopId) {
    return NextResponse.json(
      { success: false, error: '缺少shopId参数' },
      { status: 400 }
    );
  }
  
  // 返回LLM调用统计
  const { getLLMStats } = await import('@/lib/selection-engine');
  const llmStats = getLLMStats();
  
  return NextResponse.json({
    success: true,
    message: '请使用POST方法创建新任务',
    llmRateLimit: llmStats,
  });
}
