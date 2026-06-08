import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { desc, eq, and } from 'drizzle-orm';

// GET /api/selection/rules - 获取选品规则配置
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId');
    const isActive = searchParams.get('isActive');

    const conditions = [];
    if (shopId) conditions.push(eq(schema.selectionStrategyTemplates.shopId, shopId));
    if (isActive !== null) conditions.push(eq(schema.selectionStrategyTemplates.isActive, isActive === 'true'));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rules = await db.select()
      .from(schema.selectionStrategyTemplates)
      .where(whereClause)
      .orderBy(desc(schema.selectionStrategyTemplates.isDefault), desc(schema.selectionStrategyTemplates.createdAt));

    return NextResponse.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('[API] 获取选品规则失败:', error);
    return NextResponse.json(
      { success: false, error: '获取选品规则失败' },
      { status: 500 }
    );
  }
}

// POST /api/selection/rules - 创建新规则模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      shopId,
      name,
      selectionMode,
      ahpConfig,
      hardConstraints,
      priceRangeMin,
      priceRangeMax,
      isDefault
    } = body;

    if (!name || !selectionMode) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: name, selectionMode' },
        { status: 400 }
      );
    }

    // 如果设为默认，先取消其他默认规则
    if (isDefault && shopId) {
      await db.update(schema.selectionStrategyTemplates)
        .set({ isDefault: false })
        .where(eq(schema.selectionStrategyTemplates.shopId, shopId));
    }

    const [rule] = await db.insert(schema.selectionStrategyTemplates)
      .values({
        shopId: shopId || null,
        name,
        selectionMode,
        ahpConfig: ahpConfig || null,
        hardConstraints: hardConstraints || null,
        priceRangeMin: priceRangeMin ? parseInt(priceRangeMin) : null,
        priceRangeMax: priceRangeMax ? parseInt(priceRangeMax) : null,
        isDefault: isDefault || false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('[API] 创建选品规则失败:', error);
    return NextResponse.json(
      { success: false, error: '创建选品规则失败' },
      { status: 500 }
    );
  }
}
