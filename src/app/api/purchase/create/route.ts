import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { ozonOrders } from '@/storage/database/shared/fulfillment';
import { inArray } from 'drizzle-orm';

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

    // 使用事务确保原子性
    await db.transaction(async (tx) => {
      // 1. 如果是确认采购（非草稿），先检查订单状态
      if (!isDraft) {
        // 查询当前订单状态，确保都是待采购状态
        const currentOrders = await tx
          .select({ id: ozonOrders.id, erpStatus: ozonOrders.erpStatus })
          .from(ozonOrders)
          .where(inArray(ozonOrders.id, orderIds));

        // 检查是否有订单不存在
        if (currentOrders.length !== orderIds.length) {
          throw new Error('部分订单不存在，请刷新页面');
        }

        // 检查订单状态是否正确（待采购或待处理）
        const nonPendingOrders = currentOrders.filter(
          o => o.erpStatus !== 'pending_purchase' && o.erpStatus !== 'pending'
        );
        
        if (nonPendingOrders.length > 0) {
          throw new Error(`部分订单已被处理，无法继续采购操作`);
        }

        // 2. 更新订单状态为采购中，同时保存采购信息
        await tx
          .update(ozonOrders)
          .set({ 
            erpStatus: 'purchasing', // 采购中
            purchasePlatform: platform,
            purchaseUrl: productUrl,
            purchasePrice: String(unitPrice),
            purchaseQty: quantity,
            purchaseTotalAmount: String(totalAmount),
            purchaseNote: supplierNote,
            purchaseStatus: 'confirmed',
            updatedAt: new Date(),
          })
          .where(inArray(ozonOrders.id, orderIds));
      } else {
        // 3. 暂存草稿：只保存采购信息，不改变状态
        await tx
          .update(ozonOrders)
          .set({ 
            purchasePlatform: platform,
            purchaseUrl: productUrl,
            purchasePrice: String(unitPrice),
            purchaseQty: quantity,
            purchaseTotalAmount: String(totalAmount),
            purchaseNote: supplierNote,
            purchaseStatus: 'draft',
            updatedAt: new Date(),
          })
          .where(inArray(ozonOrders.id, orderIds));
      }
    });

    return NextResponse.json({
      success: true,
      message: isDraft ? '草稿已保存' : '采购信息已提交，订单状态已更新',
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
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // 根据错误类型返回不同的提示
    if (errorMessage.includes('已被处理')) {
      return NextResponse.json({
        success: false,
        message: '该订单已被处理，请刷新页面',
        error: errorMessage,
      }, { status: 409 });
    }
    
    if (errorMessage.includes('不存在')) {
      return NextResponse.json({
        success: false,
        message: '部分订单不存在，请刷新页面',
        error: errorMessage,
      }, { status: 404 });
    }

    return NextResponse.json({
      success: false,
      message: errorMessage || '采购确认失败，请重试',
      error: errorMessage,
    }, { status: 500 });
  }
}
