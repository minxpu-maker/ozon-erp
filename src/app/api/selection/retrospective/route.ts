import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { desc, eq, and, gte, lte } from 'drizzle-orm';

// GET /api/selection/retrospective - 获取选品历史复盘数据
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const conditions = [];
    if (shopId) conditions.push(eq(schema.selectionRetrospectives.shopId, shopId));
    if (startDate) conditions.push(gte(schema.selectionRetrospectives.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(schema.selectionRetrospectives.createdAt, new Date(endDate)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db.select()
      .from(schema.selectionRetrospectives)
      .where(whereClause)
      .orderBy(desc(schema.selectionRetrospectives.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('[API] 获取选品复盘数据失败:', error);
    return NextResponse.json(
      { success: false, error: '获取选品复盘数据失败' },
      { status: 500 }
    );
  }
}
