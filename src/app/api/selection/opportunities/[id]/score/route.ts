import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/selection/opportunities/[id]/score - 触发评分计算
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // TODO: 第八步实现选品引擎
    // 现在返回占位响应
    return NextResponse.json({
      success: false,
      error: '选品引擎未实现',
      data: {
        opportunityId: parseInt(id),
        status: 'pending',
        message: '评分引擎将在第八步实现，届时将计算五维评分（需求度、竞争度、利润率、供应链、风险）并更新product_scores表'
      }
    });
  } catch (error) {
    console.error('[API] 触发评分计算失败:', error);
    return NextResponse.json(
      { success: false, error: '触发评分计算失败' },
      { status: 500 }
    );
  }
}
