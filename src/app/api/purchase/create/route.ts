import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { ozonOrders } from '@/storage/database/shared/fulfillment';
import { eq, inArray } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      orderIds, 
      platform, 
      productUrl, 
      unitPrice, 
      quantity, 
      supplierNote, 
      trackingNumber,
      isDraft = false 
    } = body;

    // 校验必填字段
    if (!orderIds || orderIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: '请选择要采购的订单',
      }, { status: 400 });
    }

    if (!platform) {
      return NextResponse.json({
        success: false,
        message: '请选择采购平台',
      }, { status: 400 });
    }

    if (!unitPrice || unitPrice <= 0) {
      return NextResponse.json({
        success: false,
        message: '请输入有效的采购单价',
      }, { status: 400 });
    }

    if (!quantity || quantity <= 0) {
      return NextResponse.json({
        success: false,
        message: '请输入有效的采购数量',
      }, { status: 400 });
    }

    // 计算总金额
    const totalAmount = unitPrice * quantity;

    // 更新关联订单状态
    if (!isDraft) {
      await db
        .update(ozonOrders)
        .set({ 
          erpStatus: 'purchasing',
          updatedAt: new Date(),
        })
        .where(inArray(ozonOrders.id, orderIds));
    }

    return NextResponse.json({
      success: true,
      message: isDraft ? '草稿已保存' : '采购信息已提交',
      data: {
        orderIds,
        platform,
        unitPrice,
        quantity,
        totalAmount,
        isDraft,
      },
    });
  } catch (error) {
    console.error('创建采购记录失败:', error);
    return NextResponse.json({
      success: false,
      message: '创建采购记录失败',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
