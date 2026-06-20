import { NextResponse } from 'next/server';

// 缓存汇率数据，避免频繁请求
let cachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1小时缓存

/**
 * 获取实时卢布兑人民币汇率
 */
async function getRUBToCNYRate(): Promise<number> {
  // 检查缓存
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
    return cachedRate.rate;
  }

  try {
    // 使用 exchangerate-api.com 的免费 API
    const response = await fetch(
      'https://api.exchangerate-api.com/v4/latest/RUB',
      { next: { revalidate: 3600 } } // Next.js 缓存1小时
    );

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rate');
    }

    const data = await response.json();
    const rate = data.rates?.CNY;

    if (rate && rate > 0) {
      cachedRate = { rate, timestamp: Date.now() };
      return rate;
    }
  } catch (error) {
    console.error('[ExchangeRate] Failed to fetch rate:', error);
  }

  // 降级：返回默认汇率
  return 0.078;
}

export async function GET() {
  try {
    const rate = await getRUBToCNYRate();

    return NextResponse.json({
      success: true,
      rate: rate,
      currency: 'RUB/CNY',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ExchangeRate] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get exchange rate' },
      { status: 500 }
    );
  }
}
