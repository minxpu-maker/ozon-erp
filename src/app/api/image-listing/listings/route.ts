import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { desc, eq, and } from 'drizzle-orm';

// GET /api/image-listing/listings - 获取上架任务列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const conditions = [];
    if (shopId) conditions.push(eq(schema.listingTasks.shopId, shopId));
    if (status) conditions.push(eq(schema.listingTasks.status, status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db.select()
      .from(schema.listingTasks)
      .where(whereClause)
      .orderBy(desc(schema.listingTasks.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('[API] 获取上架任务列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取上架任务列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/image-listing/listings - 创建上架任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      productCardId,
      shopId,
      variantId,
      logisticsTemplateId,
      packageWeight,
      packageDimensions
    } = body;

    if (!productCardId || !shopId) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: productCardId, shopId' },
        { status: 400 }
      );
    }

    const [task] = await db.insert(schema.listingTasks)
      .values({
        productCardId: parseInt(productCardId),
        shopId,
        variantId: variantId ? parseInt(variantId) : null,
        ozonTaskId: null,
        ozonProductId: null,
        status: 'created',
        logisticsTemplateId: logisticsTemplateId ? parseInt(logisticsTemplateId) : null,
        packageWeight: packageWeight || null,
        packageDimensions: packageDimensions || null,
        resultMessage: null,
        lastPollAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('[API] 创建上架任务失败:', error);
    return NextResponse.json(
      { success: false, error: '创建上架任务失败' },
      { status: 500 }
    );
  }
}
