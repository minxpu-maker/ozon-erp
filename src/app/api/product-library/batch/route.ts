import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { sql } from 'drizzle-orm';

// 批量添加商品到产品库
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupId, items } = body;

    if (!groupId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: '分组ID和商品列表不能为空' },
        { status: 400 }
      );
    }

    const results = [];
    for (const item of items) {
      const { productId, productTitle, imageUrl, price, salesVolume } = item;
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
      results.push(result.rows[0]);
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `已添加 ${results.length} 件商品`,
    });
  } catch (error) {
    console.error('批量添加商品失败:', error);
    return NextResponse.json(
      { success: false, error: '批量添加商品失败' },
      { status: 500 }
    );
  }
}

// 批量删除产品库商品
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemIds } = body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '请选择要删除的商品' },
        { status: 400 }
      );
    }

    await db.execute(sql`DELETE FROM product_group_items WHERE id IN (${sql.join(itemIds.map(id => sql`${id}`), sql`, `)})`);

    return NextResponse.json({
      success: true,
      message: `已删除 ${itemIds.length} 件商品`,
    });
  } catch (error) {
    console.error('批量删除商品失败:', error);
    return NextResponse.json(
      { success: false, error: '批量删除商品失败' },
      { status: 500 }
    );
  }
}

// 移动商品到其他分组
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemIds, targetGroupId } = body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '请选择要移动的商品' },
        { status: 400 }
      );
    }

    if (!targetGroupId) {
      return NextResponse.json(
        { success: false, error: '请选择目标分组' },
        { status: 400 }
      );
    }

    await db.execute(sql`UPDATE product_group_items SET group_id = ${parseInt(targetGroupId)} WHERE id IN (${sql.join(itemIds.map(id => sql`${id}`), sql`, `)})`);

    return NextResponse.json({
      success: true,
      message: `已移动 ${itemIds.length} 件商品到新分组`,
    });
  } catch (error) {
    console.error('移动商品失败:', error);
    return NextResponse.json(
      { success: false, error: '移动商品失败' },
      { status: 500 }
    );
  }
}
