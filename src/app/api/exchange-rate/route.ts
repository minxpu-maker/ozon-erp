import { NextResponse } from 'next/server';

// 汇率缓存（5分钟）
let cachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

interface ExchangeRateResponse {
  result: string;
  base_code: string;
  rates: Record<string, number>;
  time_last_update_utc: string;
}

/**
 * 获取实时汇率（卢布兑人民币）
 */
async function getExchangeRate(): Promise<number> {
  // 检查缓存
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_TTL) {
    return cachedRate.rate;
  }

  try {
    // 使用免费的汇率API
    const response = await fetch('https://open.er-api.com/v6/latest/RUB', {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`汇率API请求失败: ${response.status}`);
    }

    const data: ExchangeRateResponse = await response.json();

    if (data.result !== 'success' || !data.rates?.CNY) {
      throw new Error('汇率数据格式错误');
    }

    const rate = data.rates.CNY;

    // 更新缓存
    cachedRate = {
      rate,
      timestamp: Date.now(),
    };

    console.log(`[汇率] 获取实时汇率成功: 1 RUB = ${rate} CNY`);
    return rate;
  } catch (error) {
    console.error('[汇率] 获取实时汇率失败:', error);

    // 如果有缓存，使用缓存值
    if (cachedRate) {
      console.log('[汇率] 使用缓存汇率:', cachedRate.rate);
      return cachedRate.rate;
    }

    // 否则返回一个备用值
    console.log('[汇率] 使用备用汇率: 0.09');
    return 0.09;
  }
}

export async function GET() {
  try {
    const rate = await getExchangeRate();

    return NextResponse.json({
      success: true,
      data: {
        from: 'RUB',
        to: 'CNY',
        rate,
        description: '1 卢布 = ' + rate.toFixed(4) + ' 人民币',
        source: 'exchangerate-api.com',
        cached: cachedRate ? Date.now() - cachedRate.timestamp < CACHE_TTL : false,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: '获取汇率失败',
      },
      { status: 500 }
    );
  }
}
