import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, desc } from 'drizzle-orm';

// 获取账号列表
export async function GET(request: NextRequest) {
  try {
    const accounts = await db.select({
      account: schema.accounts,
      role: schema.roles,
    }).from(schema.accounts)
      .leftJoin(schema.roles, eq(schema.accounts.role_id, schema.roles.id))
      .orderBy(desc(schema.accounts.created_at));

    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    console.error('获取账号失败:', error);
    return NextResponse.json({ success: false, error: '获取账号失败' }, { status: 500 });
  }
}

// 创建账号
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, roleId } = body;

    const [account] = await db.insert(schema.accounts).values({
      name: name || '',
      phone: phone || '',
      role_id: roleId || null,
      is_active: true,
    }).returning();

    return NextResponse.json({ success: true, data: account, message: '账号创建成功' });
  } catch (error) {
    console.error('创建账号失败:', error);
    return NextResponse.json({ success: false, error: '创建账号失败' }, { status: 500 });
  }
}
