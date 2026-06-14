/**
 * 已采集ID列表API
 * GET /api/market-signals/collected-ids - 获取所有已采集的productId列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, marketSignals } from '@/storage/database/shared/schema';
import { desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // 查询所有productId
    const results = await db
      .select({ productId: marketSignals.productId })
      .from(marketSignals)
      .orderBy(desc(marketSignals.createdAt));

    // 提取productId列表并去重
    const collectedIds = [...new Set(
      results
        .map(r => r.productId)
        .filter(Boolean)
    )];

    return NextResponse.json({
      success: true,
      collectedIds,
      count: collectedIds.length
    });
  } catch (error) {
    console.error('[CollectedIds API] Error:', error);
    return NextResponse.json(
      { success: false, error: '获取已采集ID列表失败' },
      { status: 500 }
    );
  }
}
