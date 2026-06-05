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

// v3/product/info/list 返回的商品信息（包含图片）
export interface OzonProductInfo {
  id: number;
  name: string;
  offer_id: string;
  barcode?: string;
  price?: string;
  old_price?: string;
  marketing_price?: string;
  premium_price?: string;
  buybox_price?: string;
  category_id?: number;
  category_name?: string;
  created_at?: string;
  images?: string[]; // 图片URL数组
  primary_image?: string; // 主图URL
  status?: {
    state?: string;
    state_name?: string;
  };
  stocks?: {
    coming?: number;
    present?: number;
    reserved?: number;
  };
  sources?: Array<{
    source: string;
    is_enabled: boolean;
  }>;
  vat?: string;
  visibility?: {
    has_price?: boolean;
    is_visible?: boolean;
  };
  dimensions?: {
    weight?: number;
    height?: number;
    depth?: number;
    width?: number;
  };
}

export interface OzonProductDetail {
  id: number;
  name: string;
  offer_id: string;
  barcode?: string;
  description?: string;
  default_image?: string;
  images: Array<{
    url: string;
    is_main?: boolean;
    order?: number;
  }>;
  attributes: Array<{
    attribute_id: number;
    name: string;
    value: string;
  }>;
  color_image?: string;
  primary_image?: string;
  vat: string;
  type_id: number;
  sources: Array<{
    source: string;
    is_enabled: boolean;
  }>;
  status: {
    value: string;
  };
  price: {
    price: string;
    marketing_price?: string;
    old_price?: string;
    premium_price?: string;
  };
  dimensions: {
    weight: number;
    height: number;
    depth: number;
    width: number;
  };
  variants?: Array<{
    id: number;
    offer_id: string;
    name: string;
    color_image?: string;
    barcode?: string;
    default_image?: string;
    images?: Array<string>;
    attributes?: Array<{
      attribute_id: number;
      name: string;
      value: string;
    }>;
  }>;
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
   * 获取商品信息列表（含图片）
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
   * 按offer_id获取商品信息列表（含图片）
   * POST /v3/product/info/list
   */
  async getProductInfoByOfferId(offerIds: string[]): Promise<{
    result: {
      items: OzonProductInfo[];
    };
  }> {
    const response = await this.request<{
      result?: {
        items?: OzonProductInfo[];
      };
      items?: OzonProductInfo[];
    }>('/v3/product/info/list', {
      offer_id: offerIds,
    });
    
    // 处理不同的响应结构
    console.log('[Ozon API] /v3/product/info/list response:', JSON.stringify(response).substring(0, 500));
    
    // 有些版本的API可能直接返回items而不是result.items
    if (response.result?.items) {
      return response as { result: { items: OzonProductInfo[] } };
    } else if ((response as any).items) {
      return { result: { items: (response as any).items } };
    }
    
    // 返回空数组而不是抛出错误
    console.warn('[Ozon API] Unexpected response structure:', response);
    return { result: { items: [] } };
  }

  /**
   * 获取商品详情（含图片）
   * POST /v2/product/info
   */
  async getProductDetail(offerIds: string[]): Promise<{
    result: {
      items: OzonProductDetail[];
    };
  }> {
    return this.request<{
      result: {
        items: OzonProductDetail[];
      };
    }>('/v2/product/info', {
      offer_id: offerIds,
    });
  }

