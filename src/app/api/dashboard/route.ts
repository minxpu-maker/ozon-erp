import { NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { orders, shops, purchaseTasks } from '@/storage/database/shared/schema';

export async function GET() {
  try {
    // 获取店铺数量
    const shopCountResult = await db.select().from(shops);
    const shopCount = shopCountResult.length;
    const shopList = shopCountResult.map((s) => ({
      id: String(s.id),
      name: s.name,
      lastSyncAt: s.last_sync_at?.toISOString() || null,
    }));

    // 获取今日开始时间
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 获取订单统计
    const orderList = await db.select().from(orders);
    const totalOrders = orderList.length;
    const pendingPurchase = orderList.filter((o) => o.status === 'awaiting_purchase').length;
    const pendingShip = orderList.filter((o) => o.status === 'awaiting_deliver').length;
    const delivering = orderList.filter((o) => o.status === 'delivering').length;
    const completed = orderList.filter((o) => o.status === 'delivered').length;

    // 计算今日销售额
    const todayOrders = orderList.filter((o) => {
      const orderDate = new Date(o.created_at);
      return orderDate >= today;
    });
    const todaySales = todayOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);

    // 获取采购任务统计
    const purchaseTaskList = await db.select().from(purchaseTasks);
    const pendingPurchaseTasks = purchaseTaskList.filter((t) => t.status === 'pending').length;
    const purchasedTasks = purchaseTaskList.filter((t) => t.status === 'purchased').length;

    // pendingInspection 和 pendingPackaging 需要通过关联订单状态统计
    // 目前暂时返回0，后续可根据验货/打包流程完善
    const pendingInspection = orderList.filter((o) => o.status === 'awaiting_inspection').length;
    const pendingPackaging = orderList.filter((o) => o.status === 'awaiting_packaging').length;

    // 获取最近订单（最近10条）
    const recentOrdersResult = await db.select().from(orders).orderBy(orders.created_at).limit(10);
    const recentOrders = recentOrdersResult.map((o) => ({
      id: String(o.id),
      ozonOrderId: o.ozon_order_id || '',
      postingNumber: o.ozon_posting_number || '',
      shopName: shopList.find((s) => s.id === String(o.shop_id))?.name || '未知店铺',
      status: o.status || 'unknown',
      buyerName: o.buyer_name,
      totalPrice: String(o.total_price || 0),
      createdAt: o.created_at.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalOrders,
        pendingPurchase,
        pendingShip,
        delivering,
        completed,
        todaySales: todaySales.toFixed(2),
        pendingPurchaseTasks,
        purchasedTasks,
        pendingInspection,
        pendingPackaging,
        shopCount,
        shops: shopList,
        recentOrders,
      },
    });
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    return NextResponse.json(
      { success: false, error: '获取数据失败' },
      { status: 500 }
    );
  }
}
