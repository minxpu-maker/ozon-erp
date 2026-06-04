/**
 * 限流保护中间件
 * 防止API过载
 */

interface RateLimitConfig {
  // 时间窗口（毫秒）
  windowMs: number;
  // 窗口内最大请求数
  maxRequests: number;
  // 限流后的冷却时间（毫秒）
  cooldownMs?: number;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
  blocked: boolean;
}

// 默认限流配置
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  // 订单同步：每分钟最多5次
  'orders:sync': { windowMs: 60000, maxRequests: 5 },
  // API通用：每分钟最多100次
  'api:general': { windowMs: 60000, maxRequests: 100 },
  // 数据库查询：每秒最多50次
  'db:query': { windowMs: 1000, maxRequests: 50 },
  // 导出操作：每分钟最多3次
  'export': { windowMs: 60000, maxRequests: 3 },
};

class RateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 每分钟清理过期记录
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * 检查是否允许请求
   * @param key 限流键（如 'orders:sync'）
   * @param config 自定义配置（可选）
   * @returns 是否允许请求
   */
  check(key: string, config?: Partial<RateLimitConfig>): { allowed: boolean; remaining: number; resetAt: number } {
    const finalConfig = { ...DEFAULT_CONFIGS[key] || DEFAULT_CONFIGS['api:general'], ...config };
    const now = Date.now();
    
    let record = this.records.get(key);
    
    // 初始化或重置窗口
    if (!record || now > record.resetAt) {
      record = {
        count: 0,
        resetAt: now + finalConfig.windowMs,
        blocked: false,
      };
      this.records.set(key, record);
    }
    
    // 检查是否超过限制
    if (record.count >= finalConfig.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.resetAt,
      };
    }
    
    // 增加计数
    record.count++;
    
    return {
      allowed: true,
      remaining: finalConfig.maxRequests - record.count,
      resetAt: record.resetAt,
    };
  }

  /**
   * 重置某个键的限流
   */
  reset(key: string): void {
    this.records.delete(key);
  }

  /**
   * 清理过期记录
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now > record.resetAt) {
        this.records.delete(key);
      }
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): Record<string, { count: number; resetAt: number }> {
    const result: Record<string, { count: number; resetAt: number }> = {};
    for (const [key, record] of this.records.entries()) {
      result[key] = {
        count: record.count,
        resetAt: record.resetAt,
      };
    }
    return result;
  }

  /**
   * 销毁限流器
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.records.clear();
  }
}

// 导出单例实例
export const rateLimiter = new RateLimiter();

/**
 * 创建限流检查函数（用于API路由）
 */
export function createRateLimit(key: string, config?: Partial<RateLimitConfig>) {
  return () => rateLimiter.check(key, config);
}

/**
 * API限流响应头
 */
export function getRateLimitHeaders(result: { remaining: number; resetAt: number }) {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
  };
}
