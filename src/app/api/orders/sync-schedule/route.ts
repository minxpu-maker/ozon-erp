/**
 * 定时同步任务配置 API
 */
import { NextResponse } from 'next/server';

// 同步任务配置存储（实际应存入数据库）
let syncConfig = {
  enabled: true,
  interval: 30, // 分钟
  lastSyncAt: null as string | null,
  nextSyncAt: null as string | null,
  status: 'idle' as 'idle' | 'running' | 'error',
  autoCreatePurchase: true, // 自动创建采购任务
  skuAutoMatch: true, // SKU自动匹配
};

// 定时器引用
let syncTimer: NodeJS.Timeout | null = null;

/**
 * 获取同步配置
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: syncConfig,
  });
}

/**
 * 更新同步配置
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { enabled, interval, autoCreatePurchase, skuAutoMatch } = body;

    // 验证间隔时间
    if (interval !== undefined && (interval < 5 || interval > 1440)) {
      return NextResponse.json({
        success: false,
        error: '同步间隔必须在 5-1440 分钟之间',
      });
    }

    // 更新配置
    if (enabled !== undefined) syncConfig.enabled = enabled;
    if (interval !== undefined) syncConfig.interval = interval;
    if (autoCreatePurchase !== undefined) syncConfig.autoCreatePurchase = autoCreatePurchase;
    if (skuAutoMatch !== undefined) syncConfig.skuAutoMatch = skuAutoMatch;

    // 计算下次同步时间
    if (syncConfig.enabled) {
      const now = new Date();
      const nextSync = new Date(now.getTime() + syncConfig.interval * 60 * 1000);
      syncConfig.nextSyncAt = nextSync.toISOString();

      // 重启定时器
      setupSyncTimer();
    } else {
      syncConfig.nextSyncAt = null;
      clearSyncTimer();
    }

    return NextResponse.json({
      success: true,
      message: '同步配置已更新',
      data: syncConfig,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '配置更新失败',
    });
  }
}

/**
 * 设置同步定时器
 */
function setupSyncTimer() {
  clearSyncTimer();

  if (!syncConfig.enabled) return;

  // 创建定时器（毫秒）
  syncTimer = setInterval(async () => {
    try {
      await triggerSync();
    } catch (error) {
      console.error('定时同步失败:', error);
      syncConfig.status = 'error';
    }
  }, syncConfig.interval * 60 * 1000);

  console.log(`同步定时器已设置，间隔 ${syncConfig.interval} 分钟`);
}

/**
 * 清除同步定时器
 */
function clearSyncTimer() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

/**
 * 触发同步任务
 */
async function triggerSync() {
  if (syncConfig.status === 'running') {
    console.log('同步任务正在运行，跳过本次');
    return;
  }

  syncConfig.status = 'running';
  console.log('开始同步任务...');

  try {
    // 调用同步 API
    const response = await fetch('http://localhost:5000/api/orders/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        autoCreatePurchase: syncConfig.autoCreatePurchase,
        skuAutoMatch: syncConfig.skuAutoMatch,
      }),
    });

    if (!response.ok) {
      throw new Error('同步请求失败');
    }

    syncConfig.lastSyncAt = new Date().toISOString();
    syncConfig.status = 'idle';
    console.log('同步任务完成');
  } catch (error) {
    syncConfig.status = 'error';
    console.error('同步任务失败:', error);
    throw error;
  }
}

// 初始化定时器
if (syncConfig.enabled) {
  setupSyncTimer();
}
