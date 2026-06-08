import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq, and, desc } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/selection/categories/[id]/trends - 获取指定类目的趋势数据
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);

    // 从prophet_forecasts表查询趋势数据
    const forecasts = await db.select()
      .from(schema.prophetForecasts)
      .where(
        and(
          eq(schema.prophetForecasts.targetType, 'category'),
          eq(schema.prophetForecasts.targetId, categoryId)
        )
      )
      .orderBy(desc(schema.prophetForecasts.forecastDate));

    // 如果没有数据，返回空数组
    if (forecasts.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: '暂无趋势数据，请先执行数据同步'
      });
    }

    return NextResponse.json({
      success: true,
      data: forecasts
    });
  } catch (error) {
    console.error('[API] 获取类目趋势失败:', error);
    return NextResponse.json(
      { success: false, error: '获取类目趋势失败' },
      { status: 500 }
    );
  }
}
