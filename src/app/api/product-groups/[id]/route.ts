import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';

// 获取单个分组
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [group] = await db
      .select()
      .from(schema.productGroups)
      .where(eq(schema.productGroups.id, parseInt(id)));

    if (!group) {
      return NextResponse.json(
        { success: false, error: '分组不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: group
    });
  } catch (error) {
    console.error('获取分组失败:', error);
    return NextResponse.json(
      { success: false, error: '获取分组失败' },
      { status: 500 }
    );
  }
}

// 更新分组
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: '分组名称不能为空' },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(schema.productGroups)
      .set({ name })
      .where(eq(schema.productGroups.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: '分组不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('更新分组失败:', error);
    return NextResponse.json(
      { success: false, error: '更新分组失败' },
      { status: 500 }
    );
  }
}

// 删除分组
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db
      .delete(schema.productGroups)
      .where(eq(schema.productGroups.id, parseInt(id)));

    return NextResponse.json({
      success: true,
      message: '分组已删除'
    });
  } catch (error) {
    console.error('删除分组失败:', error);
    return NextResponse.json(
      { success: false, error: '删除分组失败' },
      { status: 500 }
    );
  }
}
