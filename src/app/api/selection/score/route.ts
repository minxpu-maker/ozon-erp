/**
 * AI选品评分API
 * 批量评分主入口
 */

import { NextRequest, NextResponse } from 'next/server';
import { batchScore, getScoringConfig, deepMine, systemRecommend, BatchScoringRequest } from '@/lib/selection-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;
    
    // 根据action执行不同操作
    switch (action) {
      case 'batch': {
        // 批量评分
        const result = await batchScore(params as BatchScoringRequest);
        return NextResponse.json({ success: true, data: result });
      }
      
      case 'config': {
        // 获取评分配置
        const { shopId } = params;
        if (!shopId) {
          return NextResponse.json({ success: false, error: '缺少shopId' }, { status: 400 });
        }
        const config = await getScoringConfig(shopId);
        return NextResponse.json({ success: true, data: config });
      }
      
      case 'deepMine': {
        // AI深挖
        const { shopId, keywords, categoryId, mode } = params;
        if (!shopId) {
          return NextResponse.json({ success: false, error: '缺少shopId' }, { status: 400 });
        }
        const result = await deepMine({ shopId, keywords, categoryId, mode: mode || 'copy' });
        return NextResponse.json(result);
      }
      
      case 'systemRecommend': {
        // 系统推荐
        const { shopId } = params;
        if (!shopId) {
          return NextResponse.json({ success: false, error: '缺少shopId' }, { status: 400 });
        }
        const result = await systemRecommend(shopId);
        return NextResponse.json(result);
      }
      
      default:
        return NextResponse.json({ success: false, error: '未知操作类型' }, { status: 400 });
    }
  } catch (error) {
    console.error('评分API错误:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '评分失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get('shopId');
  
  if (!shopId) {
    return NextResponse.json({ success: false, error: '缺少shopId' }, { status: 400 });
  }
  
  try {
    // 获取评分配置
    const config = await getScoringConfig(shopId);
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取配置失败' },
      { status: 500 }
    );
  }
}
