import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/storage/database/client';

// 获取单个店铺监控
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();
  try {
    const { id } = await params;

    const result = await client.query(`
      SELECT 
        ms.id,
        ms.seller_name,
        ms.platform,
        ms.status,
        ms.created_at,
        COUNT(DISTINCT msi.id) as monitored_products
      FROM monitor_shop ms
      LEFT JOIN market_signals msi ON msi.seller_name = ms.seller_name AND msi.source_type = ms.platform
      WHERE ms.id = $1
      GROUP BY ms.id, ms.seller_name, ms.platform, ms.status, ms.created_at
    `, [parseInt(id)]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '店铺监控不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });

  } catch (error) {
    console.error('获取店铺监控失败:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// 更新店铺监控
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, sellerName, platform } = body;

    // 构建更新字段
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (sellerName !== undefined) {
      updates.push(`seller_name = $${paramIndex++}`);
      values.push(sellerName);
    }
    if (platform !== undefined) {
      updates.push(`platform = $${paramIndex++}`);
      values.push(platform);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有需要更新的字段' },
        { status: 400 }
      );
    }

    values.push(parseInt(id));

    const result = await client.query(`
      UPDATE monitor_shop
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, seller_name, platform, status, created_at
    `, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '店铺监控不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });

  } catch (error) {
    console.error('更新店铺监控失败:', error);
    return NextResponse.json(
      { success: false, error: '更新失败' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// 删除店铺监控
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();
  try {
    const { id } = await params;

    // 软删除：将状态改为 removed
    const result = await client.query(`
      UPDATE monitor_shop
      SET status = 'removed'
      WHERE id = $1
      RETURNING id, seller_name, status
    `, [parseInt(id)]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '店铺监控不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });

  } catch (error) {
    console.error('删除店铺监控失败:', error);
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
