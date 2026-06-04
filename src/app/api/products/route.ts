import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops, orderItems, ozonProducts } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

// 获取商品信息
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const offerId = searchParams.get('offerId');
  const orderId = searchParams.get('orderId');
  
  try {
    // 根据offerId查询单个商品
    if (offerId) {
      const product = await db.select()
        .from(ozonProducts)
        .where(eq(ozonProducts.offer_id, offerId))
        .limit(1);
      
      return NextResponse.json({ 
        success: true, 
        data: product[0] || null 
      });
    }
    
    // 根据订单ID获取订单中的商品信息
    if (orderId) {
      const items = await db.select()
        .from(orderItems)
        .where(eq(orderItems.order_id, orderId));
      
      // 获取商品详情
      const productsWithInfo = [];
      for (const item of items) {
        let productInfo = null;
        if (item.ozon_offer_id) {
          const product = await db.select()
            .from(ozonProducts)
            .where(eq(ozonProducts.offer_id, item.ozon_offer_id))
            .limit(1);
          productInfo = product[0] || null;
        }
        productsWithInfo.push({
          ...item,
          productInfo
        });
      }
      
      return NextResponse.json({ 
        success: true, 
        data: productsWithInfo 
      });
    }
    
    // 获取所有商品
    const allProducts = await db.select()
      .from(ozonProducts)
      .limit(100);
    
    return NextResponse.json({ 
      success: true, 
      data: allProducts 
    });
  } catch (error) {
    console.error('获取商品信息失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '获取商品信息失败' 
    }, { status: 500 });
  }
}

// 同步商品信息 - 简化版本，从订单商品中提取基本信息
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, orderId } = body;
    
    if (action === 'syncFromOrder' && orderId) {
      // 从订单同步商品信息
      // 获取订单商品
      const items = await db.select()
        .from(orderItems)
        .where(eq(orderItems.order_id, orderId));
      
      let synced = 0;
      for (const item of items) {
        if (!item.ozon_offer_id) continue;
        
        // 检查是否已存在
        const existing = await db.select()
          .from(ozonProducts)
          .where(eq(ozonProducts.offer_id, item.ozon_offer_id))
          .limit(1);
        
        if (existing.length === 0) {
          // 插入新商品记录
          await db.insert(ozonProducts).values({
            shop_id: item.order_id, // 临时使用order_id，后续需要正确关联
            ozon_product_id: item.ozon_product_id || 0,
            offer_id: item.ozon_offer_id,
            name: item.name || '',
            description: null,
            main_image: null, // 图片需要从Ozon API获取
            images: [],
            attributes: [],
            price: item.price,
            old_price: null,
            marketing_price: null,
            stock: 0,
            reserved: 0,
            status: 'active',
            is_visible: true,
            barcode: null,
            weight: null,
            height: null,
            width: null,
            depth: null,
            raw_data: null,
          });
          synced++;
        }
      }
      
      return NextResponse.json({
        success: true,
        data: { synced },
        message: `同步了 ${synced} 个商品`
      });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: '无效的操作' 
    }, { status: 400 });
  } catch (error) {
    console.error('同步商品失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '同步商品失败' 
    }, { status: 500 });
  }
}
