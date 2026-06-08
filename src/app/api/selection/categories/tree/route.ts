import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';
import { getCategoryTree } from '@/lib/ozon';

// Mock category tree for fallback
const mockCategoryTree = [
  {
    category_id: 100,
    category_name: '服装配饰',
    disabled: false,
    children: [
      { category_id: 101, category_name: '女装', disabled: false },
      { category_id: 102, category_name: '男装', disabled: false },
      { category_id: 103, category_name: '童装', disabled: false },
    ]
  },
  {
    category_id: 200,
    category_name: '电子产品',
    disabled: false,
    children: [
      { category_id: 201, category_name: '手机配件', disabled: false },
      { category_id: 202, category_name: '智能设备', disabled: false },
      { category_id: 203, category_name: '耳机音箱', disabled: false },
    ]
  },
  {
    category_id: 300,
    category_name: '家居用品',
    disabled: false,
    children: [
      { category_id: 301, category_name: '厨房用品', disabled: false },
      { category_id: 302, category_name: '收纳整理', disabled: false },
      { category_id: 303, category_name: '家纺用品', disabled: false },
    ]
  },
  {
    category_id: 400,
    category_name: '美妆个护',
    disabled: false,
    children: [
      { category_id: 401, category_name: '护肤', disabled: false },
      { category_id: 402, category_name: '彩妆', disabled: false },
      { category_id: 403, category_name: '香水', disabled: false },
    ]
  },
  {
    category_id: 500,
    category_name: '运动户外',
    disabled: false,
    children: [
      { category_id: 501, category_name: '运动服饰', disabled: false },
      { category_id: 502, category_name: '户外装备', disabled: false },
    ]
  },
];

// GET /api/selection/categories/tree - 获取类目树
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId');
    const useCache = searchParams.get('cache') !== 'false';

    // 如果没有提供shopId，返回模拟数据
    if (!shopId) {
      return NextResponse.json({
        success: true,
        data: mockCategoryTree,
        fromCache: false,
        mock: true
      });
    }

    // 尝试从缓存读取
    if (useCache) {
      const [cached] = await db.select()
        .from(schema.ozonKnowledgeCache)
        .where(eq(schema.ozonKnowledgeCache.domain, 'category_tree'));

      if (cached && cached.data && cached.syncedAt) {
        const cacheAge = Date.now() - new Date(cached.syncedAt).getTime();
        // 缓存有效期：24小时
        if (cacheAge < 24 * 60 * 60 * 1000) {
          return NextResponse.json({
            success: true,
            data: cached.data,
            fromCache: true
          });
        }
      }
    }

    // 调用Ozon API获取类目树
    const categoryTree = await getCategoryTree(shopId);

    // 更新缓存
    await db.insert(schema.ozonKnowledgeCache)
      .values({
        domain: 'category_tree',
        data: categoryTree as unknown as Record<string, unknown>,
        dataHash: 'computed_hash',
        syncedAt: new Date(),
        syncSource: 'ozon_api',
        apiEndpoint: '/v1/description-category/tree',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [schema.ozonKnowledgeCache.domain],
        set: {
          data: categoryTree as unknown as Record<string, unknown>,
          syncedAt: new Date(),
          updatedAt: new Date()
        }
      });

    return NextResponse.json({
      success: true,
      data: categoryTree,
      fromCache: false
    });
  } catch (error) {
    console.error('[API] 获取类目树失败:', error);
    return NextResponse.json(
      { success: false, error: '获取类目树失败' },
      { status: 500 }
    );
  }
}
