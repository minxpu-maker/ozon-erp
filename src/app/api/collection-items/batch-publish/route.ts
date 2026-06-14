import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { collectionItems } from '@/storage/database/shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * POST /api/collection-items/batch-publish
 * 批量发布到Ozon
 * Body: { itemIds: number[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemIds } = body;
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少itemIds参数' },
        { status: 400 }
      );
    }
    
    // 查询待发布的条目
    const items = await db
      .select()
      .from(collectionItems)
      .where(
        and(
          inArray(collectionItems.id, itemIds),
          eq(collectionItems.status, 'claimed')
        )
      );
    
    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有可发布的条目（需要先认领）' },
        { status: 400 }
      );
    }
    
    const results = {
      success: 0,
      failed: 0,
      failedItems: [] as { id: number; error: string }[],
    };
    
    // 逐个调用发布API（实际项目中应该异步并行调用）
    for (const item of items) {
      try {
        // 调用单个发布API
        const publishResponse = await fetch(
          `${process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'}/api/products/publish`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // 生产环境需要添加认证header
            },
            body: JSON.stringify({ collectionItemId: item.id }),
          }
        );
        
        if (publishResponse.ok) {
          results.success++;
        } else {
          results.failed++;
          const errorData = await publishResponse.json();
          results.failedItems.push({
            id: item.id,
            error: errorData.error || '发布失败',
          });
        }
      } catch (err) {
        results.failed++;
        results.failedItems.push({
          id: item.id,
          error: err instanceof Error ? err.message : '未知错误',
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        total: items.length,
        ...results,
      },
    });
  } catch (error) {
    console.error('批量发布失败:', error);
    return NextResponse.json(
      { success: false, error: '批量发布失败' },
      { status: 500 }
    );
  }
}
