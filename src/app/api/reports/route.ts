import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { sql, desc } from 'drizzle-orm';
import { cache } from '@/lib/cache/memory-cache';

// 缓存时间：60秒
const CACHE_TTL = 60;

// 获取报表数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 生成缓存key
    const cacheKey = `reports:${type}:${startDate || 'none'}:${endDate || 'none'}`;
    
    // 尝试从缓存获取
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json({ success: true, data: cachedData, cached: true });
    }

    // 获取订单统计
    const orderStats = await db.select({
      total: sql<number>`COUNT(*)`,
      totalAmount: sql<string>`COALESCE(SUM(CAST(${schema.orders.total_price} AS DECIMAL)), 0)`,
    }).from(schema.orders);

    // 获取采购统计
    const purchaseStats = await db.select({
      total: sql<number>`COUNT(*)`,
      totalAmount: sql<string>`COALESCE(SUM(CAST(${schema.purchaseTasks.purchase_amount} AS DECIMAL)), 0)`,
    }).from(schema.purchaseTasks)
      .where(sql`${schema.purchaseTasks.status} = 'purchased'`);

    // 获取利润统计
    const profitStats = await db.select({
      total: sql<number>`COUNT(*)`,
      totalProfit: sql<string>`COALESCE(SUM(CAST(${schema.financeRecords.net_profit} AS DECIMAL)), 0)`,
    }).from(schema.financeRecords);

    // 获取最近7天订单趋势
    const orderTrend = await db.select({
      date: sql<string>`DATE(${schema.orders.created_at})`,
      count: sql<number>`COUNT(*)`,
    }).from(schema.orders)
      .where(sql`${schema.orders.created_at} >= NOW() - INTERVAL '7 days'`)
      .groupBy(sql`DATE(${schema.orders.created_at})`)
      .orderBy(desc(sql`DATE(${schema.orders.created_at})`));

    const reportData = {
      orderStats: orderStats[0] || { total: 0, totalAmount: '0' },
      purchaseStats: purchaseStats[0] || { total: 0, totalAmount: '0' },
      profitStats: profitStats[0] || { total: 0, totalProfit: '0' },
      orderTrend,
    };

    // 存入缓存
    cache.set(cacheKey, reportData, CACHE_TTL);

    return NextResponse.json({ success: true, data: reportData });
  } catch (error) {
    console.error('获取报表数据失败:', error);
    return NextResponse.json({ success: false, error: '获取报表数据失败' }, { status: 500 });
  }
}
