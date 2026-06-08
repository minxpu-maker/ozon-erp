/**
 * Ozon API 类型定义
 * 文档: https://docs.ozon.ru/api/seller/zh/
 */

// ==================== 基础类型 ====================

/**
 * 请求优先级
 * P0: 上架提交 (最高)
 * P1: 选品评分
 * P2: 知识库同步
 * P3: 数据采集 (最低)
 */
export enum Priority {
  P0 = 0, // 上架提交 - 最高优先级
  P1 = 1, // 选品评分
  P2 = 2, // 知识库同步
  P3 = 3, // 数据采集 - 最低优先级
}

/**
 * Ozon API 错误
 */
export interface OzonApiError {
  code: string;
  message: string;
}

/**
 * Ozon API 响应 (泛型)
 */
export interface OzonApiResponse<T> {
  result?: T;
  error?: OzonApiError;
}

// ==================== 类目相关 ====================

/**
 * 类目树请求
 */
export interface CategoryTreeRequest {
  category_id?: number;
  language?: 'DEFAULT' | 'RU' | 'EN';
}

/**
 * 类目树节点
 */
export interface CategoryTreeNode {
  category_id: number;
  category_name: string;
  children: CategoryTreeNode[];
  disabled: boolean;
}

/**
 * 类目树响应
 */
export interface CategoryTreeResponse {
  result: CategoryTreeNode[];
}

/**
 * 类目属性请求
 */
export interface CategoryAttributeRequest {
  category_id: number[];
  language?: 'DEFAULT' | 'RU' | 'EN';
}

/**
 * 类目属性定义
 */
export interface CategoryAttribute {
  attribute_id: number;
  attribute_name: string;
  description?: string;
  type: string;
  is_required: boolean;
  is_collection?: boolean;
  dictionary_id?: number;
  group_id?: number;
  group_name?: string;
}

/**
 * 类目属性响应
 */
export interface CategoryAttributeResponse {
  result: CategoryAttribute[];
}

/**
 * 属性值列表请求
 */
export interface CategoryAttributeValuesRequest {
  attribute_id: number;
  category_id: number[];
  last_value_id?: number;
  limit?: number;
}

/**
 * 属性值
 */
export interface CategoryAttributeValue {
  id: number;
  value: string;
  info?: string;
  picture?: string;
}

/**
 * 属性值列表响应
 */
export interface CategoryAttributeValuesResponse {
  result: CategoryAttributeValue[];
  has_next?: boolean;
  last_value_id?: number;
}

/**
 * 搜索属性值请求
 */
export interface SearchAttributeValuesRequest {
  category_id: number[];
  attribute_id: number;
  search_string: string;
  limit?: number;
}

// ==================== 商品相关 ====================

/**
 * 商品导入项
 */
export interface ProductImportItem {
  name: string;
  offer_id: string;
  category_id: number;
  price: string;
  vat?: '0' | '0.1' | '0.2';
  images?: string[];
  attributes?: Array<{
    attribute_id: number;
    value: string;
    dictionary_value_id?: number;
  }>;
  barcode?: string;
  description?: string;
  weight?: number;
  height?: number;
  depth?: number;
  width?: number;
}

/**
 * 商品导入请求
 */
export interface ProductImportRequest {
  items: ProductImportItem[];
}

/**
 * 商品导入响应
 */
export interface ProductImportResponse {
  result: {
    task_id: number;
  };
}

/**
 * 导入任务信息请求
 */
export interface ProductImportInfoRequest {
  task_id: number;
}

/**
 * 导入任务项状态
 */
