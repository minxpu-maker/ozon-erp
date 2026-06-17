import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 获取店铺信息
    const shop = await db.query.shops.findFirst({
      where: eq(shops.id, id),
    });

    if (!shop) {
      return NextResponse.json(
        { success: false, error: '店铺不存在' },
        { status: 404 }
      );
    }

    // 模拟同步操作（实际应调用Ozon API）
    // 这里可以添加真实的Ozon API同步逻辑
    const syncResults = {
      products: 0,
      orders: 0,
      categories: 0,
    };

    // 更新最后同步时间
    await db.update(shops)
      .set({
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(shops.id, id));

    const synced = syncResults.products + syncResults.orders + syncResults.categories;

    return NextResponse.json({
      success: true,
      data: {
        shopId: id,
        shopName: shop.name,
        synced,
        details: syncResults,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('同步店铺失败:', error);
    return NextResponse.json(
      { success: false, error: '同步失败' },
      { status: 500 }
    );
  }
}