  /**
   * 按product_id获取商品详情（含图片）
   * POST /v2/product/info
   */
  async getProductDetailByIds(productIds: number[]): Promise<{
    result: {
      items: OzonProductDetail[];
    };
  }> {
    return this.request<{
      result: {
        items: OzonProductDetail[];
      };
    }>('/v2/product/info', {
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
   * 获取FBS订单面单（PDF）
   * 文档: https://docs.ozon.ru/api/seller/#operation/PostingAPI_GetPackageLabel
   */
  async getPackageLabel(postingNumbers: string[]): Promise<{
    fileUrl: string; // 面单PDF下载链接
    printedCount: number;
    unprintedCount: number;
  }> {
    // 步骤1: 创建面单任务
    const createResponse = await fetch(`${OZON_API_BASE_URL}/v2/posting/fbs/package-label/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': this.config.clientId,
        'Api-Key': this.config.apiKey,
      },
      body: JSON.stringify({
        posting_numbers: postingNumbers,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new OzonApiError(
        `Failed to create package label task: ${createResponse.status}`,
        createResponse.status,
        errorText
      );
    }

    const createResult = await createResponse.json() as { result: { tasks: { task_id: number; task_type: string }[] } };
    const taskId = createResult.result?.tasks?.[0]?.task_id;

    if (!taskId) {
      throw new OzonApiError('No task_id in response', 500, JSON.stringify(createResult));
    }

    // 步骤2: 获取任务结果（面单PDF）
    const resultResponse = await fetch(`${OZON_API_BASE_URL}/v1/posting/fbs/package-label/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': this.config.clientId,
        'Api-Key': this.config.apiKey,
      },
      body: JSON.stringify({
        task_id: taskId,
      }),
    });

    if (!resultResponse.ok) {
      const errorText = await resultResponse.text();
      throw new OzonApiError(
        `Failed to get package label PDF: ${resultResponse.status}`,
        resultResponse.status,
        errorText
      );
    }

    // 解析响应获取文件URL
    const result = await resultResponse.json() as {
      result: {
        error: string;
        status: string;
        file_url: string;
        printed_postings_count: number;
        unprinted_postings_count: number;
        unprinted_postings: string[];
      }
    };
    
    if (!result.result?.file_url) {
      throw new OzonApiError('No file_url in response', 500, JSON.stringify(result));
    }
    
    return {
      fileUrl: result.result.file_url,
      printedCount: result.result.printed_postings_count,
      unprintedCount: result.result.unprinted_postings_count,
    };
  }

  /**
   * 获取应计费用列表（收单业务费用等）
   * POST /v3/finance/cash-flow-statement/list
   * 文档: https://docs.ozon.ru/api/seller/#operation/FinanceAPI_GetCashFlowStatementList
   */
  async getAccruals(params: {
    filter?: {
      date?: {
        from: string;
        to: string;
      };
      posting_number?: string;
      transaction_type?: string;
    };
    page?: number;
    page_size?: number;
  } = {}): Promise<{
    result: {
      operations: Array<{
        id: number;
        posting_number: string;
        order_id: number;
        operation_type: string;
        operation_type_name: string;
        amount: string;
        currency_code: string;
        date: string;
        product_id?: number;
        product_name?: string;
        sku?: number;
        offer_id?: string;
      }>;
      page_count: number;
      total_operations_count: number;
    };
  }> {
    return this.request<{
      result: {
        operations: Array<{
          id: number;
          posting_number: string;
          order_id: number;
          operation_type: string;
          operation_type_name: string;
          amount: string;
          currency_code: string;
          date: string;
          product_id?: number;
          product_name?: string;
          sku?: number;
          offer_id?: string;
        }>;
        page_count: number;
        total_operations_count: number;
      };
    }>('/v3/finance/cash-flow-statement/list', {
      filter: params.filter || {},
      page: params.page || 1,
      page_size: params.page_size || 1000,
    });
  }

  /**
   * 获取订单的应计费用（收单业务费用等）
   * 通过posting_number筛选
   */
  async getOrderAccruals(postingNumber: string): Promise<{
    acquiringFee: number; // 收单业务费用
    otherFees: number; // 其他费用
    details: Array<{
      type: string;
      typeName: string;
      amount: number;
      currency: string;
    }>;
  }> {
    try {
      const response = await this.getAccruals({
        filter: {
          posting_number: postingNumber,
        },
        page_size: 100,
      });

      const operations = response.result?.operations || [];
      let acquiringFee = 0;
      let otherFees = 0;
      const details: Array<{
        type: string;
        typeName: string;
        amount: number;
        currency: string;
      }> = [];

      for (const op of operations) {
        const amount = parseFloat(op.amount || '0');
        
        // 收单业务费用 (Ozon Bank收单费)
        if (op.operation_type_name?.includes('收单') || 
            op.operation_type_name?.toLowerCase().includes('acquiring') ||
            op.operation_type === 'MarketplaceServiceAcquiring') {
          acquiringFee += Math.abs(amount);
        } else if (amount < 0) {
          // 其他负数金额为费用
          otherFees += Math.abs(amount);
        }

        details.push({
          type: op.operation_type,
          typeName: op.operation_type_name,
          amount: amount,
          currency: op.currency_code,
        });
      }

      return {
        acquiringFee,
        otherFees,
        details,
      };
    } catch (error) {
      console.error('[Ozon API] Failed to get order accruals:', error);
      return {
        acquiringFee: 0,
        otherFees: 0,
        details: [],
      };
    }
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
