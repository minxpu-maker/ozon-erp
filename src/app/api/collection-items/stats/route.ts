import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { collectionItems, marketSignals } from '@/storage/database/shared/schema';
import { eq, count, and, gte, sql } from 'drizzle-orm';

/**
 * GET /api/collection-items/stats
 * 获取采集箱统计信息
 * Query: shopId
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId');
    
    // 构建查询条件
    const conditions = shopId ? eq(collectionItems.shopId, shopId) : undefined;
    
    // 按状态统计
    const statusStats = await db
      .select({
        status: collectionItems.status,
        count: count(),
      })
      .from(collectionItems)
      .where(conditions)
      .groupBy(collectionItems.status);
    
    // 今日统计
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [todayCount] = await db
      .select({ count: count() })
      .from(collectionItems)
      .where(
        conditions
          ? and(conditions, gte(collectionItems.createdAt, today))
          : gte(collectionItems.createdAt, today)
      );
    
    // 本周统计
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const [weekCount] = await db
      .select({ count: count() })
      .from(collectionItems)
      .where(
        conditions
          ? and(conditions, gte(collectionItems.createdAt, weekStart))
          : gte(collectionItems.createdAt, weekStart)
      );
    
    // 总数
    const [totalCount] = await db
      .select({ count: count() })
      .from(collectionItems)
      .where(conditions);
    
    // 按发布状态统计
    const publishStats = await db
      .select({
        publishStatus: collectionItems.publishStatus,
        count: count(),
      })
      .from(collectionItems)
      .where(
        conditions
          ? and(conditions, eq(collectionItems.status, 'published'))
          : eq(collectionItems.status, 'published')
      )
      .groupBy(collectionItems.publishStatus);
    
    // 构建统计结果
    const statsMap: Record<string, number> = {
      pending: 0,
      claimed: 0,
      published: 0,
      rejected: 0,
    };
    statusStats.forEach(s => {
      if (s.status && s.status in statsMap) {
        statsMap[s.status] = Number(s.count);
      }
    });
    
    const publishMap: Record<string, number> = {
      pending_review: 0,
      listed: 0,
      rejected: 0,
    };
    publishStats.forEach(s => {
      if (s.publishStatus && s.publishStatus in publishMap) {
        publishMap[s.publishStatus] = Number(s.count);
      }
    });
    
    return NextResponse.json({
      success: true,
      data: {
        byStatus: {
          pending: statsMap.pending,    // 待处理
          claimed: statsMap.claimed,    // 已认领
          published: statsMap.published, // 已发布
          rejected: statsMap.rejected,  // 已拒绝
        },
        byPublishStatus: {
          pendingReview: publishMap.pending_review, // 待审核
          listed: publishMap.listed,     // 已上架
          rejected: publishMap.rejected, // 审核拒绝
        },
        summary: {
          todayCount: Number(todayCount?.count || 0),   // 今日采集
          weekCount: Number(weekCount?.count || 0),    // 本周采集
          totalCount: Number(totalCount?.count || 0),   // 总计
        },
      },
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取统计失败' },
      { status: 500 }
    );
  }
}
