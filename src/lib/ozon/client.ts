/**
 * Ozon Seller API 客户端
 * 文档: https://docs.ozon.ru/api/seller/zh/
 */

const OZON_API_BASE_URL = 'https://api-seller.ozon.ru';

export interface OzonConfig {
  clientId: string;
  apiKey: string;
  shopId?: string;
}

export interface OzonOrder {
  posting_number: string;
  order_id: number;
  order_number: string;
  status: string;
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
  products?: Array<{
    sku: number;
    name: string;
    price: string;
    offer_id: string;
    quantity: number;
    dimensions?: {
      width: string;
      height: string;
      length: string;
      weight: string;
    };
    currency_code?: string;
  }>;
  address?: {
    address_line: string;
    city: string;
    country: string;
    postal_code: string;
    recipient: string;
    phone: string;
  };
  created_at: string;
  in_process_at: string;
  tracking_number?: string;
  delivery_price?: string;
  shipments?: Array<{
    posting_number: string;
    items: Array<{
      item_id: number;
      quantity: number;
    }>;
    tracking_number: string;
  }>;
}

export interface OzonOrderListResponse {
  result: {
    postings: OzonOrder[];
    has_next: boolean;
    cursor?: string;
  };
}

export interface OzonProduct {
  id: number;
  name: string;
  offer_id: string;
  barcode: string;
  buybox_price: string;
  marketing_price: string;
  price: {
    price: string;
  };
  sources: Array<{
    is_enabled: boolean;
    source: string;
  }>;
  stocks: Array<{
    present: number;
    reserved: number;
    warehouse_id: number;
    warehouse_name: string;
  }>;
  visibility: {
    has_price: boolean;
    is_visible: boolean;
  };
}

export interface OzonPackageLabel {
  id: number;
  url: string;
}

/**
 * Ozon API 客户端类
 */
export class OzonApiClient {
  private config: OzonConfig;

  constructor(config: OzonConfig) {
    this.config = config;
  }

