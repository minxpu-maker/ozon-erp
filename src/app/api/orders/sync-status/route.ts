import { NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops, orders, orderSyncLogs } from '@/storage/database/shared/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/orders/sync-status - 获取同步状态
export async function GET() {
  try {
    // 获取所有活跃店铺
    const shopList = await db
      .select()
      .from(shops)
      .where(eq(shops.is_active, true));

    // 获取每个店铺的订单统计
    const shopStats = await Promise.all(
      shopList.map(async (shop) => {
        // 该店铺的订单数
        const orderList = await db
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.shop_id, shop.id));
        
        // 该店铺最近一次同步日志
        const lastSync = await db
          .select()
          .from(orderSyncLogs)
          .where(eq(orderSyncLogs.shop_id, shop.id))
          .orderBy(desc(orderSyncLogs.created_at))
          .limit(1);

        return {
          shopId: shop.id,
          shopName: shop.name,
          isPrimary: shop.is_primary,
          isActive: shop.is_active,
          lastSyncAt: shop.last_sync_at,
          orderCount: orderList.length,
          lastSyncStatus: lastSync[0]?.status || null,
          lastSyncTime: lastSync[0]?.started_at || null,
        };
      })
    );

    // 获取全局统计
    const allOrders = await db
      .select({ status: orders.status })
      .from(orders);

    const statusCount = allOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: {
        shops: shopStats,
        statusCount,
        totalOrders: allOrders.length,
      },
    });
  } catch (error) {
    console.error('获取同步状态失败:', error);
    return NextResponse.json(
      { success: false, error: '获取同步状态失败' },
      { status: 500 }
    );
  }
}
