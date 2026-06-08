import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/selection/product-cards/[id]/variants - 获取商品卡的所有SKU变体
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const variants = await db.select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.productCardId, parseInt(id)));

    return NextResponse.json({
      success: true,
      data: variants
    });
  } catch (error) {
    console.error('[API] 获取商品变体列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取商品变体列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/selection/product-cards/[id]/variants - 新增或批量更新变体
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { variants } = body;

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: variants (数组)' },
        { status: 400 }
      );
    }

    const productCardId = parseInt(id);
    const results = [];

    for (const variant of variants) {
      const { color, size, skuCode, price, stock, imageIds, variantName, variantValues } = variant;

      const [result] = await db.insert(schema.productVariants)
        .values({
          productCardId,
          variantName: variantName || `${color || ''} ${size || ''}`.trim(),
          variantValues: variantValues || { color, size, skuCode },
          confirmedPrice: price ? parseInt(price) : null,
          costPrice: null,
          stock: stock || 0,
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      results.push(result);
    }

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('[API] 创建商品变体失败:', error);
    return NextResponse.json(
      { success: false, error: '创建商品变体失败' },
      { status: 500 }
    );
  }
}
