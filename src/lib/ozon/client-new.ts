/**
 * Ozon Seller API 客户端
 * 所有 Ozon API 调用的统一出口
 * 文档: https://docs.ozon.ru/api/seller/zh/
 */

import { Priority, OzonApiResponse, OzonApiError } from './types';
import { rateLimiter, acquireToken, checkRateLimit } from './rate-limiter';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

// ==================== 常量配置 ====================

const OZON_API_BASE_URL = 'https://api-seller.ozon.ru';
const REQUEST_TIMEOUT_MS = 30000; // 30秒超时
const MAX_RETRIES = 3; // 最大重试次数
const INITIAL_RETRY_DELAY_MS = 1000; // 初始重试延迟1秒

// ==================== 类型定义 ====================

/**
 * 店铺凭证
 */
interface ShopCredentials {
  clientId: string;
  apiKey: string;
  shopId: string;
}

/**
 * 请求选项
 */
interface RequestOptions {
  priority?: Priority;
  skipRateLimit?: boolean;
}

/**
 * API响应Header中的速率限制信息
 */
interface RateLimitHeaders {
  remaining: number | null;
  resetAt: Date | null;
}

// ==================== 辅助函数 ====================

/**
 * 从数据库获取店铺凭证
 */
async function getShopCredentials(shopId: string): Promise<ShopCredentials> {
  const shop = await db.query.shops.findFirst({
    where: eq(shops.id, shopId),
    columns: {
      id: true,
      client_id: true,
      api_key: true,
    },
  });

  if (!shop) {
    throw new Error(`Shop not found: ${shopId}`);
  }

  if (!shop.client_id || !shop.api_key) {
    throw new Error(`Ozon credentials not configured for shop: ${shopId}`);
  }

  return {
    clientId: shop.client_id,
    apiKey: shop.api_key,
    shopId,
  };
}

/**
 * 更新店铺的速率限制信息到数据库
 */
async function updateRateLimitInDb(
  shopId: string,
  remaining: number | null,
  resetAt: Date | null
): Promise<void> {
  try {
    await db
      .update(shops)
      .set({
        api_rate_limit_remaining: remaining,
        api_rate_limit_reset_at: resetAt,
      })
      .where(eq(shops.id, shopId));
  } catch (error) {
    console.error('[Ozon] Failed to update rate limit in DB:', error);
  }
}

/**
 * 记录速率限制事件到 data_source_health 表
 */
async function recordRateLimitEvent(shopId: string): Promise<void> {
  try {
    // 使用原始SQL插入
    await db.execute(sql`
      INSERT INTO data_source_health (source, status, last_check_at, error_message)
      VALUES (${`ozon_api_${shopId}`}, 'rate_limited', ${new Date()}, 'API rate limit exceeded (429)')
    `);
  } catch (error) {
    console.error('[Ozon] Failed to record rate limit event:', error);
  }
}

import { sql } from 'drizzle-orm';

/**
 * 从响应Header解析速率限制信息
 */
function parseRateLimitHeaders(headers: Headers): RateLimitHeaders {
  // Ozon API 可能在 Header 中返回速率限制信息
  // 常见的Header名称
  const remaining = headers.get('X-RateLimit-Remaining') || 
                   headers.get('X-Rate-Limit-Remaining') ||
                   headers.get('RateLimit-Remaining');
  
  const reset = headers.get('X-RateLimit-Reset') ||
               headers.get('X-Rate-Limit-Reset') ||
               headers.get('RateLimit-Reset');

  return {
    remaining: remaining ? parseInt(remaining, 10) : null,
    resetAt: reset ? new Date(parseInt(reset, 10) * 1000) : null,
  };
}

/**
 * 指数退避延迟
 */
function getRetryDelay(attempt: number): number {
  // 1秒 -> 2秒 -> 4秒 -> 8秒
  return INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
}

/**
 * 等待指定毫秒
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 核心请求函数 ====================

/**
 * 发送 Ozon API 请求（带限流和重试）
 * 
 * @param shopId - 店铺ID
 * @param endpoint - API端点路径 (如 /v3/product/list)
 * @param requestBody - 请求体
 * @param options - 请求选项
 * @returns 类型化的API响应
 */
