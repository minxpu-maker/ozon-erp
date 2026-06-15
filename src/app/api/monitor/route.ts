import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { sql, eq } from 'drizzle-orm';

// 直接使用SQL查询，因为monitor表还未注册到schema
// productMonitor表：id, product_id, product_title, image_url, current_price, current_sales,
// last_price, last_sales, price_change, sales_change, first_price, first_sales, platform, 
// created_at, updated_at, last_checked_at

// 获取监控列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') || 'ozon';
    const limit = parseInt(searchParams.get('limit') || '50');

    const monitors = await db.execute(sql`
      SELECT id, product_id, product_title, image_url, 
             current_price, current_sales, 
             last_price, last_sales,
             price_change, sales_change,
             first_price, first_sales,
             platform, created_at, updated_at, last_checked_at,
             EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as duration_hours
      FROM product_monitor 
      WHERE platform = ${platform}
      ORDER BY updated_at DESC 
      LIMIT ${limit}
    `);

    const items = ((monitors as unknown) as any[]).map(m => ({
      id: m.id,
      productId: m.product_id,
      productTitle: m.product_title,
      imageUrl: m.image_url,
      currentPrice: m.current_price,
      currentSales: m.current_sales,
      lastPrice: m.last_price,
      lastSales: m.last_sales,
      priceChange: m.price_change,
      salesChange: m.sales_change,
      firstPrice: m.first_price,
      firstSales: m.first_sales,
      platform: m.platform,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
      durationHours: Math.round(parseFloat(m.duration_hours || 0)),
    }));

    return NextResponse.json({
      success: true,
      data: items,
      total: items.length,
    });
  } catch (error) {
    console.error('获取监控列表失败:', error);
    return NextResponse.json({ success: false, error: '获取监控列表失败' }, { status: 500 });
  }
}

// 添加/更新监控快照
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      productId,
      productTitle,
      imageUrl,
      price,
      salesVolume,
      platform = 'ozon',
    } = body;

    if (!productId) {
      return NextResponse.json({ success: false, error: '缺少productId' }, { status: 400 });
    }

    // 检查是否已存在
    const existing = await db.execute(sql`
      SELECT id, current_price, current_sales, first_price, first_sales 
      FROM product_monitor 
      WHERE product_id = ${productId}
    `) as unknown as any[];

    if (existing.length > 0) {
      // 更新：记录上次数据，计算变化
      const old = existing[0];
      const priceChange = old.current_price > 0 
        ? ((price - old.current_price) / old.current_price * 100).toFixed(2)
        : 0;
      const salesChange = price - old.current_price !== 0 
        ? salesVolume - old.current_sales 
        : 0;

      await db.execute(sql`
        UPDATE product_monitor SET
          last_price = current_price,
          last_sales = current_sales,
          current_price = ${price},
          current_sales = ${salesVolume},
          price_change = ${priceChange},
          sales_change = ${salesChange},
          updated_at = NOW(),
          last_checked_at = NOW()
        WHERE product_id = ${productId}
      `);

      const updated = await db.execute(sql`
        SELECT * FROM product_monitor WHERE product_id = ${productId}
      `) as unknown as any[];

      return NextResponse.json({
        success: true,
        data: {
          ...updated[0],
          hasChanged: parseFloat(String(priceChange)) !== 0 || salesChange !== 0,
          priceChange: priceChange,
          salesChange: salesChange,
        },
        isUpdate: true,
      });
    } else {
      // 新增
      await db.execute(sql`
        INSERT INTO product_monitor 
        (product_id, product_title, image_url, current_price, current_sales, 
         last_price, last_sales, first_price, first_sales, platform)
        VALUES (${productId}, ${productTitle || ''}, ${imageUrl || ''}, ${price || 0}, ${salesVolume || 0},
                ${price || 0}, ${salesVolume || 0}, ${price || 0}, ${salesVolume || 0}, ${platform})
        ON CONFLICT (product_id) DO UPDATE SET
          last_price = product_monitor.current_price,
          last_sales = product_monitor.current_sales,
          current_price = ${price},
          current_sales = ${salesVolume}
      `);

      return NextResponse.json({
        success: true,
        data: { productId, isNew: true },
        isNew: true,
      });
    }
  } catch (error) {
    console.error('保存监控快照失败:', error);
    return NextResponse.json({ success: false, error: '保存监控快照失败' }, { status: 500 });
  }
}
