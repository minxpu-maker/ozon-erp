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

// 获取入库验货任务列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trackingNumber = searchParams.get('trackingNumber');

    // 如果提供了快递单号，查找对应的采购任务
    if (trackingNumber) {
      const [task] = await db.select().from(schema.purchaseTasks)
        .where(eq(schema.purchaseTasks.domestic_tracking_number, trackingNumber));

      if (!task) {
        return NextResponse.json({ success: false, error: '未找到对应采购任务' }, { status: 404 });
      }

      // 获取关联订单
      const [order] = await db.select().from(schema.orders)
        .where(eq(schema.orders.id, task.order_id));

      // 从ozon_products表获取图片
      let imageUrl: string | null = null;
      if (task.sku_code) {
        const [product] = await db.select({
          main_image: schema.ozonProducts.main_image,
        }).from(schema.ozonProducts)
          .where(eq(schema.ozonProducts.offer_id, task.sku_code));
        imageUrl = product?.main_image || null;
      }

      // 提取商品信息
      const product = order?.ozonRawData 
        ? extractProductInfo(order.ozonRawData, task.sku_code)
        : null;

      return NextResponse.json({ 
        success: true, 
        data: { 
          task, 
          order, 
          product: product ? {
            ...product,
            image: imageUrl || product.image_url,
            image_url: imageUrl || product.image_url,
          } : (imageUrl ? {
            sku: 0,
            name: '',
            offer_id: task.sku_code || '',
            quantity: task.quantity || 1,
            price: '',
            image: imageUrl,
            image_url: imageUrl,
          } : null),
        },
      });
    }

    // 获取待验货的采购任务（已采购但订单未验货）
    const tasks = await db.select({
      task: schema.purchaseTasks,
      order: schema.orders,
    }).from(schema.purchaseTasks)
      .leftJoin(schema.orders, eq(schema.purchaseTasks.order_id, schema.orders.id))
      .where(eq(schema.purchaseTasks.status, 'purchased'))
      .orderBy(desc(schema.purchaseTasks.purchased_at));

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
    console.error('获取验货任务失败:', error);
    return NextResponse.json({ success: false, error: '获取验货任务失败' }, { status: 500 });
  }
}

// 完成验货
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, result, remark } = body;

    // 获取采购任务
    const [task] = await db.select().from(schema.purchaseTasks)
      .where(eq(schema.purchaseTasks.id, taskId));

    if (!task) {
      return NextResponse.json({ success: false, error: '采购任务不存在' }, { status: 404 });
    }

    // 更新订单验货状态
    await db.update(schema.orders)
      .set({ isInspected: true })
      .where(eq(schema.orders.id, task.order_id));

    // 更新采购任务状态
    await db.update(schema.purchaseTasks)
      .set({ status: result === 'pass' ? 'inspected' : 'failed' })
      .where(eq(schema.purchaseTasks.id, taskId));

    // 如果验货不合格，创建售后工单
    if (result === 'fail') {
      // TODO: 创建售后工单
    }

    return NextResponse.json({ 
      success: true, 
      message: result === 'pass' ? '验货通过' : '验货不合格，已创建售后工单',
    });
  } catch (error) {
    console.error('验货失败:', error);
    return NextResponse.json({ success: false, error: '验货失败' }, { status: 500 });
  }
}
