import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq, and, gte, lt } from 'drizzle-orm';

const { qcRecords } = schema;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // 格式: YYYY-MM-DD，默认今天

    // 计算日期范围
    const targetDate = date || new Date().toISOString().split('T')[0];
    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

    // 查询验货记录
    const records = await db
      .select({
        qcResult: qcRecords.qcResult,
      })
      .from(qcRecords)
      .where(
        and(
          gte(qcRecords.qcTime, startOfDay),
          lt(qcRecords.qcTime, endOfDay)
        )
      );

    // 统计
    const totalCount = records.length;
    const passCount = records.filter((r) => r.qcResult === 'pass').length;
    const failCount = records.filter((r) => r.qcResult === 'fail').length;
    const partialCount = records.filter((r) => r.qcResult === 'partial').length;
    const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        date: targetDate,
        totalCount,
        passCount,
        failCount,
        partialCount,
        passRate,
      },
    });
  } catch (error) {
    console.error('[QC Stats] GET Error:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}
