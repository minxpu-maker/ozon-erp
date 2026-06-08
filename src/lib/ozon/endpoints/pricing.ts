/**
 * Ozon 价格相关 API 端点
 * 文档: https://docs.ozon.ru/api/seller/#tag/Price
 */

import {
  Priority,
  UpdatePricesRequest,
  UpdatePricesResponse,
  GetProductPricesRequest,
  GetProductPricesResponse,
  PriceUpdateItem,
  PriceUpdateResult,
  ProductPriceInfo,
} from '../types';
import { ozonRequest } from '../client-new';

/**
 * 批量更新商品价格
 * POST /v1/product/import/prices
 * 
 * @param shopId - 店铺ID
 * @param prices - 价格更新列表
 * @returns 更新结果
 */
export async function updatePrices(
  shopId: string,
  prices: PriceUpdateItem[]
): Promise<PriceUpdateResult[]> {
  const response = await ozonRequest<UpdatePricesResponse>(
    shopId,
    '/v1/product/import/prices',
    { prices },
    { priority: Priority.P0 } // 上架提交 - 最高优先级
  );
  
  return response.result || [];
}

/**
 * 获取商品价格信息
 * POST /v5/product/info/prices
 * 
 * @param shopId - 店铺ID
 * @param productIds - 商品ID数组
 * @returns 价格信息列表
 */
export async function getProductPrices(
  shopId: string,
  productIds: number[]
): Promise<ProductPriceInfo[]> {
  const response = await ozonRequest<GetProductPricesResponse>(
    shopId,
    '/v5/product/info/prices',
    { product_id: productIds },
    { priority: Priority.P3 } // 数据采集优先级
  );
  
  return response.result?.items || [];
}

/**
 * 更新单个商品价格
 * 
 * @param shopId - 店铺ID
 * @param productId - 商品ID
 * @param price - 新价格
 * @param oldPrice - 原价（可选）
 * @returns 是否成功
 */
export async function updateSinglePrice(
  shopId: string,
  productId: number,
  price: string,
  oldPrice?: string
): Promise<boolean> {
  const results = await updatePrices(shopId, [{
    product_id: productId,
    price,
    old_price: oldPrice,
  }]);
  
  return results[0]?.updated ?? false;
}

/**
 * 批量更新价格并检查结果
 * 
 * @param shopId - 店铺ID
 * @param prices - 价格更新列表
 * @returns 成功和失败的结果
 */
export async function updatePricesWithResult(
  shopId: string,
  prices: PriceUpdateItem[]
): Promise<{
  success: number[];
  failed: Array<{ productId: number; errors: string[] }>;
}> {
  const results = await updatePrices(shopId, prices);
  
  const success: number[] = [];
  const failed: Array<{ productId: number; errors: string[] }> = [];
  
  for (const result of results) {
    if (result.updated) {
      success.push(result.product_id);
    } else {
      failed.push({
        productId: result.product_id,
        errors: (result.errors || []).map(e => `[${e.code}] ${e.message}`),
      });
    }
  }
  
  return { success, failed };
}
