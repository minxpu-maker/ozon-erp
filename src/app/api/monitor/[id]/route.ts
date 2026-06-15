import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { sql } from 'drizzle-orm';

// GET /api/monitor/[id] - 获取单个监控商品详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const monitor = await db.execute(sql`
      SELECT * FROM product_monitor 
      WHERE product_id = ${id} OR id = ${parseInt(id) || 0}
      LIMIT 1
    `) as unknown as any[];

    if (monitor.length === 0) {
      return NextResponse.json({ success: false, error: '监控不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: monitor[0].id,
        productId: monitor[0].product_id,
        productTitle: monitor[0].product_title,
        imageUrl: monitor[0].image_url,
        currentPrice: monitor[0].current_price,
        currentSales: monitor[0].current_sales,
        lastPrice: monitor[0].last_price,
        lastSales: monitor[0].last_sales,
        priceChange: monitor[0].price_change,
        salesChange: monitor[0].sales_change,
        platform: monitor[0].platform,
        createdAt: monitor[0].created_at,
        updatedAt: monitor[0].updated_at,
      }
    });
  } catch (error) {
    console.error('获取监控详情失败:', error);
    return NextResponse.json({ success: false, error: '获取监控详情失败' }, { status: 500 });
  }
}

// PUT /api/monitor/[id] - 更新监控状态（标记已读等）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { alertRead } = body;
    
    if (alertRead !== undefined) {
      await db.execute(sql`
        UPDATE product_monitor SET
          updated_at = NOW()
        WHERE product_id = ${id} OR id = ${parseInt(id) || 0}
      `);
    }

    return NextResponse.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新监控失败:', error);
    return NextResponse.json({ success: false, error: '更新监控失败' }, { status: 500 });
  }
}

// DELETE /api/monitor/[id]? - 取消监控
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const productId = searchParams.get('productId');

    if (id && id !== 'undefined') {
      // 优先使用路径参数id
      await db.execute(sql`DELETE FROM product_monitor WHERE id = ${parseInt(id)}`);
    } else if (productId) {
      await db.execute(sql`DELETE FROM product_monitor WHERE product_id = ${productId}`);
    } else {
      return NextResponse.json({ success: false, error: '缺少id或productId' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: '已取消监控' });
  } catch (error) {
    console.error('取消监控失败:', error);
    return NextResponse.json({ success: false, error: '取消监控失败' }, { status: 500 });
  }
}
