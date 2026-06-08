import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { desc, eq, and } from 'drizzle-orm';

// GET /api/selection/product-cards - 获取商品卡列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId');
    const status = searchParams.get('status');
    const opportunityId = searchParams.get('opportunityId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const conditions = [];
    if (shopId) conditions.push(eq(schema.productCards.shopId, shopId));
    if (status) conditions.push(eq(schema.productCards.status, status));
    if (opportunityId) conditions.push(eq(schema.productCards.opportunityId, parseInt(opportunityId)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db.select()
      .from(schema.productCards)
      .where(whereClause)
      .orderBy(desc(schema.productCards.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('[API] 获取商品卡列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取商品卡列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/selection/product-cards - 创建新商品卡
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let {
      shopId,
      opportunityId,
      titleRu,
      titleZh,
      descriptionRu,
      categoryId,
      attributes,
      variantAttributes,
      suggestedPrice,
      costPrice,
      commissionRate,
      source1688Url,
      sourceOzonUrl
    } = body;

    // If shopId not provided, try to get an existing shop
    if (!shopId) {
      try {
        const existingShops = await db.select({ id: schema.shops.id }).from(schema.shops).limit(1);
        if (existingShops.length > 0) {
          shopId = existingShops[0].id;
        }
      } catch (e) {
        console.log('[API] Could not query shops table:', e);
      }
    }

    // If still no shopId, return error
    if (!shopId) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: shopId，请先创建店铺' },
        { status: 400 }
      );
    }

    // Default category if not provided
    if (!categoryId) {
      categoryId = '100'; // Default: 服装配饰
    }

    const [productCard] = await db.insert(schema.productCards)
      .values({
        shopId: shopId,
        opportunityId: opportunityId ? parseInt(opportunityId) : null,
        ozonCategoryId: parseInt(categoryId),
        titleRu: titleRu || null,
        titleZh: titleZh || null,
        description: descriptionRu || null,
        attributes: attributes || null,
        variantAttributes: variantAttributes || null,
        suggestedPrice: suggestedPrice ? parseInt(suggestedPrice) : null,
        costPrice: costPrice ? parseInt(costPrice) : null,
        commissionRate: commissionRate || null,
        status: 'draft',
        isEacRequired: false,
        eacStatus: 'none',
        source1688Url: source1688Url || null,
        sourceOzonUrl: sourceOzonUrl || null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: productCard
    });
  } catch (error) {
    console.error('[API] 创建商品卡失败:', error);
    return NextResponse.json(
      { success: false, error: '创建商品卡失败' },
      { status: 500 }
    );
  }
}
