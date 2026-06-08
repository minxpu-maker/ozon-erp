import { NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, and, sql, count, desc } from 'drizzle-orm';
import { cache } from '@/lib/cache/memory-cache';

// 缓存时间：30秒
const CACHE_TTL = 30;

export async function GET() {
  try {
    // 尝试从缓存获取
    const cachedData = cache.get('dashboard');
    if (cachedData) {
      return NextResponse.json({ success: true, data: cachedData, cached: true });
    }

    // 获取各项统计数据
    const [
      totalOrders,
      pendingPurchaseOrders,
      pendingShipOrders,
      deliveringOrders,
      completedOrders,
      shops,
    ] = await Promise.all([
      // 总订单数
      db.select({ count: count() }).from(schema.orders),

      // 待采购订单（is_purchase_bound = false）
      db.select({ count: count() }).from(schema.orders)
        .where(eq(schema.orders.is_purchase_bound, false)),

      // 待发货订单
      db.select({ count: count() }).from(schema.orders)
        .where(eq(schema.orders.status, 'awaiting_deliver')),

      // 配送中订单
      db.select({ count: count() }).from(schema.orders)
        .where(eq(schema.orders.status, 'delivering')),

      // 已完成订单
      db.select({ count: count() }).from(schema.orders)
        .where(eq(schema.orders.status, 'delivered')),

      // 店铺列表 - 只查询必要字段
      db.select({
        id: schema.shops.id,
        name: schema.shops.name,
        last_sync_at: schema.shops.last_sync_at,
        is_active: schema.shops.is_active,
      }).from(schema.shops).where(eq(schema.shops.is_active, true)),
    ]);

    // 获取采购任务统计
    const pendingPurchaseTasks = await db.select({ count: count() })
      .from(schema.purchaseTasks)
      .where(eq(schema.purchaseTasks.status, 'pending'));

    const purchasedTasks = await db.select({ count: count() })
      .from(schema.purchaseTasks)
      .where(eq(schema.purchaseTasks.status, 'purchased'));

    // 获取验货统计
    const pendingInspection = await db.select({ count: count() })
      .from(schema.orders)
      .where(and(
        eq(schema.orders.is_purchase_bound, true),
        eq(schema.orders.is_inspected, false)
      ));

    // 获取打包统计
    const pendingPackaging = await db.select({ count: count() })
      .from(schema.orders)
      .where(and(
        eq(schema.orders.is_inspected, true),
        eq(schema.orders.is_packed, false)
      ));

    // 获取最近订单
    const recentOrders = await db.select({
      id: schema.orders.id,
      ozon_order_id: schema.orders.ozon_order_id,
      ozon_posting_number: schema.orders.ozon_posting_number,
      shop_id: schema.orders.shop_id,
      status: schema.orders.status,
      buyer_name: schema.orders.buyer_name,
      total_price: schema.orders.total_price,
      created_at: schema.orders.created_at,
    }).from(schema.orders)
      .orderBy(desc(schema.orders.created_at))
      .limit(5);

    // 获取店铺同步状态
    const shopStatus = shops.map(shop => ({
      id: shop.id,
      name: shop.name,
      last_sync: shop.last_sync_at ? new Date(shop.last_sync_at).toLocaleString('zh-CN') : '从未同步',
    }));

    // 计算流程统计
    const processStats = {
      pendingPurchase: pendingPurchaseOrders[0]?.count || 0,
      pendingInspection: pendingInspection[0]?.count || 0,
      pendingPackaging: pendingPackaging[0]?.count || 0,
      pendingShip: pendingShipOrders[0]?.count || 0,
    };

    // 计算金额统计
    const amountStats = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${schema.orders.total_price} AS DECIMAL)), 0)`,
    }).from(schema.orders);

    const dashboardData = {
      stats: {
        totalOrders: totalOrders[0]?.count || 0,
        pendingPurchase: pendingPurchaseOrders[0]?.count || 0,
        pendingShip: pendingShipOrders[0]?.count || 0,
        delivering: deliveringOrders[0]?.count || 0,
        completed: completedOrders[0]?.count || 0,
      },
      purchaseStats: {
        pending: pendingPurchaseTasks[0]?.count || 0,
        purchased: purchasedTasks[0]?.count || 0,
      },
      processStats,
      amountStats: {
        totalAmount: amountStats[0]?.total || '0',
      },
      recentOrders: recentOrders.map(order => ({
        ...order,
        shop_name: shops.find(s => s.id === order.shop_id)?.name || '-',
      })),
      shopStatus,
    };

    // 存入缓存
    cache.set('dashboard', dashboardData, CACHE_TTL);

    return NextResponse.json({ success: true, data: dashboardData });
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    return NextResponse.json({ success: false, error: '获取仪表盘数据失败' }, { status: 500 });
  }
}
