/**
 * 外部数据源服务
 * 对接 Ozon、速卖通、1688、海关数据等外部API
 */

import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

// 数据源配置
export const DATA_SOURCE_CONFIG = {
  ozon: {
    name: 'Ozon',
    baseUrl: 'https://api-seller.ozon.ru',
    timeout: 30000,
    rateLimit: {
      requestsPerMinute: 100,
      burstLimit: 10
    }
  },
  aliexpress: {
    name: '速卖通',
    baseUrl: 'https://api-sg.aliexpress.com/sync',
    timeout: 30000,
    rateLimit: {
      requestsPerMinute: 60,
      burstLimit: 5
    }
  },
  alibaba1688: {
    name: '1688',
    baseUrl: 'https://api.1688.com',
    timeout: 30000,
    rateLimit: {
      requestsPerMinute: 30,
      burstLimit: 3
    }
  },
  customs: {
    name: '海关数据',
    baseUrl: 'https://api.customs.gov.cn',
    timeout: 60000,
    rateLimit: {
      requestsPerMinute: 10,
      burstLimit: 2
    }
  }
} as const;

// 数据源结果类型
export interface DataSourceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  source: string;
  timestamp: Date;
  cached?: boolean;
}

// Ozon 商品数据
export interface OzonProductData {
  productId: number;
  name: string;
  offerId: string;
  price: string;
  marketingPrice?: string;
  commissions?: {
    salesCommission: number;
    fbsCommission: number;
  };
  stocks?: {
    coming: number;
    present: number;
    reserved: number;
  };
  sources: Array<{
    source: string;
    enabled: boolean;
  }>;
  status: {
    value: string;
    name: string;
  };
  createdAt: string;
  visibility: {
    value: string;
    name: string;
  };
  barcodes?: string[];
  dimensions?: {
    weight: number;
    length: number;
    width: number;
    height: number;
  };
}

// Ozon 类目数据
export interface OzonCategoryData {
  id: number;
  name: string;
  parentId?: number;
  children?: OzonCategoryData[];
  attributes?: Array<{
    id: number;
    name: string;
    isRequired: boolean;
    type: string;
  }>;
}

// 速卖通商品数据
export interface AliexpressProductData {
  productId: string;
  subject: string;
  price: string;
  originalPrice?: string;
  tradeAmount?: string;
  commissionRate?: string;
  salesCount: number;
  evaluation: number;
  shopId: string;
  shopName: string;
  category: string;
  imageUrl: string;
  detailUrl: string;
}

// 1688 商品数据
export interface Alibaba1688ProductData {
  offerId: string;
  subject: string;
  price: string;
  priceRange?: string;
  minOrderQuantity: number;
  tradeAmount?: string;
  sellerId: string;
  sellerName: string;
  category: string;
  imageUrl: string;
  detailUrl: string;
}

// 海关数据
export interface CustomsData {
  hsCode: string;
  productName: string;
  exportValue: number;
  exportQuantity: number;
  exportCountry: string;
  importValue?: number;
  importQuantity?: number;
  importCountry?: string;
  trend: 'up' | 'down' | 'stable';
}

/**
 * 获取店铺的 Ozon API 凭证
 */
async function getOzonCredentials(shopId: string): Promise<{ clientId: string; apiKey: string } | null> {
  try {
    const shop = await db.query.shops.findFirst({
      where: eq(shops.id, shopId)
    });
    
    if (!shop || !shop.ozon_client_id || !shop.ozon_api_key) {
      return null;
    }
    
    return {
      clientId: shop.ozon_client_id,
      apiKey: shop.ozon_api_key
    };
  } catch (error) {
    console.error('获取Ozon凭证失败:', error);
    return null;
  }
}

/**
 * Ozon API 调用
 */
