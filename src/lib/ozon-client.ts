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
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      let data: unknown = null;
      if (isJson) {
        data = await response.json().catch(() => null);
      }

      // 429 Too Many Requests - 限流，自动退避重试
      if (status === 429 && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        console.log(`[OzonClient] Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await this.sleep(delay);
        return this.executeWithRetry<T>(url, method, headers, body, retryCount + 1);
      }

      // 非2xx状态码，提取错误信息
      if (!response.ok) {
        // data 为 null（响应非 JSON）时，优先用 HTTP 状态码描述
        if (data === null) {
          const httpMessages: Record<number, string> = {
            400: '请求参数错误',
            401: '认证失败，Client-Id 或 Api-Key 无效',
            403: '无访问权限，请检查 API 权限',
            404: 'API端点不存在或网络不通（沙箱环境可能无法访问外网）',
            429: '请求频率超限，请稍后重试',
            500: 'Ozon 服务器内部错误',
            502: '网关错误，请稍后重试',
            503: '服务不可用，请稍后重试',
          };
          return {
            ok: false,
            status,
            error: httpMessages[status] || `HTTP ${status}（网络不通或API不可达）`,
          };
        }
        const errMsg = this.extractError(data);
        return {
          ok: false,
          data: data as T,
          status,
          error: errMsg || `HTTP ${status}`,
        };
      }

      // 2xx 但响应体不是JSON（可能被代理劫持）
      if (!isJson || data === null) {
        return {
          ok: false,
          data: undefined,
          status,
          error: 'API响应格式异常（可能网络不通）',
        };
      }

      return {
        ok: true,
        data: data as T,
        status,
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

    // Ozon API 标准错误格式 { "code": 16, "message": "..." }
    if (obj.message) {
      return String(obj.message);
    }

    // { "error": "..." }
    if (typeof obj.error === 'string') {
      return obj.error;
    }

    // { "error_code": "..." }
    if (typeof obj.error_code === 'string') {
      return obj.error_code;
    }

    // { "code": 16 }
    if (obj.code !== undefined) {
      const code = Number(obj.code);
      const codeMessages: Record<number, string> = {
        1: '未授权，请检查 Client-Id 和 Api-Key',
        16: '认证凭据无效',
        100: '参数错误',
        500: 'Ozon 服务器内部错误',
      };
      return codeMessages[code] || `错误码 ${code}`;
    }

    // 尝试提取第一个错误消息
    const errorMessages = obj.errors || obj.error_message || obj.errorMessages;
    if (Array.isArray(errorMessages) && errorMessages.length > 0) {
      return String(errorMessages[0]);
    }

    // { "errors": [{ "code": "...", "message": "..." }] }
    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
      const first = obj.errors[0] as Record<string, unknown>;
      if (first.message) return String(first.message);
      if (first.code) return String(first.code);
    }

    // 返回原始数据片段作为线索
    const keys = Object.keys(obj).slice(0, 3).map(k => `${k}:${JSON.stringify(obj[k])}`).join(', ');
    return keys || '未知错误';
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
}

/**
 * 快捷方法：测试连接
 * 使用最简单的接口验证API凭证是否有效
 */
export async function testConnection(clientId: string, apiKey: string): Promise<{
  connected: boolean;
  error?: string;
}> {
  const client = new OzonClient({ clientId, apiKey });
  const response = await client.get<{ result: unknown }>('/v2/product/list?limit=1');

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

/**
 * 快捷请求方法：使用 clientId 和 apiKey 直接发起请求
 * 适用于不需要复用客户端的场景
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
