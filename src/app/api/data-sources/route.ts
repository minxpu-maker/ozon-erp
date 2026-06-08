import { NextRequest, NextResponse } from 'next/server';
import {
  fetchOzonProducts,
  fetchOzonCategories,
  fetchOzonCategoryAttributes,
  searchAliexpressProducts,
  search1688Products,
  fetchCustomsData,
  fetchMultiSourceData,
  calculateDemandScore,
  calculateSupplyScore
} from '@/lib/data-source-service';

/**
 * 数据源统一API
 * 
 * GET /api/data-sources?action=xxx&shopId=xxx
 * 
 * actions:
 * - ozon-products: 获取Ozon商品列表
 * - ozon-categories: 获取Ozon类目树
 * - ozon-attributes: 获取Ozon类目属性
 * - aliexpress-search: 搜索速卖通商品
 * - 1688-search: 搜索1688商品
 * - customs: 查询海关数据
 * - multi: 批量获取多源数据
 * - demand-score: 计算需求端评分
 * - supply-score: 计算供给端评分
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const shopId = searchParams.get('shopId') || 'default';

  try {
    switch (action) {
      case 'ozon-products': {
        const categoryId = searchParams.get('categoryId');
        const result = await fetchOzonProducts(shopId, categoryId ? { categoryId: parseInt(categoryId) } : undefined);
        return NextResponse.json({ success: result.success, data: result.data, error: result.error });
      }

      case 'ozon-categories': {
        const categoryId = searchParams.get('categoryId');
        const result = await fetchOzonCategories(shopId, categoryId ? parseInt(categoryId) : undefined);
        return NextResponse.json({ success: result.success, data: result.data, error: result.error });
      }

      case 'ozon-attributes': {
        const categoryId = searchParams.get('categoryId');
        if (!categoryId) {
          return NextResponse.json({ success: false, error: '缺少categoryId参数' }, { status: 400 });
        }
        const result = await fetchOzonCategoryAttributes(shopId, parseInt(categoryId));
        return NextResponse.json({ success: result.success, data: result.data, error: result.error });
      }

      case 'aliexpress-search': {
        const keyword = searchParams.get('keyword');
        if (!keyword) {
          return NextResponse.json({ success: false, error: '缺少keyword参数' }, { status: 400 });
        }
        const result = await searchAliexpressProducts(keyword, {
          categoryId: searchParams.get('categoryId') || undefined,
          minPrice: searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined,
          maxPrice: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined
        });
        return NextResponse.json({ success: result.success, data: result.data, error: result.error });
      }

      case '1688-search': {
        const keyword = searchParams.get('keyword');
        if (!keyword) {
          return NextResponse.json({ success: false, error: '缺少keyword参数' }, { status: 400 });
        }
        const result = await search1688Products(keyword, {
          categoryId: searchParams.get('categoryId') || undefined,
          minPrice: searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined,
          maxPrice: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined
        });
        return NextResponse.json({ success: result.success, data: result.data, error: result.error });
      }

      case 'customs': {
        const hsCode = searchParams.get('hsCode');
        if (!hsCode) {
          return NextResponse.json({ success: false, error: '缺少hsCode参数' }, { status: 400 });
        }
        const result = await fetchCustomsData(hsCode);
        return NextResponse.json({ success: result.success, data: result.data, error: result.error });
      }

      case 'multi': {
        const keyword = searchParams.get('keyword') || undefined;
        const categoryId = searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId')!) : undefined;
        const result = await fetchMultiSourceData({ shopId, keyword, categoryId });
        return NextResponse.json({ success: true, data: result });
      }

      case 'demand-score': {
        // 需要从请求体获取数据，这里简化处理
        return NextResponse.json({ 
          success: true, 
          message: '请使用POST方法计算评分',
          endpoint: '/api/data-sources'
        });
      }

      case 'supply-score': {
        return NextResponse.json({ 
          success: true, 
          message: '请使用POST方法计算评分',
          endpoint: '/api/data-sources'
        });
      }

      case 'status': {
        return NextResponse.json({
          success: true,
          data: {
            sources: ['ozon', 'aliexpress', 'alibaba1688', 'customs'],
            shopId,
            timestamp: new Date().toISOString()
          }
        });
      }

      default:
        return NextResponse.json({ 
          success: false, 
          error: '未知操作类型',
          availableActions: [
            'ozon-products',
            'ozon-categories', 
            'ozon-attributes',
            'aliexpress-search',
            '1688-search',
            'customs',
            'multi',
            'demand-score',
            'supply-score',
            'status'
          ]
        }, { status: 400 });
    }
  } catch (error) {
    console.error('数据源API错误:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '服务器错误' 
    }, { status: 500 });
  }
}

/**
 * POST /api/data-sources
 * 用于复杂的数据获取和评分计算
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, shopId, params } = body;

    switch (action) {
      case 'multi': {
        const result = await fetchMultiSourceData({
          shopId: shopId || 'default',
          keyword: params?.keyword,
          categoryId: params?.categoryId
        });
        return NextResponse.json({ success: true, data: result });
      }

      case 'demand-score': {
        const { ozonData, aliexpressData } = params || {};
        const score = calculateDemandScore(ozonData, aliexpressData);
        return NextResponse.json({ success: true, data: { score } });
      }

      case 'supply-score': {
        const { alibaba1688Data, customsData } = params || {};
        const score = calculateSupplyScore(alibaba1688Data, customsData);
        return NextResponse.json({ success: true, data: { score } });
      }

      case 'search-all': {
        // 综合搜索所有数据源
        const keyword = params?.keyword;
        const categoryId = params?.categoryId;
        
        const results = await fetchMultiSourceData({
          shopId: shopId || 'default',
          keyword,
          categoryId
        });
        
        // 计算评分
        const demandScore = calculateDemandScore(
          results.ozon?.data,
          results.aliexpress?.data
        );
        const supplyScore = calculateSupplyScore(
          results.alibaba1688?.data
        );
        
        return NextResponse.json({
          success: true,
          data: {
            sources: results,
            scores: {
              demand: demandScore,
              supply: supplyScore,
              crossValidation: demandScore * supplyScore
            }
          }
        });
      }

      default:
        return NextResponse.json({ 
          success: false, 
          error: '未知操作类型',
          availableActions: ['multi', 'demand-score', 'supply-score', 'search-all']
        }, { status: 400 });
    }
  } catch (error) {
    console.error('数据源API错误:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '服务器错误' 
    }, { status: 500 });
  }
}
