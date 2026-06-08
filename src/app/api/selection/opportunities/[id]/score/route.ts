/**
 * 单个候选品评分接口
 * 实际调用批量评分引擎
 * POST /api/selection/opportunities/[id]/score
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { scoreOpportunity, getStrategyWeights, SelectionStrategy } from '@/lib/selection-engine';

const { opportunities } = schema;

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/selection/opportunities/[id]/score - 触发单个候选品评分
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const opportunityId = parseInt(id);
    
    if (isNaN(opportunityId)) {
      return NextResponse.json(
        { success: false, error: '无效的候选品ID' },
        { status: 400 }
      );
    }
    
    // 1. 获取候选品信息
    const [opportunity] = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.id, opportunityId))
      .limit(1);
    
    if (!opportunity) {
      return NextResponse.json(
        { success: false, error: '候选品不存在' },
        { status: 404 }
      );
    }
    
    // 2. 确定评分策略
    const strategy: SelectionStrategy = opportunity.selectionMode === 'refine' 
      ? 'refine_default' 
      : 'follow_default';
    
    // 3. 获取策略权重
    const weights = getStrategyWeights(strategy);
    
    // 4. 调用评分引擎（内部会自动创建draft状态的productCard）
    const result = await scoreOpportunity(opportunity, weights);
    
    // 5. 返回评分结果
    return NextResponse.json({
      success: true,
      data: {
        opportunityId,
        productCardId: result.productCardId,
        compositeScore: result.compositeScore,
        grade: result.grade,
        dimensions: result.dimensions,
        hardConstraintsPassed: result.hardConstraintsPassed,
        totalDiscount: result.totalDiscount,
        crossVerifyDiscount: result.crossVerifyDiscount,
        followSignal: result.followSignal,
        refineConversion: result.refineConversion,
        strategy,
      },
    });
  } catch (error) {
    console.error('[API] 单个候选品评分失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '评分计算失败' },
      { status: 500 }
    );
  }
}
