/**
 * 内存缓存模块
 * 用于缓存常用数据，减少数据库查询
 */

interface CacheItem<T> {
  data: T;
  expireAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheItem<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 每5分钟清理过期缓存
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param data 缓存数据
   * @param ttlSeconds 过期时间（秒），默认60秒
   */
  set<T>(key: string, data: T, ttlSeconds = 60): void {
    const expireAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { data, expireAt });
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @returns 缓存数据或null（已过期或不存在）
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key) as CacheItem<T> | undefined;
    if (!item) return null;
    
    if (Date.now() > item.expireAt) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取或设置缓存（自动回源）
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds = 60
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttlSeconds);
    return data;
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expireAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * 销毁缓存（清理定时器）
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// 导出单例实例
export const cache = new MemoryCache();

// 预定义的缓存键和过期时间
export const CacheKeys = {
  // 汇率配置：缓存5分钟
  EXCHANGE_RATE: 'system:exchange_rate',
  EXCHANGE_RATE_TTL: 300,
  
  // 店铺列表：缓存10分钟
  SHOPS: 'shops:list',
  SHOPS_TTL: 600,
  
  // 单个店铺：缓存10分钟
  SHOP: (id: string) => `shop:${id}`,
  SHOP_TTL: 600,
  
  // 订单统计：缓存1分钟
  ORDER_STATS: 'orders:stats',
  ORDER_STATS_TTL: 60,
  
  // 仪表盘数据：缓存30秒
  DASHBOARD: 'dashboard:data',
  DASHBOARD_TTL: 30,
} as const;