  /**
   * 发送API请求
   */
  private async request<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
    const url = `${OZON_API_BASE_URL}${path}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Client-Id': this.config.clientId,
        'Api-Key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OzonApiError(`Ozon API error: ${response.status}`, response.status, errorText);
    }

    return response.json() as Promise<T>;
  }

  /**
   * 获取FBS订单列表
   * POST /v3/posting/fbs/list
   */
  async getFbsOrders(params: {
    dir?: 'asc' | 'desc';
    filter?: {
      since?: string;
      to?: string;
      status?: string;
      posting_number?: string[];
      order_id?: number[];
    };
    limit?: number;
    offset?: number;
    transliterated_fields?: boolean;
    with?: {
      analytics_data?: boolean;
      barcodes?: boolean;
      financial_data?: boolean;
      is_translit?: boolean;
      product_ids?: boolean;
      related_postings?: boolean;
      sku_first?: boolean;
    };
    cursor?: string;
  } = {}): Promise<OzonOrderListResponse> {
    return this.request<OzonOrderListResponse>('/v3/posting/fbs/list', {
      dir: params.dir || 'desc',
      filter: params.filter || {},
      limit: params.limit || 100,
      offset: params.offset || 0,
      transliterated_fields: params.transliterated_fields ?? true,
      with: params.with || {
        analytics_data: true,
        financial_data: true,
        barcodes: true,
        related_postings: true,
      },
      cursor: params.cursor,
    });
  }

  /**
   * 获取FBS订单详情
   * POST /v3/posting/fbs/get
   */
  async getFbsOrder(postingNumber: string): Promise<{ result: OzonOrder }> {
    return this.request<{ result: OzonOrder }>('/v3/posting/fbs/get', {
      posting_number: postingNumber,
      transliterated_fields: true,
      with: {
        analytics_data: true,
        financial_data: true,
        barcodes: true,
        product_ids: true,
        related_postings: true,
      },
    });
  }

  /**
   * 订单打包
   * POST /v3/posting/fbs/ship
   */
  async shipOrder(params: {
    posting_number: string;
    packages: Array<{
      items: Array<{
        item_id: number;
        quantity: number;
      }>;
    }>;
  }): Promise<{ result: boolean }> {
    return this.request<{ result: boolean }>('/v3/posting/fbs/ship', params);
  }

  /**
   * 设置物流单号
   * POST /v2/fbs/posting/tracking-number/set
   */
  async setTrackingNumber(params: {
    posting_number: string;
    tracking_number: string;
  }): Promise<{ result: boolean }> {
    return this.request<{ result: boolean }>('/v2/fbs/posting/tracking-number/set', params);
  }

  /**
   * 标记发货
   * POST /v2/fbs/posting/delivering
   */
  async markAsDelivering(postingNumber: string): Promise<{ result: boolean }> {
    return this.request<{ result: boolean }>('/v2/fbs/posting/delivering', {
      posting_number: postingNumber,
    });
  }

  /**
   * 获取面单PDF
   * POST /v1/posting/fbs/package-label/get
   */
  async getPackageLabel(params: {
    posting_number: string;
  }): Promise<{ result: OzonPackageLabel[] }> {
    return this.request<{ result: OzonPackageLabel[] }>('/v1/posting/fbs/package-label/get', {
      posting_number: params.posting_number,
    });
  }

  /**
   * 获取商品信息列表
   * POST /v3/product/info/list
   */
  async getProductInfo(productIds: number[]): Promise<{
    result: {
      items: OzonProduct[];
    };
  }> {
    return this.request<{
      result: {
        items: OzonProduct[];
      };
    }>('/v3/product/info/list', {
      product_id: productIds,
    });
  }

  /**
   * 更新库存
   * POST /v2/products/stocks
   */
  async updateStocks(stocks: Array<{
    offer_id: string;
    stock: number;
    warehouse_id?: number;
  }>): Promise<{ result: boolean }> {
    return this.request<{ result: boolean }>('/v2/products/stocks', {
      stocks: stocks.map(s => ({
        offer_id: s.offer_id,
        stock: s.stock,
        warehouse_id: s.warehouse_id || 0,
      })),
    });
  }

  /**
   * 获取订单状态列表（按Ozon状态码映射）
   */
  static getOzonStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'awaiting_packaging': '待打包',
      'awaiting_deliver': '待发货',
      'delivering': '配送中',
      'delivered': '已送达',
      'cancelled': '已取消',
      'not_accepted': '未接收',
      'awaiting_registration': '待登记',
      'arbitration': '仲裁中',
      'client_canceled': '客户取消',
      'awaits_cancellation_by_user': '等待用户取消',
    };
    return statusMap[status] || status;
  }

  /**
   * 映射Ozon订单状态到ERP状态
   */
  static mapOzonStatusToErp(ozonStatus: string): string {
    const statusMap: Record<string, string> = {
      'awaiting_packaging': 'paid',           // 已付款待打包
      'awaiting_deliver': 'ready_to_ship',    // 待发货
      'delivering': 'shipped',                // 已发货
      'delivered': 'delivered',               // 已送达
      'cancelled': 'cancelled',               // 已取消
      'not_accepted': 'cancelled',            // 未接收-取消
      'awaiting_registration': 'pending',     // 待登记
      'arbitration': 'dispute',               // 仲裁中
      'client_canceled': 'cancelled',         // 客户取消
      'awaits_cancellation_by_user': 'pending_cancel', // 待取消
    };
    return statusMap[ozonStatus] || 'unknown';
  }
}

/**
 * Ozon API 错误类
 */
export class OzonApiError extends Error {
  public statusCode: number;
  public responseBody: string;

  constructor(message: string, statusCode: number, responseBody: string) {
    super(message);
    this.name = 'OzonApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

/**
 * 创建Ozon API客户端实例
 */
export function createOzonClient(config?: OzonConfig): OzonApiClient {
  const clientId = config?.clientId || process.env.OZON_CLIENT_ID || '';
  const apiKey = config?.apiKey || process.env.OZON_API_KEY || '';
  const shopId = config?.shopId || process.env.OZON_SHOP_ID;

  if (!clientId || !apiKey) {
    throw new Error('Ozon API credentials not configured. Please set OZON_CLIENT_ID and OZON_API_KEY environment variables.');
  }

  return new OzonApiClient({
    clientId,
    apiKey,
    shopId,
  });
}
