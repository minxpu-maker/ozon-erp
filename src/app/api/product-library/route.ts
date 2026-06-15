import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { sql } from 'drizzle-orm';

// 获取产品库商品列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const userId = searchParams.get('userId') || 'default';

    let query;
    let params: (string | number)[];
    
    if (groupId) {
      query = sql`
        SELECT pgi.*, pg.name as group_name
        FROM product_group_items pgi
        LEFT JOIN product_groups pg ON pgi.group_id = pg.id
        WHERE pgi.group_id = ${parseInt(groupId)}
        ORDER BY pgi.added_at DESC
      `;
      params = [];
    } else {
      query = sql`
        SELECT pgi.*, pg.name as group_name
        FROM product_group_items pgi
        LEFT JOIN product_groups pg ON pgi.group_id = pg.id
        WHERE pg.user_id = ${userId} OR pg.user_id IS NULL
        ORDER BY pgi.added_at DESC
      `;
      params = [];
    }

    const result = await db.execute(query);

    const products = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      groupItemId: row.id,
      groupId: row.group_id,
      groupName: row.group_name,
      productId: row.product_id,
      productTitle: row.product_title,
      imageUrl: row.image_url,
      price: row.price,
      salesVolume: row.sales_volume,
      collectedAt: row.collected_at,
      addedAt: row.added_at,
    }));

    return NextResponse.json({
      success: true,
      data: products,
      total: products.length,
    });
  } catch (error) {
    console.error('获取产品库商品失败:', error);
    return NextResponse.json(
      { success: false, error: '获取产品库商品失败' },
      { status: 500 }
    );
  }
}

// 添加商品到产品库
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupId, productId, productTitle, imageUrl, price, salesVolume } = body;

    if (!groupId || !productId) {
      return NextResponse.json(
        { success: false, error: '分组ID和商品ID不能为空' },
        { status: 400 }
      );
    }

    const result = await db.execute(sql`
      INSERT INTO product_group_items (group_id, product_id, product_title, image_url, price, sales_volume, collected_at)
      VALUES (${parseInt(groupId)}, ${productId}, ${productTitle || ''}, ${imageUrl || null}, ${price || null}, ${salesVolume || 0}, NOW())
      ON CONFLICT (group_id, product_id) DO UPDATE SET
        product_title = EXCLUDED.product_title,
        image_url = EXCLUDED.image_url,
        price = EXCLUDED.price,
        sales_volume = EXCLUDED.sales_volume,
        collected_at = NOW()
      RETURNING *
    `);

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('添加商品到产品库失败:', error);
    return NextResponse.json(
      { success: false, error: '添加商品到产品库失败' },
      { status: 500 }
    );
  }
}