export async function ozonRequest<T>(
  shopId: string,
  endpoint: string,
  requestBody: Record<string, unknown>,
  options: RequestOptions = {}
): Promise<T> {
  const priority = options.priority ?? Priority.P3;
  const skipRateLimit = options.skipRateLimit ?? false;

  // 1. 获取店铺凭证
  const credentials = await getShopCredentials(shopId);

  // 2. 检查速率限制
  if (!skipRateLimit && priority !== Priority.P0) {
    const status = checkRateLimit(shopId, priority);
    
    if (!status.allowed) {
      console.warn(`[Ozon] Rate limit check: waiting ${status.waitMs}ms for shop ${shopId}`);
      
      // 检查数据库中的剩余配额
      if (status.remaining <= 0) {
        throw new Error(`Rate limit exceeded for shop ${shopId}. No remaining quota.`);
      }
    }
  }

  // 3. 获取令牌（可能会等待）
  if (!skipRateLimit) {
    try {
      await acquireToken(shopId, priority);
    } catch (error) {
      console.error('[Ozon] Failed to acquire token:', error);
      throw error;
    }
  }

  // 4. 发送请求（带重试）
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await sendRequest<T>(credentials, endpoint, requestBody);
      return response;
    } catch (error) {
      lastError = error as Error;
      
      // 检查是否是 429 错误
      if (is429Error(error)) {
        console.warn(`[Ozon] 429 rate limited, attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
        
        // 记录速率限制事件
        await recordRateLimitEvent(shopId);
        
        // 如果还有重试机会，等待后重试
        if (attempt < MAX_RETRIES) {
          const delay = getRetryDelay(attempt);
          console.log(`[Ozon] Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
      }
      
      // 其他错误或重试次数用尽，抛出错误
      throw error;
    }
  }

  throw lastError || new Error('Unknown error');
}

/**
 * 发送单次 HTTP 请求
 */
async function sendRequest<T>(
  credentials: ShopCredentials,
  endpoint: string,
  requestBody: Record<string, unknown>
): Promise<T> {
  const url = `${OZON_API_BASE_URL}${endpoint}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': credentials.clientId,
        'Api-Key': credentials.apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 解析速率限制Header
    const rateLimit = parseRateLimitHeaders(response.headers);
    
    if (rateLimit.remaining !== null) {
      // 更新数据库中的速率限制信息
      await updateRateLimitInDb(credentials.shopId, rateLimit.remaining, rateLimit.resetAt);
      
      // 更新限流器状态
      rateLimiter.updateRemaining(credentials.shopId, rateLimit.remaining, rateLimit.resetAt || new Date());
    }

    // 处理非200响应
    if (!response.ok) {
      const errorText = await response.text();
      
      // 尝试解析错误JSON
      let errorCode = 'UNKNOWN';
      let errorMessage = errorText;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorCode = errorJson.error?.code || errorJson.code || errorCode;
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        // JSON解析失败，使用原始文本
      }

      // 抛出特定错误
      if (response.status === 429) {
        const error = new Error(`Ozon API rate limited: ${errorMessage}`);
        (error as any).status = 429;
        (error as any).code = errorCode;
        throw error;
      }

      throw new Error(`Ozon API error (${response.status}): [${errorCode}] ${errorMessage}`);
    }

    // 解析响应
    const text = await response.text();
    
    try {
      return JSON.parse(text) as T;
    } catch {
      console.error('[Ozon] Failed to parse response as JSON:', text.substring(0, 200));
      throw new Error('Failed to parse API response as JSON');
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    // 处理超时
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
    
    throw error;
  }
}

/**
 * 检查是否是 429 错误
 */
function is429Error(error: unknown): boolean {
  return (error as any)?.status === 429 || 
         (error as Error)?.message?.includes('rate limited') ||
         (error as Error)?.message?.includes('429');
}

// ==================== 便捷方法 ====================

/**
 * 创建店铺专用的请求函数
 */
export function createShopRequest(shopId: string) {
  return <T>(
    endpoint: string,
    requestBody: Record<string, unknown>,
    options?: RequestOptions
  ) => ozonRequest<T>(shopId, endpoint, requestBody, options);
}
