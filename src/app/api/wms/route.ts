import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, desc } from 'drizzle-orm';

// 获取仓库列表
export async function GET(request: NextRequest) {
  try {
    const warehouses = await db.select().from(schema.warehouses);
    return NextResponse.json({ success: true, data: warehouses });
  } catch (error) {
    console.error('获取仓库失败:', error);
    return NextResponse.json({ success: false, error: '获取仓库失败' }, { status: 500 });
  }
}

// 创建仓库
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, address, isDefault } = body;

    const [warehouse] = await db.insert(schema.warehouses).values({
      name: name || '',
      code: code || '',
      address: address || null,
      is_default: isDefault || false,
    }).returning();

    return NextResponse.json({ success: true, data: warehouse, message: '仓库创建成功' });
  } catch (error) {
    console.error('创建仓库失败:', error);
    return NextResponse.json({ success: false, error: '创建仓库失败' }, { status: 500 });
  }
}
