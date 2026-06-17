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

    // 收集所有offer_id以批量查询商品图片
    const offerIds = tasks
      .map(t => t.task.sku_code)
      .filter((id): id is string => !!id);
    
    let productImages: Record<string, string> = {};
    if (offerIds.length > 0) {
      const products = await db.select({
        offer_id: schema.ozonProducts.offer_id,
        main_image: schema.ozonProducts.main_image,
      }).from(schema.ozonProducts)
        .where(inArray(schema.ozonProducts.offer_id, offerIds));
      
      productImages = Object.fromEntries(
        products.map(p => [p.offer_id, p.main_image || ''])
      );
    }

    // 附加商品信息
    const tasksWithProduct = tasks.map(item => {
      const product = item.order?.ozonRawData 
        ? extractProductInfo(item.order.ozonRawData, item.task.sku_code)
        : null;
      
      // 从ozon_products表获取图片
      const imageUrl = item.task.sku_code ? productImages[item.task.sku_code] : null;
      
      return {
        ...item,
        product: product ? {
          ...product,
          image: imageUrl || product.image_url,
          image_url: imageUrl || product.image_url,
        } : (imageUrl ? {
          sku: 0,
          name: '',
          offer_id: item.task.sku_code || '',
          quantity: item.task.quantity || 1,
          price: '',
          image: imageUrl,
          image_url: imageUrl,
        } : null),
      };
    });

    return NextResponse.json({ success: true, data: tasksWithProduct });
  } catch (error) {
    console.error('获取采购任务失败:', error);
    return NextResponse.json({ success: false, error: '获取采购任务失败' }, { status: 500 });
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
