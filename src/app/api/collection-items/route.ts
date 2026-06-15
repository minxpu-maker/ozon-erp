import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { collectionItems, marketSignals, shops } from '@/storage/database/shared/schema';
import { eq, desc, and, sql, count } from 'drizzle-orm';

/**
 * GET /api/collection-items
 * 获取采集箱列表
 * Query: status, shopId, page, pageSize, search
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const shopId = searchParams.get('shopId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search');
    
    const offset = (page - 1) * pageSize;
    
    // 构建查询条件
    const conditions = [];
    if (status) {
      conditions.push(eq(collectionItems.status, status));
    }
    if (shopId) {
      conditions.push(eq(collectionItems.shopId, shopId));
    }
    
    // 构建完整查询
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // 查询列表（关联marketSignals）
    const items = await db
      .select({
        id: collectionItems.id,
        status: collectionItems.status,
        priority: collectionItems.priority,
        tags: collectionItems.tags,
        notes: collectionItems.notes,
        claimedAt: collectionItems.claimedAt,
        publishedAt: collectionItems.publishedAt,
        publishStatus: collectionItems.publishStatus,
        createdAt: collectionItems.createdAt,
        editedData: collectionItems.editedData,
        // 关联的市场信号
        signal: {
          id: marketSignals.id,
          productId: marketSignals.productId,
          productTitle: marketSignals.productTitle,
          productUrl: marketSignals.productUrl,
          imageUrl: marketSignals.imageUrl,
          price: marketSignals.price,
          salesVolume: marketSignals.salesVolume,
          rating: marketSignals.rating,
          reviewsCount: marketSignals.reviewsCount,
          sellerName: marketSignals.sellerName,
          sellerType: marketSignals.sellerType,
          deliveryType: marketSignals.deliveryType,
          weight: marketSignals.weight,
          categoryPath: marketSignals.categoryPath,
          categoryName: marketSignals.categoryName,
          sourceType: marketSignals.sourceType,
          profitRate: marketSignals.profitRate,
          revenue: marketSignals.revenue,
        },
      })
      .from(collectionItems)
      .leftJoin(marketSignals, eq(collectionItems.signalId, marketSignals.id))
      .where(whereClause)
      .orderBy(desc(collectionItems.createdAt))
      .limit(pageSize)
      .offset(offset);
    
    // 查询总数
    const [{ total }] = await db
      .select({ total: count() })
      .from(collectionItems)
      .where(whereClause);
    
    // 查询统计
    const stats = await db
      .select({
        status: collectionItems.status,
        count: count(),
      })
      .from(collectionItems)
      .groupBy(collectionItems.status);
    
    const statsMap = {
      pending: 0,
      claimed: 0,
      published: 0,
      rejected: 0,
    };
    stats.forEach(s => {
      if (s.status in statsMap) {
        statsMap[s.status as keyof typeof statsMap] = Number(s.count);
      }
    });
    
    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          pageSize,
          total: Number(total),
          totalPages: Math.ceil(Number(total) / pageSize),
        },
        stats: {
          ...statsMap,
          total: Number(total),
        },
      },
    });
  } catch (error) {
    console.error('获取采集箱列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/collection-items
 * 创建采集箱条目（从信号创建）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signalId, shopId, tags, notes } = body;
    
    if (!signalId) {
      return NextResponse.json(
        { success: false, error: '缺少signalId' },
        { status: 400 }
      );
    }
    
    // 检查是否已存在
    const existing = await db
      .select({ id: collectionItems.id })
      .from(collectionItems)
      .where(eq(collectionItems.signalId, signalId))
      .limit(1);
    
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: '该商品已在采集箱中' },
        { status: 400 }
      );
    }
    
    // 创建新条目
    const [newItem] = await db
      .insert(collectionItems)
      .values({
        signalId,
        shopId,
        status: 'pending',
        tags: tags || [],
        notes,
      })
      .returning();
    
    return NextResponse.json({
      success: true,
      data: newItem,
    });
  } catch (error) {
    console.error('创建采集箱条目失败:', error);
    return NextResponse.json(
      { success: false, error: '创建失败' },
      { status: 500 }
    );
  }
}
