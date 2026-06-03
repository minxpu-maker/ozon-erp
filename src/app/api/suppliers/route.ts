import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, desc, like } from 'drizzle-orm';

// 获取供应商列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword');
    const platform = searchParams.get('platform');

    const suppliers = await db.select().from(schema.suppliers)
      .orderBy(desc(schema.suppliers.created_at));

    return NextResponse.json({ success: true, data: suppliers });
  } catch (error) {
    console.error('获取供应商失败:', error);
    return NextResponse.json({ success: false, error: '获取供应商失败' }, { status: 500 });
  }
}

// 创建供应商
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, platform, contactName, contactPhone, contactWechat, shopUrl, shopName, rating } = body;

    const [supplier] = await db.insert(schema.suppliers).values({
      name: name || '',
      platform: platform || '1688',
      contact_name: contactName || null,
      contact_phone: contactPhone || null,
      contact_wechat: contactWechat || null,
      shop_url: shopUrl || null,
      shop_name: shopName || null,
      rating: rating || '3.0',
      is_active: true,
    }).returning();

    return NextResponse.json({ success: true, data: supplier, message: '供应商创建成功' });
  } catch (error) {
    console.error('创建供应商失败:', error);
    return NextResponse.json({ success: false, error: '创建供应商失败' }, { status: 500 });
  }
}
