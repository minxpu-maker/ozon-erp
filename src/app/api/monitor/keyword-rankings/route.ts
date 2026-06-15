import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { sql } from 'drizzle-orm';

// 获取关键词排名列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monitorItemId = searchParams.get('monitorItemId');
    const keyword = searchParams.get('keyword');
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '100');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let whereClause = `WHERE mkr.captured_at >= '${startDate.toISOString()}'`;
    
    if (monitorItemId) {
      whereClause += ` AND mkr.monitor_item_id = ${parseInt(monitorItemId)}`;
    }
    
    if (keyword) {
      whereClause += ` AND LOWER(mkr.keyword) LIKE LOWER('%${keyword}%')`;
    }

    const query = `
      SELECT 
        mkr.id,
        mkr.keyword,
        mkr.rank_position,
        mkr.page,
        mkr.captured_at,
        mkr.monitor_item_id,
        mi.signal_id,
        ms.ozon_product_id,
        ms.product_title,
        ms.image_url,
        ms.current_price
      FROM monitor_keyword_rankings mkr
      LEFT JOIN monitor_items mi ON mkr.monitor_item_id = mi.id
      LEFT JOIN market_signals ms ON mi.signal_id = ms.id
      ${whereClause}
      ORDER BY mkr.captured_at DESC
      LIMIT ${limit}
    `;

    const result = await db.execute(sql`${sql.raw(query)}`);
    const rows = (result as any).rows || [];

    return NextResponse.json({
      success: true,
      data: rows.map((row: any) => ({
        id: row.id,
        keyword: row.keyword,
        rankPosition: row.rank_position,
        page: row.page,
        capturedAt: row.captured_at,
        monitorItemId: row.monitor_item_id,
        productId: row.ozon_product_id,
        productTitle: row.product_title,
        productImage: row.image_url,
        currentPrice: row.current_price
      })),
      total: rows.length
    });
  } catch (error) {
    console.error('获取关键词排名失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// 推送关键词排名
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { monitorItemId, keyword, rank, page } = body;

    if (!monitorItemId || !keyword) {
      return NextResponse.json(
        { error: '缺少必填参数: monitorItemId, keyword' },
        { status: 400 }
      );
    }

    const mid = parseInt(monitorItemId);
    const kw = keyword.trim();
    const rk = rank !== undefined ? parseInt(rank) : null;
    const pg = page !== undefined ? parseInt(page) : null;

    // 先插入（不使用 RETURNING）
    await db.execute(sql`
      INSERT INTO monitor_keyword_rankings (monitor_item_id, keyword, rank_position, page, captured_at)
      VALUES (${mid}, ${kw}, ${rk}, ${pg}, NOW())
    `);

    // 查询获取刚插入的数据
    const result = await db.execute(sql`
      SELECT id, keyword, rank_position, page, captured_at 
      FROM monitor_keyword_rankings 
      WHERE monitor_item_id = ${mid} AND keyword = ${kw}
      ORDER BY captured_at DESC LIMIT 1
    `);

    // drizzle-orm 返回 { command, rowCount, rows, ... }
    const rows = (result as any).rows || [];
    if (rows.length === 0) {
      return NextResponse.json({ error: '插入后查询失败' }, { status: 500 });
    }

    const inserted = rows[0];
    return NextResponse.json({
      success: true,
      data: {
        id: inserted.id,
        keyword: inserted.keyword,
        rankPosition: inserted.rank_position,
        page: inserted.page,
        capturedAt: inserted.captured_at
      }
    });
  } catch (error) {
    console.error('保存关键词排名失败:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

// 批量推送关键词排名
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { rankings } = body;

    if (!rankings || !Array.isArray(rankings)) {
      return NextResponse.json(
        { error: '缺少参数: rankings (数组)' },
        { status: 400 }
      );
    }

    const results: { monitorItemId: number; keyword: string; status: string }[] = [];
    const errors: { item: any; error: string }[] = [];

    for (const item of rankings) {
      const { monitorItemId, keyword, rank, page } = item;

      if (!monitorItemId || !keyword) {
        errors.push({ item, error: '缺少必填参数' });
        continue;
      }

      try {
        const mid = parseInt(monitorItemId);
        const kw = keyword.trim();
        const rk = rank !== undefined ? parseInt(rank) : null;
        const pg = page !== undefined ? parseInt(page) : null;

        await db.execute(sql`
          INSERT INTO monitor_keyword_rankings (monitor_item_id, keyword, rank_position, page, captured_at)
          VALUES (${mid}, ${kw}, ${rk}, ${pg}, NOW())
        `);
        results.push({ monitorItemId: mid, keyword: kw, status: 'ok' });
      } catch (err) {
        errors.push({ item, error: String(err) });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        inserted: results.length,
        errorCount: errors.length,
        results,
        errors
      }
    });
  } catch (error) {
    console.error('批量保存关键词排名失败:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

// 删除关键词排名
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const keyword = searchParams.get('keyword');
    const monitorItemId = searchParams.get('monitorItemId');
    const olderThan = searchParams.get('olderThan'); // 天数

    if (!id && !keyword && !monitorItemId) {
      return NextResponse.json(
        { error: '缺少参数: id, keyword 或 monitorItemId' },
        { status: 400 }
      );
    }

    let whereClause = 'WHERE 1=1';
    
    if (id) {
      whereClause += ` AND id = ${parseInt(id)}`;
    }
    if (keyword) {
      whereClause += ` AND LOWER(keyword) = LOWER('${keyword.trim()}')`;
    }
    if (monitorItemId) {
      whereClause += ` AND monitor_item_id = ${parseInt(monitorItemId)}`;
    }
    if (olderThan) {
      const date = new Date();
      date.setDate(date.getDate() - parseInt(olderThan));
      whereClause += ` AND captured_at < '${date.toISOString()}'`;
    }

    const result = await db.execute(sql`DELETE FROM monitor_keyword_rankings ${sql.raw(whereClause)}`);
    const rowCount = (result as any).rowCount || 0;

    return NextResponse.json({
      success: true,
      deleted: rowCount
    });
  } catch (error) {
    console.error('删除关键词排名失败:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
