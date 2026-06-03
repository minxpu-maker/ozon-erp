import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, desc, like, or } from 'drizzle-orm';

// 获取SKU列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword');
    const category = searchParams.get('category');

    let query = db.select().from(schema.skus);

    const conditions = [];
    if (keyword) {
      conditions.push(like(schema.skus.sku_code, `%${keyword}%`));
      conditions.push(like(schema.skus.name, `%${keyword}%`));
    }
    if (category) {
      conditions.push(eq(schema.skus.category, category));
    }

    const skus = await db.select().from(schema.skus)
      .orderBy(desc(schema.skus.created_at));

    return NextResponse.json({ success: true, data: skus });
  } catch (error) {
    console.error('获取SKU失败:', error);
    return NextResponse.json({ success: false, error: '获取SKU失败' }, { status: 500 });
  }
}

// 创建SKU
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skuCode, name, category, description, ozonOfferId, defaultSourceType, defaultSourceUrl, defaultSourcePrice } = body;

    const [sku] = await db.insert(schema.skus).values({
      sku_code: skuCode || '',
      name: name || '',
      category: category || null,
      description: description || null,
      ozon_offer_id: ozonOfferId || null,
      default_source_type: defaultSourceType || null,
      default_source_url: defaultSourceUrl || null,
      default_source_price: defaultSourcePrice || null,
      is_active: true,
      is_stocked: false,
      safety_stock: 0,
    }).returning();

    return NextResponse.json({ success: true, data: sku, message: 'SKU创建成功' });
  } catch (error) {
    console.error('创建SKU失败:', error);
    return NextResponse.json({ success: false, error: '创建SKU失败' }, { status: 500 });
  }
}
