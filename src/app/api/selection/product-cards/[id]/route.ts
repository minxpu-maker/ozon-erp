import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/selection/product-cards/[id] - 获取商品卡详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [productCard] = await db.select()
      .from(schema.productCards)
      .where(eq(schema.productCards.id, parseInt(id)));

    if (!productCard) {
      return NextResponse.json(
        { success: false, error: '商品卡不存在' },
        { status: 404 }
      );
    }

    // 关联查询变体和图片集
    const [variants, imageSets] = await Promise.all([
      db.select()
        .from(schema.productVariants)
        .where(eq(schema.productVariants.productCardId, parseInt(id))),
      db.select()
        .from(schema.imageSets)
        .where(eq(schema.imageSets.productCardId, parseInt(id)))
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...productCard,
        variants,
        imageSets
      }
    });
  } catch (error) {
    console.error('[API] 获取商品卡详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取商品卡详情失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/selection/product-cards/[id] - 更新商品卡
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    const allowedFields = [
      'titleRu', 'titleZh', 'descriptionRu', 'attributes', 'variantAttributes',
      'suggestedPrice', 'costPrice', 'commissionRate', 'status', 'isEacRequired',
      'eacStatus', 'source1688Url', 'sourceOzonUrl', 'ozonCategoryId', 'ozonCategoryName'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const [updated] = await db.update(schema.productCards)
      .set(updateData)
      .where(eq(schema.productCards.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: '商品卡不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('[API] 更新商品卡失败:', error);
    return NextResponse.json(
      { success: false, error: '更新商品卡失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/selection/product-cards/[id] - 软删除（改为archived状态）
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [updated] = await db.update(schema.productCards)
      .set({
        status: 'archived',
        updatedAt: new Date()
      })
      .where(eq(schema.productCards.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: '商品卡不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('[API] 删除商品卡失败:', error);
    return NextResponse.json(
      { success: false, error: '删除商品卡失败' },
      { status: 500 }
    );
  }
}
