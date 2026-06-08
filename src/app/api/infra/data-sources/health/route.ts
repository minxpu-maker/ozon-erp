import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { desc, eq, and } from 'drizzle-orm';

// GET /api/infra/data-sources/health - 获取所有数据源健康状态
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source');

    const conditions = [];
    if (source) conditions.push(eq(schema.dataSourceHealth.source, source));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const healthStatus = await db.select()
      .from(schema.dataSourceHealth)
      .where(whereClause)
      .orderBy(desc(schema.dataSourceHealth.lastCheckAt));

    return NextResponse.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    console.error('[API] 获取数据源健康状态失败:', error);
    return NextResponse.json(
      { success: false, error: '获取数据源健康状态失败' },
      { status: 500 }
    );
  }
}
