import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { sql } from 'drizzle-orm';
import { monitorShop } from '@/storage/database/shared/schema';

// 获取店铺监控列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get('platform') || 'ozon';
    const status = searchParams.get('status') || 'active';

    const result = await db.execute(sql`
      SELECT 
        id,
        seller_name,
        platform,
        status,
        created_at
      FROM monitor_shop
      WHERE platform = ${platform}
        AND status = ${status}
      ORDER BY created_at DESC
    `);

    return NextResponse.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
    });

  } catch (error) {
    console.error('获取店铺监控列表失败:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}

// 添加店铺监控
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sellerName, platform = 'ozon' } = body;

    if (!sellerName) {
      return NextResponse.json(
        { success: false, error: 'sellerName is required' },
        { status: 400 }
      );
    }

    // 使用 upsert 避免重复
    const result = await db.execute(sql`
      INSERT INTO monitor_shop (seller_name, platform, status)
      VALUES (${sellerName}, ${platform}, 'active')
      ON CONFLICT (seller_name, platform) 
      DO UPDATE SET status = 'active', created_at = NOW()
      RETURNING id, seller_name, platform, status, created_at
    `);

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });

  } catch (error) {
    console.error('添加店铺监控失败:', error);
    return NextResponse.json(
      { success: false, error: '添加失败' },
      { status: 500 }
    );
  }
}
