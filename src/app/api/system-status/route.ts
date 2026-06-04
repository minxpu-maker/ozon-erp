import { NextResponse } from 'next/server';
import { getPoolStatus } from '@/storage/database/client';
import { cache } from '@/lib/cache/memory-cache';
import { rateLimiter } from '@/lib/rate-limit/rate-limiter';

// GET /api/system-status - 获取系统状态
export async function GET() {
  try {
    // 获取数据库连接池状态
    const poolStatus = getPoolStatus();
    
    // 获取缓存状态
    const cacheStats = cache.getStats();
    
    // 获取限流状态
    const rateLimitStatus = rateLimiter.getStatus();
    
    // 内存使用情况
    const memoryUsage = process.memoryUsage();
    
    return NextResponse.json({
      success: true,
      data: {
        // 数据库连接池
        database: {
          totalConnections: poolStatus.totalCount,
          idleConnections: poolStatus.idleCount,
          waitingConnections: poolStatus.waitingCount,
        },
        // 缓存
        cache: {
          size: cacheStats.size,
          keys: cacheStats.keys,
        },
        // 限流
        rateLimit: rateLimitStatus,
        // 内存
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        },
        // 运行时间
        uptime: Math.round(process.uptime()),
        // 环境
        env: process.env.COZE_PROJECT_ENV || 'DEV',
      },
    });
  } catch (error) {
    console.error('获取系统状态失败:', error);
    return NextResponse.json(
      { success: false, error: '获取系统状态失败' },
      { status: 500 }
    );
  }
}
