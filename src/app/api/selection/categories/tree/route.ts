import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';
import { getCategoryTree } from '@/lib/ozon';

// GET /api/selection/categories/tree - 获取类目树
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId');
    const useCache = searchParams.get('cache') !== 'false';

    if (!shopId) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数: shopId' },
        { status: 400 }
      );
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