async function callOzonApi<T>(
  credentials: { clientId: string; apiKey: string },
  method: string,
  params?: Record<string, unknown>
): Promise<DataSourceResult<T>> {
  const config = DATA_SOURCE_CONFIG.ozon;
  
  try {
    const response = await fetch(`${config.baseUrl}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': credentials.clientId,
        'Api-Key': credentials.apiKey
      },
      body: JSON.stringify(params || {}),
      signal: AbortSignal.timeout(config.timeout)
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `Ozon API错误: ${response.status} ${response.statusText}`,
        source: 'ozon',
        timestamp: new Date()
      };
    }
    
    const data = await response.json();
    
    return {
      success: true,
      data: data as T,
      source: 'ozon',
      timestamp: new Date()
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ozon API调用失败',
      source: 'ozon',
      timestamp: new Date()
    };
  }
}

/**
 * 获取 Ozon 商品列表
 */
export async function fetchOzonProducts(
  shopId: string,
  filter?: {
    categoryId?: number;
    visibility?: string;
    status?: string;
  }
): Promise<DataSourceResult<OzonProductData[]>> {
  const credentials = await getOzonCredentials(shopId);
  
  if (!credentials) {
    return {
      success: false,
      error: '未找到Ozon API凭证',
      source: 'ozon',
      timestamp: new Date()
    };
  }
  
  const result = await callOzonApi<{ items: Array<{ product_id: number }> }>(
    credentials,
    'v3/product/list'
  );
  
  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Ozon商品列表获取失败',
      source: 'ozon',
      timestamp: new Date()
    };
  }
  
  // 获取商品详情
  const productIds = result.data.items.slice(0, 100).map(item => item.product_id);
  
  if (productIds.length === 0) {
    return {
      success: true,
      data: [],
      source: 'ozon',
      timestamp: new Date()
    };
  }
  
  const detailsResult = await callOzonApi<{ items: OzonProductData[] }>(
    credentials,
    'v2/product/info/list',
    { product_id: productIds }
  );
  
  return {
    success: detailsResult.success,
    data: detailsResult.data?.items || [],
    error: detailsResult.error,
    source: 'ozon',
    timestamp: new Date()
  };
}

/**
 * 获取 Ozon 类目树
 */
export async function fetchOzonCategories(
  shopId: string,
  categoryId?: number
): Promise<DataSourceResult<OzonCategoryData[]>> {
  const credentials = await getOzonCredentials(shopId);
  
  if (!credentials) {
    return {
      success: false,
      error: '未找到Ozon API凭证',
      source: 'ozon',
      timestamp: new Date()
    };
  }
  
  const params = categoryId ? { category_id: categoryId } : {};
  const result = await callOzonApi<{ items: OzonCategoryData[] }>(
    credentials,
    'v2/category/list',
    params
  );
  
  return {
    success: result.success,
    data: result.data?.items || [],
    error: result.error,
    source: 'ozon',
    timestamp: new Date()
  };
}

/**
 * 获取 Ozon 类目属性
 */
export async function fetchOzonCategoryAttributes(
  shopId: string,
  categoryId: number
): Promise<DataSourceResult<OzonCategoryData['attributes']>> {
  const credentials = await getOzonCredentials(shopId);
  
  if (!credentials) {
    return {
      success: false,
      error: '未找到Ozon API凭证',
      source: 'ozon',
      timestamp: new Date()
    };
  }
  
  const result = await callOzonApi<{ attributes: OzonCategoryData['attributes'] }>(
    credentials,
    'v2/category/attribute',
    { category_id: categoryId }
  );
  
  return {
    success: result.success,
    data: result.data?.attributes || [],
    error: result.error,
    source: 'ozon',
    timestamp: new Date()
  };
}

/**
 * 模拟速卖通商品搜索（实际需要API密钥）
 */
export async function searchAliexpressProducts(
  keyword: string,
  options?: {
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
  }
): Promise<DataSourceResult<AliexpressProductData[]>> {
  // 模拟数据（实际需要接入速卖通API）
  const mockProducts: AliexpressProductData[] = [
    {
      productId: 'ali-' + Date.now() + '-1',
      subject: `${keyword} 相关商品示例`,
      price: '15.99',
      originalPrice: '25.99',
      commissionRate: '5%',
      salesCount: 1234,
      evaluation: 4.8,
      shopId: 'shop-001',
      shopName: '示例店铺',
      category: '电子数码',
      imageUrl: 'https://via.placeholder.com/200',
      detailUrl: 'https://aliexpress.com/item/123'
    }
  ];
  
  return {
    success: true,
    data: mockProducts,
    source: 'aliexpress',
    timestamp: new Date(),
    cached: false
  };
}

/**
 * 模拟1688商品搜索（实际需要API密钥）
 */
export async function search1688Products(
  keyword: string,
  options?: {
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
  }
): Promise<DataSourceResult<Alibaba1688ProductData[]>> {
  // 模拟数据（实际需要接入1688 API）
  const mockProducts: Alibaba1688ProductData[] = [
    {
      offerId: '1688-' + Date.now() + '-1',
      subject: `${keyword} 1688货源`,
      price: '8.50',
      priceRange: '8.50-12.00',
      minOrderQuantity: 10,
      tradeAmount: '10000+',
      sellerId: 'seller-001',
      sellerName: '源头工厂',
      category: '数码配件',
      imageUrl: 'https://via.placeholder.com/200',
      detailUrl: 'https://detail.1688.com/offer/123'
    }
  ];
  
  return {
    success: true,
    data: mockProducts,
    source: 'alibaba1688',
    timestamp: new Date(),
    cached: false
  };
}

/**
 * 模拟海关数据查询
 */
export async function fetchCustomsData(
  hsCode: string
): Promise<DataSourceResult<CustomsData>> {
  // 模拟数据（实际需要接入海关API）
  const mockData: CustomsData = {
    hsCode,
    productName: '电子产品',
    exportValue: 1000000,
    exportQuantity: 50000,
    exportCountry: '俄罗斯',
    trend: 'up'
  };
  
  return {
    success: true,
    data: mockData,
    source: 'customs',
    timestamp: new Date(),
    cached: false
  };
}

/**
 * 批量获取多源数据
 */
export async function fetchMultiSourceData(params: {
  shopId: string;
  keyword?: string;
  categoryId?: number;
  ozonProductId?: number;
}): Promise<{
  ozon?: DataSourceResult<OzonProductData[]>;
  aliexpress?: DataSourceResult<AliexpressProductData[]>;
  alibaba1688?: DataSourceResult<Alibaba1688ProductData[]>;
}> {
  const results: {
    ozon?: DataSourceResult<OzonProductData[]>;
    aliexpress?: DataSourceResult<AliexpressProductData[]>;
    alibaba1688?: DataSourceResult<Alibaba1688ProductData[]>;
  } = {};
  
  // 并行获取多源数据
  const [ozonResult, aliexpressResult, alibaba1688Result] = await Promise.allSettled([
    fetchOzonProducts(params.shopId, { categoryId: params.categoryId }),
    params.keyword ? searchAliexpressProducts(params.keyword) : Promise.resolve({ success: false, data: [], source: 'aliexpress', timestamp: new Date() }),
    params.keyword ? search1688Products(params.keyword) : Promise.resolve({ success: false, data: [], source: 'alibaba1688', timestamp: new Date() })
  ]);
  
  if (ozonResult.status === 'fulfilled') {
    results.ozon = ozonResult.value;
  }
  
  if (aliexpressResult.status === 'fulfilled') {
    results.aliexpress = aliexpressResult.value;
  }
  
  if (alibaba1688Result.status === 'fulfilled') {
    results.alibaba1688 = alibaba1688Result.value;
  }
  
  return results;
}

/**
 * 计算需求端评分（基于Ozon和速卖通数据）
 */
export function calculateDemandScore(
  ozonData?: OzonProductData[],
  aliexpressData?: AliexpressProductData[]
): number {
  let score = 0.5; // 默认中等
  
  // Ozon 数据贡献
  if (ozonData && ozonData.length > 0) {
    const avgSales = ozonData.reduce((sum, p) => sum + (p.stocks?.present || 0), 0) / ozonData.length;
    if (avgSales > 100) score += 0.2;
    else if (avgSales > 50) score += 0.1;
  }
  
  // 速卖通数据贡献
  if (aliexpressData && aliexpressData.length > 0) {
    const avgEvaluation = aliexpressData.reduce((sum, p) => sum + p.evaluation, 0) / aliexpressData.length;
    if (avgEvaluation > 4.5) score += 0.15;
    else if (avgEvaluation > 4.0) score += 0.05;
  }
  
  return Math.min(1, Math.max(0, score));
}

/**
 * 计算供给端评分（基于1688和海关数据）
 */
export function calculateSupplyScore(
  alibaba1688Data?: Alibaba1688ProductData[],
  customsData?: CustomsData
): number {
  let score = 0.5; // 默认中等
  
  // 1688 数据贡献
  if (alibaba1688Data && alibaba1688Data.length > 0) {
    const hasLowPrice = alibaba1688Data.some(p => parseFloat(p.price) < 20);
    if (hasLowPrice) score += 0.15;
    
    const hasFactory = alibaba1688Data.some(p => p.sellerName.includes('工厂'));
    if (hasFactory) score += 0.1;
  }
  
  // 海关数据贡献
  if (customsData) {
    if (customsData.trend === 'up') score += 0.1;
    else if (customsData.trend === 'down') score -= 0.1;
  }
  
  return Math.min(1, Math.max(0, score));
}
