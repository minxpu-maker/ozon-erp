import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, desc } from 'drizzle-orm';

// 获取角色列表
export async function GET(request: NextRequest) {
  try {
    const roles = await db.select().from(schema.roles)
      .orderBy(desc(schema.roles.level));

    return NextResponse.json({ success: true, data: roles });
  } catch (error) {
    console.error('获取角色失败:', error);
    return NextResponse.json({ success: false, error: '获取角色失败' }, { status: 500 });
  }
}

// 创建角色
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, level, permissions, description } = body;

    const [role] = await db.insert(schema.roles).values({
      name: name || '',
      code: code || '',
      level: level || 0,
      description: description || null,
      permissions: permissions || null,
      is_system: false,
      is_active: true,
    }).returning();

    return NextResponse.json({ success: true, data: role, message: '角色创建成功' });
  } catch (error) {
    console.error('创建角色失败:', error);
    return NextResponse.json({ success: false, error: '创建角色失败' }, { status: 500 });
  }
}
