import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';
import { getCategoryTree } from '@/lib/ozon';

// POST /api/infra/knowledge-cache/sync - 同步知识库
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shopId, domain } = body;

    if (!shopId || !domain) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数: shopId, domain' },
        { status: 400 }
      );
    }

    let syncResult;

    // 根据domain同步不同的数据
    switch (domain) {
      case 'category_tree': {
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

        syncResult = { domain, count: categoryTree.length };
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `未知的同步域: ${domain}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: syncResult
    });
  } catch (error) {
    console.error('[API] 同步知识库失败:', error);
    return NextResponse.json(
      { success: false, error: '同步知识库失败' },
      { status: 500 }
    );
  }
}
