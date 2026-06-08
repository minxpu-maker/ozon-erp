/**
 * Ozon API 统一导出
 */

// ==================== 核心客户端 ====================
export { ozonRequest, createShopRequest } from './client-new';
export { OzonApiClient, OzonApiError, createOzonClient } from './client-legacy';

// ==================== 限流器 ====================
export { 
  rateLimiter, 
  checkRateLimit, 
  acquireToken,
  TokenBucket,
  ShopRateLimiter,
} from './rate-limiter';

// ==================== 类型定义 ====================
export * from './types';

// ==================== 端点模块 ====================
// 类目相关
export {
  getCategoryTree,
  getCategoryAttributes,
  getAttributeValues,
  searchAttributeValues,
  getFullCategoryTree,
} from './endpoints/category';

// 商品相关
export {
  importProducts,
  getImportInfo,
  waitForImportComplete,
  getProductList,
  getProductInfo,
  getProductInfoByOfferId,
  importPictures,
  getPicturesInfo,
  getAllProductIds,
} from './endpoints/product';

// 价格相关
export {
  updatePrices,
  getProductPrices,
  updateSinglePrice,
  updatePricesWithResult,
} from './endpoints/pricing';

// 库存相关
export {
  updateStocks,
  getProductStocks,
  updateSingleStock,
  updateStockByOfferId,
  updateStocksWithResult,
  getAvailableStock,
} from './endpoints/stock';

// 物流相关
export {
  getTariffList,
  getDefaultTariff,
  getEconomyTariffs,
  getExpressTariffs,
  getTariffById,
} from './endpoints/logistics';
