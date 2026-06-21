import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, desc, inArray } from 'drizzle-orm';

interface ProductInfo {
  sku: number;
  name: string;
  offer_id: string;
  quantity: number;
  price: string;
  image_url?: string;
  image?: string;
}

// 从订单原始数据中提取商品信息
function extractProductInfo(ozonRawData: unknown, skuCode?: string | null): ProductInfo | null {
  if (!ozonRawData || typeof ozonRawData !== 'object') return null;
  const data = ozonRawData as { products?: ProductInfo[] };
  if (!data.products || !Array.isArray(data.products)) return null;
  
  // 如果有skuCode，尝试精确匹配
  if (skuCode) {
    const product = data.products.find(p => p.offer_id === skuCode);
    if (product) return product;
  }
  
  // 否则返回第一个商品
  return data.products[0] || null;
}

// 获取采购任务列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = db.select({
      task: schema.purchaseTasks,
      order: schema.orders,
    }).from(schema.purchaseTasks)
      .leftJoin(schema.orders, eq(schema.purchaseTasks.order_id, schema.orders.id))
      .orderBy(desc(schema.purchaseTasks.created_at));

    let tasks: { task: typeof schema.purchaseTasks.$inferSelect; order: typeof schema.orders.$inferSelect | null }[] = [];
    
    if (status) {
      tasks = await db.select({
        task: schema.purchaseTasks,
        order: schema.orders,
      }).from(schema.purchaseTasks)
        .leftJoin(schema.orders, eq(schema.purchaseTasks.order_id, schema.orders.id))
        .where(eq(schema.purchaseTasks.status, status))
        .orderBy(desc(schema.purchaseTasks.created_at));
    } else {
      tasks = await query;
    }

    // 附加商品信息（直接从订单原始数据获取图片）
    const tasksWithProduct = tasks.map(item => {
      const product = item.order?.ozonRawData 
        ? extractProductInfo(item.order.ozonRawData, item.task.sku_code)
        : null;
      
      // 图片直接从订单原始数据的商品信息中获取
      const imageUrl = product?.image || product?.image_url || null;
      
      return {
        ...item,
        product: product ? {
          ...product,
          image: imageUrl,
          image_url: imageUrl,
        } : null,
      };
    });

    return NextResponse.json({ success: true, data: tasksWithProduct });
  } catch (error) {
    console.error('获取采购任务失败:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: '获取采购任务失败', detail: errorMessage }, { status: 500 });
  }
}

// 创建采购任务或绑定快递单号
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, taskId, trackingNumber, orderId, orderItemId, skuCode, quantity, sourceType, sourceUrl, sourcePrice } = body;

    // 绑定快递单号操作
    if (action === 'bindTracking') {
      if (!taskId || !trackingNumber) {
        return NextResponse.json({ success: false, error: '缺少任务ID或快递单号' }, { status: 400 });
      }

      // 更新采购任务状态
      const [updatedTask] = await db.update(schema.purchaseTasks)
        .set({
          domestic_tracking_number: trackingNumber,
          status: 'purchased',
          is_bound: true,
          purchased_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(schema.purchaseTasks.id, taskId))
        .returning();

      // 更新关联订单的采购绑定状态
      if (updatedTask.order_id) {
        await db.update(schema.orders)
          .set({
            isPurchaseBound: true,
            purchaseBoundAt: new Date(),
          })
          .where(eq(schema.orders.id, updatedTask.order_id));
      }

      return NextResponse.json({ 
        success: true, 
        data: updatedTask, 
        message: '快递单号绑定成功，订单已流转至入库验货模块' 
      });
    }

    // 创建采购任务
    const [task] = await db.insert(schema.purchaseTasks).values({
      order_id: orderId,
      order_item_id: orderItemId || '',
      status: 'pending',
      sku_id: null,
      sku_code: skuCode || '',
      quantity: quantity || 1,
      source_type: sourceType || null,
      source_url: sourceUrl || null,
      source_price: sourcePrice || null,
      purchase_amount: null,
      shipping_fee: null,
      domestic_tracking_number: null,
      purchased_at: null,
    }).returning();

    return NextResponse.json({ success: true, data: task, message: '采购任务创建成功' });
  } catch (error) {
    console.error('操作失败:', error);
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}
