import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 更新订单采购价
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, purchasePrice } = body;

    if (!orderId || purchasePrice === undefined) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE orders SET purchase_price = $1, updated_at = NOW() WHERE id = $2`,
        [purchasePrice, orderId]
      );

      return NextResponse.json({
        success: true,
        data: { orderId, purchasePrice }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update purchase price error:', error);
    return NextResponse.json(
      { success: false, error: '更新采购价失败' },
      { status: 500 }
    );
  }
}

// 批量更新采购价
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { orders } = body; // [{ orderId, purchasePrice }, ...]

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json(
        { success: false, error: '缺少订单数据' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const results = [];
      for (const order of orders) {
        await client.query(
          `UPDATE orders SET purchase_price = $1, updated_at = NOW() WHERE id = $2`,
          [order.purchasePrice, order.orderId]
        );
        results.push(order);
      }

      return NextResponse.json({
        success: true,
        data: { updated: results.length }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Batch update purchase price error:', error);
    return NextResponse.json(
      { success: false, error: '批量更新采购价失败' },
      { status: 500 }
    );
  }
}
