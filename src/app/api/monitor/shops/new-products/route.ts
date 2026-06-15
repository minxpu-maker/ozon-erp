import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/storage/database/client';

// 获取店铺上新列表
export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7');
    const sellerName = searchParams.get('sellerName');
    const limit = parseInt(searchParams.get('limit') || '50');

    // 计算时间范围
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query: string;
    let params: any[];

    // 如果指定了卖家名称
    if (sellerName) {
      query = `
        SELECT 
          m.seller_name,
          m.product_title,
          m.price,
          m.listed_date,
          m.category_path,
          m.image_url,
          m.source_type,
          m.collected_at,
          CASE 
            WHEN m.listed_date >= $1 THEN 'new'
            ELSE 'existing'
          END as product_status
        FROM market_signals m
        INNER JOIN monitor_shop ms ON m.seller_name = ms.seller_name
        WHERE ms.status = 'active'
          AND m.seller_name = $2
          AND m.collected_at >= $1
        ORDER BY m.collected_at DESC
        LIMIT $3
      `;
      params = [startDate, sellerName, limit];
    } else {
      query = `
        SELECT 
          m.seller_name,
          m.product_title,
          m.price,
          m.listed_date,
          m.category_path,
          m.image_url,
          m.source_type,
          m.collected_at,
          CASE 
            WHEN m.listed_date >= $1 THEN 'new'
            ELSE 'existing'
          END as product_status
        FROM market_signals m
        INNER JOIN monitor_shop ms ON m.seller_name = ms.seller_name
        WHERE ms.status = 'active'
          AND m.collected_at >= $1
        ORDER BY m.collected_at DESC
        LIMIT $2
      `;
      params = [startDate, limit];
    }

    const result = await client.query(query, params);

    // 分离新品和现有商品
    const rows = result.rows as any[];
    const newProducts = rows.filter((r) => r.product_status === 'new');
    const existingProducts = rows.filter((r) => r.product_status === 'existing');

    // 按卖家分组统计新品
    const sellerStats = newProducts.reduce((acc: Record<string, { sellerName: string; newCount: number; totalProducts: number }>, r) => {
      const seller = String(r.seller_name);
      if (!acc[seller]) {
        acc[seller] = {
          sellerName: seller,
          newCount: 0,
          totalProducts: rows.filter((x) => x.seller_name === seller).length,
        };
      }
      acc[seller].newCount++;
      return acc;
    }, {} as Record<string, any>);

    // 构建响应
    const response = {
      success: true,
      data: rows.map((r) => ({
        sellerName: r.seller_name,
        productTitle: r.product_title,
        price: r.price,
        listedDate: r.listed_date,
        category: r.category_path,
        imageUrl: r.image_url,
        platform: r.source_type,
        collectedAt: r.collected_at,
        productStatus: r.product_status,
      })),
      stats: {
        totalMonitored: Object.keys(sellerStats).length,
        totalNewProducts: newProducts.length,
        totalExistingProducts: existingProducts.length,
        sellerStats: Object.values(sellerStats),
      },
      days,
      sellerName: sellerName || null,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('获取店铺上新列表失败:', error);
    const err = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: '查询失败: ' + err },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
