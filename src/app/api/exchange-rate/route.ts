import { NextRequest, NextResponse } from 'next/server';

/**
 * 获取实时汇率 API
 * 使用免费的汇率API获取卢布兑人民币的实时汇率
 */
export async function GET(request: NextRequest) {
  try {
    // 使用 exchangerate-api 或其他免费汇率API
    // 这里使用一个可靠的汇率数据源
    const response = await fetch(
      'https://api.exchangerate-api.com/v4/latest/RUB',
      { next: { revalidate: 3600 } } // 缓存1小时
    );
    
    if (!response.ok) {
      // 备用方案：使用固定汇率（基于最新市场数据）
      // 2024年6月 卢布兑人民币汇率约 0.092
      return NextResponse.json({
        success: true,
        rate: 0.092,
        source: 'fallback',
        message: '使用备用汇率数据',
      });
    }
    
    const data = await response.json();
    
    // 获取人民币汇率
    const cnyRate = data.rates?.CNY;
    
    if (cnyRate) {
      return NextResponse.json({
        success: true,
        rate: parseFloat(cnyRate.toFixed(6)),
        source: 'exchangerate-api',
        updated_at: data.date,
      });
    }
    
    // 如果API返回的数据不包含CNY，使用备用汇率
    return NextResponse.json({
      success: true,
      rate: 0.092,
      source: 'fallback',
      message: 'API数据不完整，使用备用汇率',
    });
    
  } catch (error) {
    console.error('获取实时汇率失败:', error);
    
    // 发生错误时返回备用汇率
    return NextResponse.json({
      success: true,
      rate: 0.092,
      source: 'fallback',
      message: '获取实时汇率失败，使用备用汇率',
    });
  }
}
