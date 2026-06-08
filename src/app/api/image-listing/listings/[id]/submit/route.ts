import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';
import { importProducts, getImportInfo } from '@/lib/ozon';
import type { ProductImportItem } from '@/lib/ozon/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/image-listing/listings/[id]/submit - 提交上架到Ozon
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 获取上架任务
    const [task] = await db.select()
      .from(schema.listingTasks)
      .where(eq(schema.listingTasks.id, parseInt(id)));

    if (!task) {
      return NextResponse.json(
        { success: false, error: '上架任务不存在' },
        { status: 404 }
      );
    }

    // 获取商品卡信息
    const [productCard] = await db.select()
      .from(schema.productCards)
      .where(eq(schema.productCards.id, task.productCardId));

    if (!productCard) {
      return NextResponse.json(
        { success: false, error: '商品卡不存在' },
        { status: 404 }
      );
    }

    // 获取变体信息
    const variants = await db.select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.productCardId, task.productCardId));

    // 构建Ozon商品导入数据
    const items: ProductImportItem[] = variants.length > 0 ? variants.map(v => ({
      name: productCard.titleRu || productCard.titleZh || '',
      offer_id: v.ozonVariantId || `variant-${v.id}`,
      category_id: productCard.ozonCategoryId,
      price: String(v.confirmedPrice || productCard.suggestedPrice || '0'),
      vat: '0',
      images: [],
      attributes: []
    })) : [{
      name: productCard.titleRu || productCard.titleZh || '',
      offer_id: `product-${productCard.id}`,
      category_id: productCard.ozonCategoryId,
      price: String(productCard.suggestedPrice || '0'),
      vat: '0',
      images: [],
      attributes: []
    }];

    // 调用Ozon API导入商品
    const taskId = await importProducts(task.shopId, items);

    // 更新任务状态
    const [updated] = await db.update(schema.listingTasks)
      .set({
        status: 'submitted',
        ozonTaskId: taskId,
        updatedAt: new Date()
      })
      .where(eq(schema.listingTasks.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        taskId: taskId,
        ozonTaskId: taskId,
        status: 'submitted'
      }
    });
  } catch (error) {
    console.error('[API] 提交上架失败:', error);
    return NextResponse.json(
      { success: false, error: '提交上架失败' },
      { status: 500 }
    );
  }
}
