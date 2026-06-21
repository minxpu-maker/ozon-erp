/**
 * Ozon Seller API 客户端封装
 * 基础URL: https://api-seller.ozon.ru
 */

const BASE_URL = 'https://api-seller.ozon.ru';
const TIMEOUT_MS = 10000; // 10秒超时
const MAX_RETRIES = 3;

// 退避间隔（毫秒）
const RETRY_DELAYS = [1000, 2000, 4000];

export interface OzonResponse<T = unknown> {
  ok: boolean;
  data?: T;
  status?: number;
  error?: string;
  retryable?: boolean;
}

export interface OzonClientConfig {
  clientId: string;
  apiKey: string;
}

/**
 * Ozon API 客户端
 */
export class OzonClient {
  private clientId: string;
  private apiKey: string;

  constructor(config: OzonClientConfig) {
    this.clientId = config.clientId;
    this.apiKey = config.apiKey;
  }

  /**
   * 执行API请求
   */
  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    customHeaders?: Record<string, string>
  ): Promise<OzonResponse<T>> {
    const url = `${BASE_URL}${path}`;
    
    const headers: Record<string, string> = {
      'Client-Id': this.clientId,
      'Api-Key': this.apiKey,
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    return this.executeWithRetry<T>(url, method, headers, body);
  }

  /**
   * 带重试的请求执行
   */
  private async executeWithRetry<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: unknown,
    retryCount = 0
  ): Promise<OzonResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const status = response.status;
      const data = await response.json().catch(() => null);

      // 检查响应体中的业务错误（即使HTTP状态码是200）
      const businessError = this.extractBusinessError(data);
      
      // 调试日志
      console.log('[OzonClient] Response:', { status, ok: response.ok, businessError, data });
      
      // 429 Too Many Requests - 限流，自动退避重试
      if (status === 429 && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        console.log(`[OzonClient] Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await this.sleep(delay);
        return this.executeWithRetry<T>(url, method, headers, body, retryCount + 1);
      }

      // 判断成功：HTTP状态码为2xx 且 无业务错误
      const isSuccess = response.ok && !businessError;
      
      return {
        ok: isSuccess,
        data: data as T,
        status,
        error: isSuccess ? undefined : (businessError || this.extractError(data)),
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // 网络错误，判断是否可重试
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            ok: false,
            error: '请求超时',
            status: 408,
          };
        }

        // 网络连接错误，可重试
        if (retryCount < MAX_RETRIES && this.isRetryableError(error)) {
          const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          console.log(`[OzonClient] Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await this.sleep(delay);
          return this.executeWithRetry<T>(url, method, headers, body, retryCount + 1);
        }

        return {
          ok: false,
          error: error.message || '网络连接失败',
        };
      }

      return {
        ok: false,
        error: '未知错误',
      };
    }
  }

  /**
   * 提取错误信息
   */
  private extractError(data: unknown): string {
    if (!data || typeof data !== 'object') {
      return '未知错误';
    }

    const obj = data as Record<string, unknown>;
    
    // Ozon API 标准错误格式
    if (obj.message) {
      return String(obj.message);
    }
    
    if (obj.error) {
      return String(obj.error);
    }

    if (obj.code) {
      return String(obj.code);
    }

    // 尝试提取第一个错误消息
    const errorMessages = obj.errors || obj.error_message || obj.errorMessages;
    if (Array.isArray(errorMessages) && errorMessages.length > 0) {
      return String(errorMessages[0]);
    }

    return '未知错误';
  }

  /**
   * 提取 Ozon API 业务错误（即使HTTP状态码是200）
   * Ozon API 错误格式: { code: 1, message: "Api-key is deactivated" }
   * code > 0 表示业务错误
   */
  private extractBusinessError(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    const obj = data as Record<string, unknown>;
    
    // 检查 code 字段（Ozon API 业务错误码）
    // code: 1 = Api-key is deactivated
    // code: 3 = Invalid API key
    // code: 10 = Invalid client_id
    if (typeof obj.code === 'number' && obj.code > 0) {
      // 特殊处理常见错误消息
      if (obj.code === 1 && typeof obj.message === 'string') {
        return `API密钥已失效: ${obj.message}`;
      }
      return `API错误 (code: ${obj.code}): ${obj.message || '未知错误'}`;
    }
    
    // 检查 message 中是否包含密钥相关错误
    if (typeof obj.message === 'string') {
      const msgLower = obj.message.toLowerCase();
      if (msgLower.includes('deactivated') || 
          msgLower.includes('invalid') && msgLower.includes('key') ||
          msgLower.includes('expired')) {
        return `API密钥无效: ${obj.message}`;
      }
    }

    return undefined;
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('socket') ||
      message.includes('fetch')
    );
  }

  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET 请求
   */
  async get<T = unknown>(path: string, headers?: Record<string, string>): Promise<OzonResponse<T>> {
    return this.request<T>('GET', path, undefined, headers);
  }

  /**
   * POST 请求
   */
  async post<T = unknown>(path: string, body: unknown, headers?: Record<string, string>): Promise<OzonResponse<T>> {
    return this.request<T>('POST', path, body, headers);
  }

  /**
   * PUT 请求
   */
  async put<T = unknown>(path: string, body: unknown, headers?: Record<string, string>): Promise<OzonResponse<T>> {
    return this.request<T>('PUT', path, body, headers);
  }

  /**
   * DELETE 请求
   */
  async delete<T = unknown>(path: string, headers?: Record<string, string>): Promise<OzonResponse<T>> {
    return this.request<T>('DELETE', path, undefined, headers);
  }

  /**
   * 获取订单商品图片（通过offer_id查询商品信息获取图片）
   * POST /v3/product/info/list
   * @param postingNumber - Ozon货件号
   * @param offerIds - 商品SKU列表（从订单products中提取offer_id）
   * @returns 包含图片URL的映射 { offer_id: { imageUrl, productId } }
   */
  async getPostingDetails(postingNumber: string, offerIds: string[] = []): Promise<Record<string, { imageUrl?: string; productId?: number }>> {
    try {
      // 如果没有offer_ids，直接返回空
      if (offerIds.length === 0) {
        console.log(`[OzonClient] getPostingDetails: no offer IDs for ${postingNumber}`);
        return {};
      }

      // 调用商品信息API获取图片（使用v3版本，响应格式更清晰）
      const response = await this.post<{
        result?: {
          items?: Array<{
            product_id: number;
            offer_id: string;
            name?: string;
            images?: string[];
          }>;
        };
      }>('/v3/product/info/list', {
        offer_id: offerIds,
      });

      // Ozon v3/product/info/list API 响应格式是 { items: [...] }
      if (response.ok && response.data?.items) {
        const productMap: Record<string, { imageUrl?: string; productId?: number }> = {};
        for (const p of response.data.items) {
          // 使用offer_id作为key
          if (p.images && p.images.length > 0) {
            productMap[p.offer_id] = {
              imageUrl: p.images[0], // 取第一张图（主图）
              productId: p.product_id,
            };
          } else {
            productMap[p.offer_id] = {
              productId: p.product_id,
            };
          }
        }
        console.log(`[OzonClient] getPostingDetails: got ${Object.keys(productMap).length}/${offerIds.length} products for ${postingNumber}`);
        return productMap;
      }
      console.log(`[OzonClient] getPostingDetails: no result for ${postingNumber}`);
      return {};
    } catch (error) {
      console.error('[OzonClient] 获取订单详情失败:', error);
      return {};
    }
  }

  /**
   * 获取商品图片信息
   * POST /v2/product/info
   * @param productId - Ozon商品ID
   * @returns 商品图片URL列表
   */
  async getProductImages(productId: number): Promise<string[]> {
    try {
      const response = await this.post<{
        result?: {
          images?: Array<{ url: string; index: number }>;
        };
      }>('/v2/product/info', {
        product_id: productId,
      });

      if (response.ok && response.data?.result?.images) {
        // 返回第一张图片（主图）
        const images = response.data.result.images
          .sort((a, b) => (a.index || 0) - (b.index || 0))
          .map(img => img.url);
        return images;
      }
      return [];
    } catch (error) {
      console.error('[OzonClient] 获取商品图片失败:', error);
      return [];
    }
  }

  /**
   * 批量获取商品图片信息
   * POST /v2/product/info/list
   * @param productIds - Ozon商品ID列表
   * @returns 商品ID到图片URL的映射
   */
  async getProductImagesBatch(productIds: number[]): Promise<Record<number, string>> {
    const result: Record<number, string> = {};
    
    if (productIds.length === 0) return result;

    try {
      const response = await this.post<{
        result?: Array<{
          product_id: number;
          images?: Array<{ url: string; index: number }>;
        }>;
      }>('/v2/product/info/list', {
        product_id: productIds,
      });

      if (response.ok && response.data?.result) {
        for (const item of response.data.result) {
          if (item.images && item.images.length > 0) {
            // 按index排序取第一张（主图）
            const sortedImages = item.images
              .sort((a, b) => (a.index || 0) - (b.index || 0));
            result[item.product_id] = sortedImages[0].url;
          }
        }
      }
    } catch (error) {
      console.error('[OzonClient] 批量获取商品图片失败:', error);
    }
    
    return result;
  }

  /**
   * 通过offer_id（SKU）获取商品图片
   * POST /v1/product/info/list
   * @param offerIds - SKU列表
   * @returns SKU到图片URL的映射
   */
  async getProductImagesByOfferIds(offerIds: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    
    if (offerIds.length === 0) return result;

    try {
      const response = await this.post<{
        result?: Array<{
          offer_id: string;
          images?: string[];
          primary_image?: string;
        }>;
      }>('/v1/product/info/list', {
        offer_id: offerIds,
      });

      if (response.ok && response.data?.result) {
        for (const item of response.data.result) {
          // 优先使用primary_image，其次使用images数组第一张
          if (item.primary_image) {
            result[item.offer_id] = item.primary_image;
          } else if (item.images && item.images.length > 0) {
            result[item.offer_id] = item.images[0];
          }
        }
      }
    } catch (error) {
      console.error('[OzonClient] 通过offer_id获取商品图片失败:', error);
    }
    
    return result;
  }
}

/**
 * 快捷请求方法
 */
export async function ozonRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  apiKey?: string,
  clientId?: string
): Promise<OzonResponse> {
  const key = apiKey || process.env.OZON_API_KEY;
  const id = clientId || process.env.OZON_CLIENT_ID;

  if (!key || !id) {
    return { ok: false, error: '缺少API凭证' };
  }

  const client = new OzonClient({ clientId: id, apiKey: key });
  return client.request(method, path, body);
}

/**
 * 快捷方法：测试连接
 * 使用 v3 API 验证 API 凭证是否有效
 */
export async function testConnection(clientId: string, apiKey: string): Promise<{
  connected: boolean;
  error?: string;
}> {
  const client = new OzonClient({ clientId, apiKey });
  const response = await client.post<{ result: unknown }>('/v3/product/list', {
    filter: { category_id: 0 },
    limit: 1,
  });

  if (response.ok) {
    return { connected: true };
  }

  // 根据状态码返回具体错误
  if (response.status === 401 || response.status === 403) {
    return { connected: false, error: 'API密钥无效或已过期' };
  }

  if (response.status === 429) {
    return { connected: false, error: '请求频率受限，请稍后重试' };
  }

  return {
    connected: false,
    error: response.error || '连接失败',
  };
}
