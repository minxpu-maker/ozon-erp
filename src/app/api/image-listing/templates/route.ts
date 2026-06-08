import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { desc, eq, and } from 'drizzle-orm';

// GET /api/image-listing/templates - 获取修图模板列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');

    const conditions = [];
    if (type) conditions.push(eq(schema.imageTemplates.type, type));
    if (isActive !== null) conditions.push(eq(schema.imageTemplates.isActive, isActive === 'true'));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const templates = await db.select()
      .from(schema.imageTemplates)
      .where(whereClause)
      .orderBy(desc(schema.imageTemplates.createdAt));

    return NextResponse.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('[API] 获取修图模板列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取修图模板列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/image-listing/templates - 创建新模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, config, ozonSpec, previewImageKey, applicableCategoryIds } = body;

    if (!name || !type || !config) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: name, type, config' },
        { status: 400 }
      );
    }

    const [template] = await db.insert(schema.imageTemplates)
      .values({
        name,
        type,
        config: config as Record<string, unknown>,
        ozonSpec: ozonSpec || null,
        previewImageKey: previewImageKey || null,
        applicableCategoryIds: applicableCategoryIds || null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('[API] 创建修图模板失败:', error);
    return NextResponse.json(
      { success: false, error: '创建修图模板失败' },
      { status: 500 }
    );
  }
}
