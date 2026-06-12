import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { desc, eq, and, sql, inArray } from 'drizzle-orm';

// GET /api/selection/opportunities - 获取选品单列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId');
    const mode = searchParams.get('mode'); // copy跟卖 / refine精铺
    const status = searchParams.get('status');
    const categoryId = searchParams.get('categoryId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const conditions = [];
    if (shopId) conditions.push(eq(schema.opportunities.shopId, shopId));
    if (mode) conditions.push(eq(schema.opportunities.selectionMode, mode));
    if (status) conditions.push(eq(schema.opportunities.status, status));
    if (categoryId) conditions.push(eq(schema.opportunities.targetCategoryId, parseInt(categoryId)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      db.select()
        .from(schema.opportunities)
        .where(whereClause)
        .orderBy(desc(schema.opportunities.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(schema.opportunities)
        .where(whereClause)
    ]);

    const total = Number(totalResult[0]?.count || 0);

    // 获取关联的市场信号图片和数据
    const signalIds = items
      .filter(item => item.marketSignalId)
      .map(item => item.marketSignalId);
    
    let signalImages: Record<number, { imageUrl: string; sourceType: string }> = {};
    // 过滤掉null值
    const validSignalIds = signalIds.filter((id): id is number => id !== null);
    
    if (validSignalIds.length > 0) {
      try {
        const signals = await db.select({
          id: schema.marketSignals.id,
          imageUrl: schema.marketSignals.imageUrl,
          sourceType: schema.marketSignals.sourceType,
        })
          .from(schema.marketSignals)
          .where(inArray(schema.marketSignals.id, validSignalIds));
        
        // 建立信号ID到图片和来源的映射（即使imageUrl为null也要获取sourceType）
        signals.forEach(signal => {
          signalImages[signal.id] = {
            imageUrl: signal.imageUrl || '',
            sourceType: signal.sourceType,
          };
        });
      } catch (err) {
        console.error('[API] 获取市场信号图片失败:', err);
      }
    }

    // 将图片和来源信息添加到返回数据
    const itemsWithImages = items.map(item => ({
      ...item,
      targetImage: item.targetImage || (item.marketSignalId ? signalImages[item.marketSignalId]?.imageUrl : null),
      signalSourceType: item.marketSignalId ? signalImages[item.marketSignalId]?.sourceType : null
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: itemsWithImages,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[API] 获取选品单列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取选品单列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/selection/opportunities - 创建新选品单
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      shopId,
      mode,
      selectionMode,  // 支持两种参数名
      targetCategoryId,
      targetProductId,
      targetName,
      targetImage,
      source,
      targetType,
      marketSignalId,  // 新增：关联市场信号
      marketAnalysis,
      profitEstimate,
      riskFlags,
      assignedTo,
      notes,
      status  // 新增：支持自定义状态
    } = body;

    // 支持两种参数名：mode 或 selectionMode
    const finalMode = mode || selectionMode;

    if (!shopId || !finalMode) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: shopId, selectionMode' },
        { status: 400 }
      );
    }

    const [opportunity] = await db.insert(schema.opportunities)
      .values({
        shopId,
        source: source || 'manual',
        selectionMode: finalMode,
        targetType: targetType || 'product',
        targetCategoryId: targetCategoryId ? parseInt(targetCategoryId) : null,
        targetProductId: targetProductId ? parseInt(targetProductId) : null,
        targetName: targetName || null,
        targetImage: targetImage || null,
        marketSignalId: marketSignalId || null,
        marketAnalysis: marketAnalysis || null,
        profitEstimate: profitEstimate || null,
        riskFlags: riskFlags || null,
        status: status || 'discovered',
        assignedTo: assignedTo || null,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: opportunity
    });
  } catch (error) {
    console.error('[API] 创建选品单失败:', error);
    return NextResponse.json(
      { success: false, error: '创建选品单失败' },
      { status: 500 }
    );
  }
}