export interface ProductImportInfoItem {
  product_id: number;
  offer_id: string;
  status: 'imported' | 'failed' | 'pending' | 'processed';
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

/**
 * 导入任务信息响应
 */
export interface ProductImportInfoResponse {
  result: {
    items: ProductImportInfoItem[];
    status: 'completed' | 'in_progress' | 'failed';
  };
}

/**
 * 商品列表请求
 */
export interface ProductListRequest {
  filter?: {
    visibility?: 'ALL' | 'VISIBLE' | 'HIDDEN';
    status?: 'all' | 'ready' | 'moderating' | 'disabled' | 'archived';
    offer_id?: string[];
    product_id?: number[];
  };
  last_id?: string;
  limit?: number;
}

/**
 * 商品列表响应
 */
export interface ProductListResponse {
  result: {
    items: Array<{ product_id: number }>;
    last_id: string;
    total: number;
  };
}

/**
 * 商品信息请求
 */
export interface ProductInfoRequest {
  product_id?: number[];
  offer_id?: string[];
}

/**
 * 商品信息
 */
export interface ProductInfo {
  id: number;
  name: string;
  offer_id: string;
  price: {
    price: string;
    old_price?: string;
    marketing_price?: string;
    premium_price?: string;
  };
  status?: {
    state: string;
    state_name: string;
  };
  images?: string[];
  primary_image?: string;
  category_id?: number;
  category_name?: string;
  attributes?: Array<{
    attribute_id: number;
    name: string;
    value: string;
    dictionary_value_id?: number;
  }>;
  stocks?: {
    coming?: number;
    present?: number;
    reserved?: number;
  };
  visibility?: {
    has_price: boolean;
    is_visible: boolean;
  };
  vat?: string;
  barcode?: string;
  dimensions?: {
    weight?: number;
    height?: number;
    depth?: number;
    width?: number;
  };
}

/**
 * 商品信息响应
 */
export interface ProductInfoResponse {
  result: {
    items: ProductInfo[];
  };
}

/**
 * 图片上传请求
 */
export interface ProductPicturesImportRequest {
  product_id: number;
  images: string[];
}

/**
 * 图片上传响应
 */
export interface ProductPicturesImportResponse {
  result: {
    pic_upload_id: number;
  };
}

/**
 * 图片上传状态请求
 */
export interface ProductPicturesInfoRequest {
  pic_upload_id: number;
}

/**
 * 图片上传状态响应
 */
export interface ProductPicturesInfoResponse {
  result: {
    status: 'uploaded' | 'failed' | 'pending';
    images?: Array<{
      url: string;
      is_primary?: boolean;
    }>;
    errors?: Array<{
      code: string;
      message: string;
    }>;
  };
}

// ==================== 价格相关 ====================

/**
 * 价格更新项
 */
export interface PriceUpdateItem {
  product_id: number;
  price: string;
  old_price?: string;
  min_price?: string;
}

/**
 * 价格更新请求
 */
export interface UpdatePricesRequest {
  prices: PriceUpdateItem[];
}

/**
 * 价格更新结果项
 */
export interface PriceUpdateResult {
  product_id: number;
  updated: boolean;
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

/**
 * 价格更新响应
 */
export interface UpdatePricesResponse {
  result: PriceUpdateResult[];
}

/**
 * 获取商品价格请求
 */
export interface GetProductPricesRequest {
  product_id: number[];
}

/**
 * 商品价格信息
 */
export interface ProductPriceInfo {
  product_id: number;
  offer_id?: string;
  price: {
    price: string;
    old_price?: string;
    marketing_price?: string;
    premium_price?: string;
    min_price?: string;
  };
  price_indexes?: {
    price_index?: string;
    price_index_value?: string;
    self_price_index_value?: string;
  };
}

/**
 * 获取商品价格响应
 */
export interface GetProductPricesResponse {
  result: {
    items: ProductPriceInfo[];
  };
}

// ==================== 库存相关 ====================

/**
 * 库存更新项
 */
export interface StockUpdateItem {
  product_id: number;
  offer_id?: string;
  stock: number;
  warehouse_id?: number;
}

/**
 * 库存更新请求
 */
export interface UpdateStocksRequest {
  stocks: StockUpdateItem[];
}

/**
 * 库存更新结果项
 */
export interface StockUpdateResult {
  product_id: number;
  updated: boolean;
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

/**
 * 库存更新响应
 */
export interface UpdateStocksResponse {
  result: StockUpdateResult[];
}

/**
 * 获取商品库存请求
 */
export interface GetProductStocksRequest {
  product_id: number[];
}

/**
 * 商品库存信息
 */
export interface ProductStockInfo {
  product_id: number;
  offer_id?: string;
  stocks: Array<{
    warehouse_id: number;
    warehouse_name?: string;
    present: number;
    reserved: number;
    coming?: number;
  }>;
}

/**
 * 获取商品库存响应
 */
export interface GetProductStocksResponse {
  result: {
    items: ProductStockInfo[];
  };
}

// ==================== 物流相关 ====================

/**
 * 物流模板列表请求
 */
export interface LogisticsTariffListRequest {
  filter?: {
    is_economy?: boolean;
    is_express?: boolean;
    is_premium?: boolean;
  };
  limit?: number;
  offset?: number;
}

/**
 * 物流模板
 */
export interface LogisticsTariff {
  id: number;
  name: string;
  type: string;
  is_economy?: boolean;
  is_express?: boolean;
  is_premium?: boolean;
  delivery_time?: {
    min_days: number;
    max_days: number;
  };
}

/**
 * 物流模板列表响应
 */
export interface LogisticsTariffListResponse {
  result: LogisticsTariff[];
}

// ==================== 订单相关 (保留现有类型) ====================

export interface OzonOrder {
  posting_number: string;
  order_id: number;
  order_number: string;
  status: string;
  in_process_at?: string;
  status_updated_at?: string;
  created_at?: string;
  financial_data: {
    posting_services: {
      marketplace_service_name_fbo_fulfillment_amount: number;
      marketplace_service_name_direct_flow_transference_amount: number;
      return_service_name_indirect_flow_transference_amount: number;
      droppoff_amount: number;
      items_services: Array<{
        item_services: {
          marketplace_service_name_item_return_after_deliv_to_customer_amount: number;
          marketplace_service_name_item_return_not_deliv_to_customer_amount: number;
          marketplace_service_name_item_delivery_amount: number;
        };
      }>;
    };
    products?: Array<{
      price: number;
      payout?: number;
      quantity: number;
      product_id: number;
      customer_price?: number;
      currency_code?: string;
      commission_amount?: number;
    }>;
  };
  customer: {
    customer_id: number;
    name: string;
    phone: string;
    email?: string;
  };
  items: Array<{
    item_id: number;
    offer_id: string;
    name: string;
    quantity: number;
    price: number;
    dimensions: {
      weight: number;
      height: number;
      depth: number;
      width: number;
    };
    products: Array<{
      offer_id: string;
      name: string;
      price: number;
      quantity: number;
    }>;
    sku: number;
  }>;
}

export interface OzonOrderListResponse {
  result: {
    postings: OzonOrder[];
    has_next: boolean;
    cursor?: string;
  };
}

// ==================== 速率限制相关 ====================

/**
 * 速率限制状态
 */
export interface RateLimitStatus {
  allowed: boolean;
  waitMs: number; // 需要等待的毫秒数
  remaining: number; // 剩余配额
  resetAt: Date | null; // 配额重置时间
}

/**
 * 请求队列项
 */
export interface QueuedRequest {
  id: string;
  shopId: string;
  priority: Priority;
  endpoint: string;
  body: unknown;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  queuedAt: number;
}
