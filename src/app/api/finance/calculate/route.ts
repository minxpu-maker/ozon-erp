/**
 * 触发财务计算API
 * POST /api/finance/calculate
 * 
 * 触发指定订单的利润计算，支持批量
 */
import { NextRequest, NextResponse } from 'next/server';
import { calculateFinanceBatch } from '@/lib/finance-calculator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderIds } = body;
    
    // 验证参数
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'orderIds参数必填且为非空数组' },
        { status: 400 }
      );
    }
    
    // 限制批量大小
    const maxBatchSize = 100;
    if (orderIds.length > maxBatchSize) {
      return NextResponse.json(
        { success: false, error: `单次批量计算不能超过${maxBatchSize}笔` },
        { status: 400 }
      );
    }
    
    // 校验每个orderId都是有效数字
    const validOrderIds = orderIds.filter(id => typeof id === 'number' && !isNaN(id));
    if (validOrderIds.length !== orderIds.length) {
      return NextResponse.json(
        { success: false, error: 'orderIds数组中包含无效的订单ID' },
        { status: 400 }
      );
    }
    
    console.log(`[Finance/Calculate] 开始计算 ${orderIds.length} 笔订单`);
    
    // 批量计算
    const results = await calculateFinanceBatch(validOrderIds);
    
    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    console.log(`[Finance/Calculate] 计算完成: 成功 ${successCount} 笔, 失败 ${failedCount} 笔`);
    
    return NextResponse.json({
      success: true,
      summary: {
        total: orderIds.length,
        success: successCount,
        failed: failedCount
      },
      results
    });
  } catch (error) {
    console.error('[Finance/Calculate] 计算失败:', error);
    return NextResponse.json(
      { success: false, error: '计算失败' },
      { status: 500 }
    );
  }
}
