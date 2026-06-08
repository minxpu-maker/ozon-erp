/**
 * Ozon 库存相关 API 端点
 * 文档: https://docs.ozon.ru/api/seller/#tag/Stocks
 */

import {
  Priority,
  UpdateStocksRequest,
  UpdateStocksResponse,
  GetProductStocksRequest,
  GetProductStocksResponse,
  StockUpdateItem,
  StockUpdateResult,
  ProductStockInfo,
} from '../types';
import { ozonRequest } from '../client-new';

/**
 * 批量更新商品库存
 * POST /v2/products/stocks
 * 
 * @param shopId - 店铺ID
 * @param stocks - 库存更新列表
 * @returns 更新结果
 */
export async function updateStocks(
  shopId: string,
  stocks: StockUpdateItem[]
): Promise<StockUpdateResult[]> {
  const response = await ozonRequest<UpdateStocksResponse>(
    shopId,
    '/v2/products/stocks',
    { stocks },
    { priority: Priority.P0 } // 上架提交 - 最高优先级
  );
  
  return response.result || [];
}

/**
 * 获取商品库存信息
 * POST /v4/product/info/stocks
 * 
 * @param shopId - 店铺ID
 * @param productIds - 商品ID数组
 * @returns 库存信息列表
 */
export async function getProductStocks(
  shopId: string,
  productIds: number[]
): Promise<ProductStockInfo[]> {
  const response = await ozonRequest<GetProductStocksResponse>(
    shopId,
    '/v4/product/info/stocks',
    { product_id: productIds },
    { priority: Priority.P3 } // 数据采集优先级
  );
  
  return response.result?.items || [];
}

/**
 * 更新单个商品库存
 * 
 * @param shopId - 店铺ID
 * @param productId - 商品ID
 * @param stock - 库存数量
 * @param warehouseId - 仓库ID（可选）
 * @returns 是否成功
 */
export async function updateSingleStock(
  shopId: string,
  productId: number,
  stock: number,
  warehouseId?: number
): Promise<boolean> {
  const results = await updateStocks(shopId, [{
    product_id: productId,
    stock,
    warehouse_id: warehouseId,
  }]);
  
  return results[0]?.updated ?? false;
}

/**
 * 按offer_id更新库存
 * 
 * @param shopId - 店铺ID
 * @param offerId - offer_id
 * @param stock - 库存数量
 * @returns 是否成功
 */
export async function updateStockByOfferId(
  shopId: string,
  offerId: string,
  stock: number
): Promise<boolean> {
  const results = await updateStocks(shopId, [{
    product_id: 0, // 使用 offer_id 时 product_id 可以为 0
    offer_id: offerId,
    stock,
  }]);
  
  return results[0]?.updated ?? false;
}

/**
 * 批量更新库存并检查结果
 * 
 * @param shopId - 店铺ID
 * @param stocks - 库存更新列表
 * @returns 成功和失败的结果
 */
export async function updateStocksWithResult(
  shopId: string,
  stocks: StockUpdateItem[]
): Promise<{
  success: number[];
  failed: Array<{ productId: number; errors: string[] }>;
}> {
  const results = await updateStocks(shopId, stocks);
  
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

/**
 * 获取商品可用库存（present - reserved）
 * 
 * @param shopId - 店铺ID
 * @param productId - 商品ID
 * @returns 可用库存数量
 */
export async function getAvailableStock(
  shopId: string,
  productId: number
): Promise<number> {
  const stocks = await getProductStocks(shopId, [productId]);
  
  if (!stocks.length || !stocks[0].stocks?.length) {
    return 0;
  }
  
  // 汇总所有仓库的可用库存
  return stocks[0].stocks.reduce((total, s) => {
    const available = (s.present || 0) - (s.reserved || 0);
    return total + Math.max(0, available);
  }, 0);
}
