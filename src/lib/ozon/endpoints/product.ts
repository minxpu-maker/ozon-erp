/**
 * Ozon 商品相关 API 端点
 * 文档: https://docs.ozon.ru/api/seller/#tag/Product
 */

import {
  Priority,
  ProductImportRequest,
  ProductImportResponse,
  ProductImportInfoRequest,
  ProductImportInfoResponse,
  ProductListRequest,
  ProductListResponse,
  ProductInfoRequest,
  ProductInfoResponse,
  ProductPicturesImportRequest,
  ProductPicturesImportResponse,
  ProductPicturesInfoRequest,
  ProductPicturesInfoResponse,
  ProductImportItem,
  ProductImportInfoItem,
  ProductInfo,
} from '../types';
import { ozonRequest } from '../client-new';

/**
 * 创建或更新商品
 * POST /v3/product/import
 * 
 * @param shopId - 店铺ID
 * @param items - 商品列表
 * @returns 任务ID
 */
export async function importProducts(
  shopId: string,
  items: ProductImportItem[]
): Promise<number> {
  const response = await ozonRequest<ProductImportResponse>(
    shopId,
    '/v3/product/import',
    { items },
    { priority: Priority.P0 } // 上架提交 - 最高优先级
  );
  
  if (!response.result?.task_id) {
    throw new Error('No task_id in import response');
  }
  
  return response.result.task_id;
}

/**
 * 查询导入任务状态
 * POST /v1/product/import/info
 * 
 * @param shopId - 店铺ID
 * @param taskId - 任务ID
 * @returns 任务状态和结果
 */
export async function getImportInfo(
  shopId: string,
  taskId: number
): Promise<{
  status: 'completed' | 'in_progress' | 'failed';
  items: ProductImportInfoItem[];
}> {
  const response = await ozonRequest<ProductImportInfoResponse>(
    shopId,
    '/v1/product/import/info',
    { task_id: taskId },
    { priority: Priority.P0 }
  );
  
  return {
    status: response.result?.status || 'in_progress',
    items: response.result?.items || [],
  };
}

/**
 * 轮询等待导入任务完成
 * 
 * @param shopId - 店铺ID
 * @param taskId - 任务ID
 * @param maxWaitMs - 最大等待时间（默认5分钟）
 * @param pollIntervalMs - 轮询间隔（默认2秒）
 * @returns 导入结果
 */
export async function waitForImportComplete(
  shopId: string,
  taskId: number,
  maxWaitMs: number = 5 * 60 * 1000,
  pollIntervalMs: number = 2000
): Promise<ProductImportInfoItem[]> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const result = await getImportInfo(shopId, taskId);
    
    if (result.status === 'completed') {
      return result.items;
    }
    
    if (result.status === 'failed') {
      const errors = result.items
        .filter(item => item.status === 'failed')
        .flatMap(item => item.errors || []);
      
      throw new Error(`Import failed: ${errors.map(e => e.message).join(', ')}`);
    }
    
    // 等待后继续轮询
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  throw new Error(`Import timeout after ${maxWaitMs}ms`);
}

/**
 * 获取商品列表
 * POST /v3/product/list
 * 
 * @param shopId - 店铺ID
 * @param params - 请求参数
 * @returns 商品ID列表
 */
export async function getProductList(
  shopId: string,
  params: ProductListRequest = {}
): Promise<{
  items: number[];
  lastId: string;
  total: number;
}> {
  const response = await ozonRequest<ProductListResponse>(
    shopId,
    '/v3/product/list',
    {
      filter: params.filter || {},
      last_id: params.last_id || '',
      limit: params.limit || 100,
    },
    { priority: Priority.P3 } // 数据采集优先级
  );
  
  return {
    items: (response.result?.items || []).map(item => item.product_id),
    lastId: response.result?.last_id || '',
    total: response.result?.total || 0,
  };
}

/**
 * 获取商品详情
 * POST /v2/product/info
 * 
 * @param shopId - 店铺ID
 * @param productIds - 商品ID数组
 * @returns 商品详情列表
 */
export async function getProductInfo(
  shopId: string,
  productIds: number[]
): Promise<ProductInfo[]> {
  const response = await ozonRequest<ProductInfoResponse>(
    shopId,
    '/v2/product/info',
    { product_id: productIds },
    { priority: Priority.P3 }
  );
  
  return response.result?.items || [];
}

/**
 * 按offer_id获取商品详情
 * 
 * @param shopId - 店铺ID
 * @param offerIds - offer_id数组
 * @returns 商品详情列表
 */
export async function getProductInfoByOfferId(
  shopId: string,
  offerIds: string[]
): Promise<ProductInfo[]> {
  const response = await ozonRequest<ProductInfoResponse>(
    shopId,
    '/v2/product/info',
    { offer_id: offerIds },
    { priority: Priority.P3 }
  );
  
  return response.result?.items || [];
}

/**
 * 上传商品图片
 * POST /v1/product/pictures/import
 * 
 * @param shopId - 店铺ID
 * @param productId - 商品ID
 * @param images - 图片URL数组
 * @returns 上传任务ID
 */
export async function importPictures(
  shopId: string,
  productId: number,
  images: string[]
): Promise<number> {
  const response = await ozonRequest<ProductPicturesImportResponse>(
    shopId,
    '/v1/product/pictures/import',
    {
      product_id: productId,
      images,
    },
    { priority: Priority.P0 }
  );
  
  if (!response.result?.pic_upload_id) {
    throw new Error('No pic_upload_id in response');
  }
  
  return response.result.pic_upload_id;
}

/**
 * 查询图片上传状态
 * POST /v2/product/pictures/info
 * 
 * @param shopId - 店铺ID
 * @param uploadId - 上传任务ID
 * @returns 上传状态和结果
 */
export async function getPicturesInfo(
  shopId: string,
  uploadId: number
): Promise<{
  status: 'uploaded' | 'failed' | 'pending';
  images?: Array<{ url: string; is_primary?: boolean }>;
  errors?: Array<{ code: string; message: string }>;
}> {
  const response = await ozonRequest<ProductPicturesInfoResponse>(
    shopId,
    '/v2/product/pictures/info',
    { pic_upload_id: uploadId },
    { priority: Priority.P0 }
  );
  
  return {
    status: response.result?.status || 'pending',
    images: response.result?.images,
    errors: response.result?.errors,
  };
}

/**
 * 分页获取所有商品ID
 * 
 * @param shopId - 店铺ID
 * @param limit - 每页数量
 * @returns 所有商品ID
 */
export async function getAllProductIds(
  shopId: string,
  limit: number = 100
): Promise<number[]> {
  const allIds: number[] = [];
  let lastId = '';
  
  do {
    const result = await getProductList(shopId, { last_id: lastId, limit });
    allIds.push(...result.items);
    lastId = result.lastId;
    
    // 如果返回数量小于limit，说明已到最后一页
    if (result.items.length < limit) {
      break;
    }
  } while (lastId);
  
  return allIds;
}
