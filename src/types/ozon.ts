/**
 * Ozon API 类型定义
 */

// 认证配置
export interface OzonConfig {
  clientId: string;
  apiKey: string;
  baseUrl?: string;
}

// 订单状态枚举
export enum OzonPostingStatus {
  AWAITING_PACKAGING = 'awaiting_packaging', // 待打包（已付款）
  AWAITING_DELIVERY = 'awaiting_delivery', // 待发货
  DELIVERING = 'delivering', // 配送中
  DELIVERED = 'delivered', // 已送达
  CANCELLED = 'cancelled', // 已取消
  NOT_DELIVERED = 'not_delivered', // 未送达
}

// 订单商品
export interface OzonProduct {
  offer_id: string; // SKU编码
  name: string; // 商品名称
  sku?: string; // 系统SKU
  quantity: number; // 数量
  price: string; // 单价
  dimensions?: {
    weight: number;
    height: number;
    length: number;
    width: number;
  };
}

// 订单详情
export interface OzonPosting {
  posting_number: string; // 订单号
  order_id: number; // 订单ID
  order_number: string; // 订单编号
  status: OzonPostingStatus; // 状态
  in_process_at: string; // 创建时间
  created_at: string; // 创建时间
  financial_data: {
    products: Array<{
      offer_id: string;
      product_id: number;
      price: string;
      quantity: number;
      commissions?: {
        sales_percent?: number;
        fbs_fulfillment_amount?: string;
        fbs_direct_flow_trans_max_amount?: string;
        fbs_returned_amount?: string;
      };
    }>;
    posting_services?: {
      marketplace_service_first_mile_percent: number;
      marketplace_service_first_mile_amount: string;
      marketplace_service_fulfillment_percent: number;
      marketplace_service_fulfillment_amount: string;
      marketplace_service_pickup_percent: number;
      marketplace_service_pickup_amount: string;
      marketplace_service_dropoff_pvz_percent: number;
      marketplace_service_dropoff_pvz_amount: string;
      marketplace_service_dropoff_ff_percent: number;
      marketplace_service_dropoff_ff_amount: string;
      marketplace_service_direct_flow_trans_min_percent: number;
      marketplace_service_direct_flow_trans_min_amount: string;
      marketplace_service_direct_flow_trans_max_percent: number;
      marketplace_service_direct_flow_trans_max_amount: string;
      marketplace_service_returned_percent: number;
      marketplace_service_returned_amount: string;
    };
  };
  products: OzonProduct[]; // 商品列表
  customer?: {
    customer_id: number;
    name?: string;
    phone?: string;
    email?: string;
    address?: {
      address_line?: string;
      city?: string;
      country?: string;
      postal_code?: string;
    };
  };
  tracking_number?: string; // 物流单号
  shipment_date?: string; // 发货日期
  delivering_date?: string; // 配送日期
  cancellation?: {
    cancel_reason_id?: number;
    cancel_reason?: string;
    cancelled_at?: string;
    initiator?: string;
  };
  analytics_data?: {
    region?: string;
    delivery_type?: string;
    is_premium?: boolean;
    is_legal?: boolean;
    premium_discount_percent?: number;
  };
  substatus?: string;
  substatus_reason?: string;
  is_multibox?: boolean;
  multi_box_price?: string;
  last_delivery_date?: string;
  additional_data?: Array<{
    key: string;
    value: string;
  }>;
  requirements?: {
    products_requiring_gtd?: Array<{
      product_id: number;
      offer_id: string;
      name: string;
      quantity: number;
    }>;
  };
}

// 订单列表请求参数
export interface OzonPostingListRequest extends Record<string, unknown> {
  filter?: {
    since?: string; // 开始时间 ISO 8601
    to?: string; // 结束时间 ISO 8601
    status?: OzonPostingStatus; // 状态
    order_number?: string; // 订单编号
    posting_number?: string; // 订单号
    product_name?: string; // 商品名称
    offer_id?: string; // SKU编码
    delivery_method_id?: number; // 配送方式ID
    provider_id?: number; // 物流商ID
    warehouse_id?: number; // 仓库ID
    last_changed_since?: string; // 最后变更时间
    is_split?: boolean; // 是否拆分订单
  };
  dir?: 'ASC' | 'DESC'; // 排序方向
  limit?: number; // 每页数量，最大1000
  offset?: number; // 偏移量
  with?: {
    analytics_data?: boolean; // 包含分析数据
    financial_data?: boolean; // 包含财务数据
    translit?: boolean; // 是否转译
    additional_data?: boolean; // 包含附加数据
  };
}

// 订单列表响应
export interface OzonPostingListResponse {
  result: {
    postings: Array<{
      posting_number: string;
      order_id: number;
      order_number: string;
      status: OzonPostingStatus;
      in_process_at: string;
      created_at: string;
    }>;
    has_next: boolean;
  };
}

// 订单详情请求参数
export interface OzonPostingGetRequest extends Record<string, unknown> {
  posting_number: string;
  with?: {
    analytics_data?: boolean;
    financial_data?: boolean;
    translit?: boolean;
    additional_data?: boolean;
    barcodes?: boolean;
  };
}

// 订单详情响应
export interface OzonPostingGetResponse {
  result: OzonPosting;
}

// 打包订单请求
export interface OzonPostingShipRequest extends Record<string, unknown> {
  posting_number: string;
  packages: Array<{
    products: Array<{
      product_id: number;
      quantity: number;
    }>;
  }>;
}

// 打包订单响应
export interface OzonPostingShipResponse {
  result: Array<{
    posting_number: string;
    package_number?: string;
    error?: {
      code: string;
      message: string;
    };
  }>;
}

// 设置物流单号请求
export interface OzonSetTrackingNumberRequest extends Record<string, unknown> {
  posting_number: string;
  tracking_number: string;
}

// 设置物流单号响应
export interface OzonSetTrackingNumberResponse {
  result: boolean;
}

// 标记发货请求
export interface OzonDeliveringRequest extends Record<string, unknown> {
  posting_number: string;
}

// 标记发货响应
export interface OzonDeliveringResponse {
  result: boolean;
}

// 获取面单请求
export interface OzonLabelRequest extends Record<string, unknown> {
  posting_numbers: string[];
  file_type?: 'pdf' | 'zpl';
}

// 获取面单响应
export interface OzonLabelResponse {
  result: {
    file: string; // Base64编码的文件
  };
}

// API错误响应
export interface OzonApiError {
  code: number;
  message: string;
  details?: unknown[];
}

// ERP订单类型（扩展Ozon订单）
export interface Order {
  id: string;
  postingNumber: string;
  orderId: number;
  orderNumber: string;
  status: OzonPostingStatus;
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingCountry?: string;
  products: OrderProduct[];
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  trackingNumber?: string;
  syncStatus: 'synced' | 'pending' | 'failed';
  lastSyncAt: string;
  shopId: string;
}

// ERP订单商品
export interface OrderProduct {
  offerId: string;
  name: string;
  quantity: number;
  price: number;
  productId?: number;
  imageUrl?: string;
}

// 订单同步结果
export interface OrderSyncResult {
  total: number;
  new: number;
  updated: number;
  failed: number;
  errors?: Array<{
    postingNumber: string;
    error: string;
  }>;
}

// 订单查询参数
export interface OrderQueryParams {
  page?: number;
  limit?: number;
  status?: OzonPostingStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
  shopId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
