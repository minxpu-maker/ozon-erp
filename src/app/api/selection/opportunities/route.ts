import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { desc, eq, and, sql } from 'drizzle-orm';

// GET /api/selection/opportunities - 获取选品单列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId');
    const mode = searchParams.get('mode'); // copy跟卖 / refine精铺
    const status = searchParams.get('status');
    const categoryId = searchParams.get('categoryId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const conditions = [];
    if (shopId) conditions.push(eq(schema.opportunities.shopId, shopId));
    if (mode) conditions.push(eq(schema.opportunities.selectionMode, mode));
    if (status) conditions.push(eq(schema.opportunities.status, status));
    if (categoryId) conditions.push(eq(schema.opportunities.targetCategoryId, parseInt(categoryId)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      db.select()
        .from(schema.opportunities)
        .where(whereClause)
        .orderBy(desc(schema.opportunities.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(schema.opportunities)
        .where(whereClause)
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[API] 获取选品单列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取选品单列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/selection/opportunities - 创建新选品单
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      shopId,
      mode,
      targetCategoryId,
      targetProductId,
      targetName,
      source,
      targetType,
      marketAnalysis,
      profitEstimate,
      riskFlags,
      assignedTo,
      notes
    } = body;

    if (!shopId || !mode) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: shopId, mode' },
        { status: 400 }
      );
    }

    const [opportunity] = await db.insert(schema.opportunities)
      .values({
        shopId,
        source: source || 'manual',
        selectionMode: mode,
        targetType: targetType || 'category',
        targetCategoryId: targetCategoryId ? parseInt(targetCategoryId) : null,
        targetProductId: targetProductId ? parseInt(targetProductId) : null,
        targetName: targetName || null,
        marketAnalysis: marketAnalysis || null,
        profitEstimate: profitEstimate || null,
        riskFlags: riskFlags || null,
        status: 'discovered',
        assignedTo: assignedTo || null,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: opportunity
    });
  } catch (error) {
    console.error('[API] 创建选品单失败:', error);
    return NextResponse.json(
      { success: false, error: '创建选品单失败' },
      { status: 500 }
    );
  }
}
