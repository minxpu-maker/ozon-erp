/**
 * Ozon Seller API 客户端
 * 文档: https://docs.ozon.ru/api/seller/
 */

import {
  OzonPostingStatus,
} from '@/types/ozon';
import type {
  OzonConfig,
  OzonPostingListRequest,
  OzonPostingListResponse,
  OzonPostingGetRequest,
  OzonPostingGetResponse,
  OzonPostingShipRequest,
  OzonPostingShipResponse,
  OzonSetTrackingNumberRequest,
  OzonSetTrackingNumberResponse,
  OzonDeliveringRequest,
  OzonDeliveringResponse,
  OzonLabelRequest,
  OzonLabelResponse,
  OzonApiError,
} from '@/types/ozon';

export class OzonApiClient {
  private clientId: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OzonConfig) {
    this.clientId = config.clientId;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api-seller.ozon.ru';
  }

  /**
   * 发送API请求
   */
  private async request<T>(
    method: string,
    data: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${method}`;

    const headers: Record<string, string> = {
      'Client-Id': this.clientId,
      'Api-Key': this.apiKey,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      const error = result as OzonApiError;
      throw new OzonApiException(
        error.code || response.status,
        error.message || 'API request failed',
        error.details
      );
    }

    return result as T;
  }

  // ==================== 订单管理接口 ====================

  /**
   * 获取订单列表
   * POST /v3/posting/fbs/list
   */
  async getPostingList(
    params: OzonPostingListRequest
  ): Promise<OzonPostingListResponse> {
    return this.request<OzonPostingListResponse>('/v3/posting/fbs/list', params);
  }

  /**
   * 获取订单详情
   * POST /v3/posting/fbs/get
   */
  async getPosting(
    params: OzonPostingGetRequest
  ): Promise<OzonPostingGetResponse> {
    return this.request<OzonPostingGetResponse>('/v3/posting/fbs/get', params);
  }

  /**
   * 订单打包
   * POST /v3/posting/fbs/ship
   */
  async shipPosting(
    params: OzonPostingShipRequest
  ): Promise<OzonPostingShipResponse> {
    return this.request<OzonPostingShipResponse>('/v3/posting/fbs/ship', params);
  }

  /**
   * 设置物流单号
   * POST /v2/fbs/posting/tracking-number/set
   */
  async setTrackingNumber(
    params: OzonSetTrackingNumberRequest
  ): Promise<OzonSetTrackingNumberResponse> {
    return this.request<OzonSetTrackingNumberResponse>(
      '/v2/fbs/posting/tracking-number/set',
      params
    );
  }

  /**
   * 标记发货
   * POST /v2/fbs/posting/delivering
   */
  async markDelivering(
    params: OzonDeliveringRequest
  ): Promise<OzonDeliveringResponse> {
    return this.request<OzonDeliveringResponse>(
      '/v2/fbs/posting/delivering',
      params
    );
  }

  /**
   * 获取面单
   * POST /v1/posting/fbs/package-label/get
   */
  async getLabel(params: OzonLabelRequest): Promise<OzonLabelResponse> {
    return this.request<OzonLabelResponse>(
      '/v1/posting/fbs/package-label/get',
      params
    );
  }

  /**
   * 取消订单
   * POST /v2/posting/fbs/cancel
   */
  async cancelPosting(postingNumber: string, reasonId: number): Promise<{ result: boolean }> {
    return this.request<{ result: boolean }>('/v2/posting/fbs/cancel', {
      posting_number: postingNumber,
      cancel_reason_id: reasonId,
    });
  }

  // ==================== 商品管理接口 ====================

  /**
   * 获取商品信息列表
   * POST /v3/product/info/list
   */
  async getProductInfoList(productIds: number[]): Promise<{
    result: {
      items: Array<{
        id: number;
        name: string;
        offer_id: string;
        barcode: string;
        images: string[];
        status: {
          state: string;
        };
      }>;
    };
  }> {
    return this.request('/v3/product/info/list', {
      product_id: productIds,
    });
  }

  /**
   * 更新库存
   * POST /v2/products/stocks
   */
  async updateStocks(
    stocks: Array<{
      offer_id: string;
      product_id: number;
      stock: number;
    }>
  ): Promise<{
    result: Array<{
      product_id: number;
      offer_id: string;
      updated: boolean;
      errors?: string[];
    }>;
  }> {
    return this.request('/v2/products/stocks', {
      stocks,
    });
  }

  // ==================== 财务接口 ====================

  /**
   * 获取公司财务报告
   * POST /v3/finance/info
   */
  async getFinanceInfo(params: {
    from: string;
    to: string;
    page?: number;
    page_size?: number;
  }): Promise<{
    result: {
      operations: Array<{
        id: number;
        operation_type: string;
        operation_type_name: string;
        posting_number: string;
        amount: string;
        created_at: string;
      }>;
      page_count: number;
    };
  }> {
    return this.request('/v3/finance/info', params);
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取已付款待打包订单（用于订单同步）
   */
  async getAwaitingPackagingOrders(
    since?: string,
    to?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<OzonPostingListResponse> {
    return this.getPostingList({
      filter: {
        status: OzonPostingStatus.AWAITING_PACKAGING,
        since,
        to,
      },
      limit,
      offset,
      with: {
        analytics_data: true,
        financial_data: true,
      },
    });
  }

  /**
   * 批量获取订单详情
   */
  async getPostingsBatch(postingNumbers: string[]): Promise<Map<string, OzonPostingGetResponse['result']>> {
    const results = new Map();
    
    // 并发获取，限制并发数为5
    const batchSize = 5;
    for (let i = 0; i < postingNumbers.length; i += batchSize) {
      const batch = postingNumbers.slice(i, i + batchSize);
      const promises = batch.map((postingNumber) =>
        this.getPosting({
          posting_number: postingNumber,
          with: {
            analytics_data: true,
            financial_data: true,
            barcodes: true,
          },
        })
          .then((res) => ({ postingNumber, result: res.result }))
          .catch((error) => ({ postingNumber, error }))
      );
      
      const responses = await Promise.all(promises);
      for (const res of responses) {
        if ('result' in res) {
          results.set(res.postingNumber, res.result);
        }
      }
    }
    
    return results;
  }

  /**
   * 测试API连接
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // 尝试获取最近的订单，验证API配置
      const result = await this.getPostingList({
        limit: 1,
      });
      return {
        success: true,
        message: `连接成功，共有 ${result.result.postings.length} 条订单`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '连接失败',
      };
    }
  }
}

/**
 * Ozon API 异常类
 */
export class OzonApiException extends Error {
  constructor(
    public code: number,
    message: string,
    public details?: unknown[]
  ) {
    super(message);
    this.name = 'OzonApiException';
  }
}

/**
 * 创建Ozon API客户端实例
 */
export function createOzonClient(config: OzonConfig): OzonApiClient {
  return new OzonApiClient(config);
}
