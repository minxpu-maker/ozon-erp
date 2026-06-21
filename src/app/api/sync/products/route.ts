/**
 * 产品同步 API
 * POST /api/sync/products - 同步所有店铺的产品
 * GET /api/sync/products - 获取同步状态
 */

import { NextResponse } from 'next/server';
import { syncAllShopProducts } from '@/lib/ozon-product-sync';
import { db, schema } from '@/storage/database/client';
import { eq, sql } from 'drizzle-orm';

const { ozonProducts, shops } = schema;

/**
 * POST /api/sync/products
 * 同步所有店铺的产品信息
 * @param limit 限制每个店铺同步的产品数量，默认1000
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000'), 5000);
    
    console.log(`[API] 开始同步所有店铺产品（限制${limit}个/店铺）...`);
    const result = await syncAllShopProducts(limit);

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `同步完成: ${result.syncedShops}个店铺成功, ${result.totalProducts}个产品`
        : `同步完成: ${result.syncedShops}成功, ${result.failedShops}失败`,
      data: {
        syncedShops: result.syncedShops,
        failedShops: result.failedShops,
        totalProducts: result.totalProducts,
        newProducts: result.newProducts,
        updatedProducts: result.updatedProducts,
        shopResults: result.shopResults.map(r => ({
          shopName: r.shopName,
          totalProducts: r.totalProducts,
          newProducts: r.newProducts,
          updatedProducts: r.updatedProducts,
          success: r.success,
          errors: r.errors,
        })),
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('[API] 产品同步失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '产品同步失败',
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/products
 * 获取产品同步状态
 */
export async function GET() {
  try {
    // 获取各店铺的产品统计
    const stats = await db
      .select({
        shopId: ozonProducts.shop_id,
        shopName: shops.name,
        totalProducts: sql<number>`COUNT(*)`.as('total_products'),
        lastSynced: sql<Date>`MAX(${ozonProducts.updated_at})`.as('last_synced'),
      })
      .from(ozonProducts)
      .leftJoin(shops, eq(ozonProducts.shop_id, shops.id))
      .groupBy(ozonProducts.shop_id, shops.name);

    // 获取活跃店铺
    const activeShops = await db
      .select({
        id: shops.id,
        name: shops.name,
      })
      .from(shops)
      .where(eq(shops.isActive, true));

    return NextResponse.json({
      success: true,
      data: {
        activeShops: activeShops.length,
        shopStats: stats,
        totalProducts: stats.reduce((sum, s) => sum + Number(s.totalProducts), 0),
      },
    });
  } catch (error) {
    console.error('[API] 获取产品状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '获取产品状态失败',
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
