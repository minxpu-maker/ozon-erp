import { NextRequest, NextResponse } from 'next/server';

// GET /api/selection/opportunities/[id] - 获取选品详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Mock data for now
    const opportunity = {
      id: Number(id),
      shopId: 'shop-tiantan',
      source: 'ozon',
      selectionMode: 'copy',
      targetType: 'product',
      targetCategoryId: 101,
      targetProductId: 1000 + Number(id),
      targetName: `选品商品 ${id}`,
      marketAnalysis: {
        priceRange: { min: 1500 + Number(id) * 100, max: 3500 + Number(id) * 100 },
        sellerCount: 45 + Number(id),
        reviewCount: 320 + Number(id) * 10,
        avgRating: 4.5,
        monthlySales: 156 + Number(id) * 5,
      },
      profitEstimate: {
        profitMargin: 35 + Number(id),
        roi: 85 + Number(id) * 2,
        estimatedProfit: 500 + Number(id) * 50,
      },
      riskFlags: {
        hasEacRequirement: false,
        priceCompetitive: true,
        stockAvailable: true,
        logisticsOk: id !== '3',
        categorySafe: true,
      },
      scores: {
        profit: 60 + Number(id) * 3,
        competition: 30 + Number(id) * 2,
        demand: 70 + Number(id),
        differentiation: 50 + Number(id) * 2,
        supply: 65 + Number(id),
      },
      status: 'discovered',
      createdAt: new Date(Date.now() - Number(id) * 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: opportunity });
  } catch (error) {
    console.error('Get opportunity error:', error);
    return NextResponse.json(
      { success: false, error: '获取选品详情失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/selection/opportunities/[id] - 更新选品状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ['pending', 'discovered', 'confirmed', 'abandoned', 'converted'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: '无效的状态值' },
        { status: 400 }
      );
    }

    // Mock update
    const updated = {
      id: Number(id),
      status: status || 'confirmed',
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update opportunity error:', error);
    return NextResponse.json(
      { success: false, error: '更新选品状态失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/selection/opportunities/[id] - 软删除选品
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Mock soft delete (set status to abandoned)
    return NextResponse.json({
      success: true,
      data: { id: Number(id), status: 'abandoned' }
    });
  } catch (error) {
    console.error('Delete opportunity error:', error);
    return NextResponse.json(
      { success: false, error: '删除选品失败' },
      { status: 500 }
    );
  }
}
