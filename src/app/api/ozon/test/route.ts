/**
 * Ozon API 连通性测试
 * GET /api/ozon/test - 测试 API 连接
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCategoryTree } from '@/lib/ozon/endpoints/category';
import { getTariffList } from '@/lib/ozon/endpoints/logistics';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const shopId = searchParams.get('shopId');
  
  try {
    // 如果没有指定 shopId，获取主店铺
    let targetShopId = shopId;
    
    if (!targetShopId) {
      const primaryShop = await db.query.shops.findFirst({
        where: eq(shops.isPrimary, true),
        columns: { id: true, name: true },
      });
      
      if (!primaryShop) {
        return NextResponse.json({
          success: false,
          error: 'No primary shop found',
        }, { status: 400 });
      }
      
      targetShopId = primaryShop.id;
    }
    
    console.log(`[Ozon Test] Testing connection for shop: ${targetShopId}`);
    
    // 测试 1: 获取类目树
    const startTime1 = Date.now();
    let categoryTree: Awaited<ReturnType<typeof getCategoryTree>> | undefined;
    let categoryError: string | undefined;
    
    try {
      categoryTree = await getCategoryTree(targetShopId);
    } catch (e) {
      categoryError = e instanceof Error ? e.message : String(e);
    }
    
    const categoryTime = Date.now() - startTime1;
    
    // 测试 2: 获取物流模板
    const startTime2 = Date.now();
    let tariffs: Awaited<ReturnType<typeof getTariffList>> | undefined;
    let tariffError: string | undefined;
    
    try {
      tariffs = await getTariffList(targetShopId);
    } catch (e) {
      tariffError = e instanceof Error ? e.message : String(e);
    }
    
    const tariffTime = Date.now() - startTime2;
    
    // 构建结果
    const result = {
      success: !categoryError && !tariffError,
      shopId: targetShopId,
      tests: {
        categoryTree: {
          success: !categoryError,
          time: categoryTime,
          count: categoryTree?.length || 0,
          sample: categoryTree?.slice(0, 3).map(c => ({
            id: c.category_id,
            name: c.category_name,
            children: c.children?.length || 0,
          })),
          error: categoryError,
        },
        tariffs: {
          success: !tariffError,
          time: tariffTime,
          count: tariffs?.length || 0,
          sample: tariffs?.slice(0, 3).map(t => ({
            id: t.id,
            name: t.name,
            type: t.type,
          })),
          error: tariffError,
        },
      },
    };
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[Ozon Test] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
