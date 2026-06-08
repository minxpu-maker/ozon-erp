/**
 * Ozon API 令牌桶限流器
 * 实现店铺级请求限流与优先级队列
 */

import { Priority, RateLimitStatus, QueuedRequest } from './types';

/**
 * 令牌桶配置
 */
interface TokenBucketConfig {
  maxTokens: number;      // 最大令牌数 (默认 3600/小时)
  refillRate: number;     // 每秒补充令牌数 (默认 1)
  maxWaitMs: number;      // 最大等待时间 (默认 60秒)
}

/**
 * 店铺令牌桶
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly config: TokenBucketConfig;

  constructor(config: Partial<TokenBucketConfig> = {}) {
    this.config = {
      maxTokens: config.maxTokens ?? 3600,
      refillRate: config.refillRate ?? 1,
      maxWaitMs: config.maxWaitMs ?? 60000,
    };
    this.tokens = this.config.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * 补充令牌
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // 秒
    const tokensToAdd = elapsed * this.config.refillRate;
    
    this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * 检查是否有可用令牌
   */
  checkRateLimit(priority: Priority): RateLimitStatus {
    this.refill();

    // P0 优先级请求可以直接使用，不受限流影响
    if (priority === Priority.P0) {
      return {
        allowed: true,
        waitMs: 0,
        remaining: Math.floor(this.tokens),
        resetAt: new Date(this.lastRefill + (this.config.maxTokens - this.tokens) / this.config.refillRate * 1000),
      };
    }

    if (this.tokens >= 1) {
      return {
        allowed: true,
        waitMs: 0,
        remaining: Math.floor(this.tokens),
        resetAt: new Date(this.lastRefill + (this.config.maxTokens - this.tokens) / this.config.refillRate * 1000),
      };
    }

    // 计算需要等待的时间
    const waitMs = Math.ceil((1 - this.tokens) / this.config.refillRate * 1000);
    
    return {
      allowed: false,
      waitMs: Math.min(waitMs, this.config.maxWaitMs),
      remaining: 0,
      resetAt: new Date(this.lastRefill + waitMs),
    };
  }

  /**
   * 消费一个令牌
   */
  consume(): boolean {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    
    return false;
  }

  /**
   * 获取当前令牌数
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * 强制设置令牌数（用于从数据库恢复）
   */
  setTokens(tokens: number): void {
    this.tokens = Math.min(this.config.maxTokens, Math.max(0, tokens));
    this.lastRefill = Date.now();
  }
}

/**
 * 店铺级限流管理器
 */
class ShopRateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private queues: Map<string, QueuedRequest[]> = new Map();
  private readonly config: TokenBucketConfig;
  
  // 用于生成唯一请求ID
  private requestCounter = 0;

  constructor(config: Partial<TokenBucketConfig> = {}) {
    this.config = {
      maxTokens: config.maxTokens ?? 3600,
      refillRate: config.refillRate ?? 1,
      maxWaitMs: config.maxWaitMs ?? 60000,
    };
  }

  /**
   * 获取或创建店铺的令牌桶
   */
  private getBucket(shopId: string): TokenBucket {
    if (!this.buckets.has(shopId)) {
      this.buckets.set(shopId, new TokenBucket(this.config));
    }
    return this.buckets.get(shopId)!;
  }

  /**
   * 获取店铺的请求队列
   */
  private getQueue(shopId: string): QueuedRequest[] {
    if (!this.queues.has(shopId)) {
      this.queues.set(shopId, []);
    }
    return this.queues.get(shopId)!;
  }

  /**
   * 检查速率限制
   * @param shopId 店铺ID
   * @param priority 优先级
   * @returns 速率限制状态
   */
  checkRateLimit(shopId: string, priority: Priority): RateLimitStatus {
    const bucket = this.getBucket(shopId);
    return bucket.checkRateLimit(priority);
  }

  /**
   * 获取令牌（异步）
   * @param shopId 店铺ID
   * @param priority 优先级
   * @returns Promise，resolve时表示可以发请求
   */
  async acquireToken(shopId: string, priority: Priority): Promise<void> {
    const status = this.checkRateLimit(shopId, priority);

    // 如果立即允许，直接返回
    if (status.allowed) {
      const bucket = this.getBucket(shopId);
      bucket.consume();
      return;
    }

    // 如果等待时间超过最大等待时间，拒绝请求
    if (status.waitMs >= this.config.maxWaitMs) {
      throw new Error(`Rate limit exceeded for shop ${shopId}. Max wait time (${this.config.maxWaitMs}ms) exceeded.`);
    }

    // 进入等待队列
    return new Promise<void>((resolve, reject) => {
      const request: QueuedRequest = {
        id: `${shopId}-${++this.requestCounter}-${Date.now()}`,
        shopId,
        priority,
        endpoint: '',
        body: null,
        resolve: resolve as (value: unknown) => void,
        reject,
        queuedAt: Date.now(),
      };

      const queue = this.getQueue(shopId);
      this.insertByPriority(queue, request);

      // 设置超时
      const timeout = setTimeout(() => {
        const index = queue.findIndex(r => r.id === request.id);
        if (index !== -1) {
          queue.splice(index, 1);
          reject(new Error(`Request timeout after waiting ${this.config.maxWaitMs}ms in queue`));
        }
      }, this.config.maxWaitMs);

      // 清理超时定时器
      request.resolve = ((originalResolve: (value: unknown) => void) => 
        (value: unknown) => {
          clearTimeout(timeout);
          originalResolve(value);
        }
      )(request.resolve);

      request.reject = ((originalReject: (reason: unknown) => void) =>
        (reason: unknown) => {
          clearTimeout(timeout);
          originalReject(reason);
        }
      )(request.reject);
    });
  }

  /**
   * 按优先级插入队列（P0最高，排在前面）
   */
  private insertByPriority(queue: QueuedRequest[], request: QueuedRequest): void {
    let insertIndex = queue.length;
    
    // 找到第一个优先级比当前请求低的元素
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].priority > request.priority) {
        insertIndex = i;
        break;
      }
    }
    
    queue.splice(insertIndex, 0, request);
  }

  /**
   * 处理等待队列
   * 当令牌补充后调用，按优先级顺序发出等待的请求
   */
  processQueue(shopId: string): void {
    const queue = this.getQueue(shopId);
    const bucket = this.getBucket(shopId);

    while (queue.length > 0) {
      const status = bucket.checkRateLimit(queue[0].priority);
      
      if (!status.allowed) {
        // 没有令牌了，等待下次处理
        break;
      }

      const request = queue.shift()!;
      bucket.consume();
      request.resolve(undefined);
    }
  }

  /**
   * 更新店铺的剩余配额（从API响应Header读取）
   */
  updateRemaining(shopId: string, remaining: number, resetAt: Date): void {
    const bucket = this.getBucket(shopId);
    bucket.setTokens(remaining);
    
    // 如果有新配额，处理等待队列
    if (remaining > 0) {
      this.processQueue(shopId);
    }
  }

  /**
   * 获取店铺当前剩余配额
   */
  getRemaining(shopId: string): number {
    const bucket = this.getBucket(shopId);
    return Math.floor(bucket.getTokens());
  }

  /**
   * 获取队列长度
   */
  getQueueLength(shopId: string): number {
    return this.getQueue(shopId).length;
  }
}

// 导出单例
export const rateLimiter = new ShopRateLimiter();

// 导出类型
export type { TokenBucketConfig };
export { TokenBucket, ShopRateLimiter };

// 导出便捷方法
export const checkRateLimit = (shopId: string, priority: Priority) => 
  rateLimiter.checkRateLimit(shopId, priority);

export const acquireToken = (shopId: string, priority: Priority) => 
  rateLimiter.acquireToken(shopId, priority);
