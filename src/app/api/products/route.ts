import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops, orderItems, ozonProducts } from '@/storage/database/shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { createOzonClient } from '@/lib/ozon/client';

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
    
    // 同步商品图片 - 从Ozon API获取
    if (action === 'syncImages') {
      // 获取所有店铺
      const allShops = await db.select().from(shops);
      if (allShops.length === 0) {
        return NextResponse.json({
          success: false,
          error: '没有配置店铺'
        }, { status: 400 });
      }
      
      // 获取所有需要同步的商品offer_id
      const allItems = await db.select()
        .from(orderItems)
        .limit(100);
      
      // 收集所有唯一的offer_id
      const offerIdSet = new Set<string>();
      for (const item of allItems) {
        if (item.ozon_offer_id) {
          offerIdSet.add(item.ozon_offer_id);
        }
      }
      
      if (offerIdSet.size === 0) {
        return NextResponse.json({
          success: true,
          data: { synced: 0 },
          message: '没有需要同步的商品'
        });
      }
      
      const offerIds = Array.from(offerIdSet);
      let synced = 0;
      
      // 对每个店铺尝试获取商品信息
      for (const shop of allShops) {
        try {
          const client = createOzonClient({
            clientId: shop.client_id,
            apiKey: shop.api_key,
          });
          
          // 批量获取商品信息（按offer_id）
          const productInfos = await client.getProductDetail(offerIds);
          
          // 保存商品图片信息
          for (const info of productInfos.result.items) {
            // 提取图片URL - OzonProductDetail.default_image 是 string 类型
            let mainImageUrl: string | null = null;
            if (info.default_image) {
              mainImageUrl = info.default_image;
            } else if (info.images && info.images.length > 0) {
              mainImageUrl = info.images[0].url;
            }
            
            const imageUrls = (info.images || []).map(img => img.url);
            
            // 检查是否已存在
            const existing = await db.select()
              .from(ozonProducts)
              .where(eq(ozonProducts.offer_id, info.offer_id))
              .limit(1);
            
            if (existing.length > 0) {
              // 更新
              await db.update(ozonProducts)
                .set({
                  main_image: mainImageUrl,
                  images: imageUrls as any,
                  name: info.name || existing[0].name,
                  updated_at: new Date(),
                })
                .where(eq(ozonProducts.id, existing[0].id));
            } else {
              // 插入
              await db.insert(ozonProducts).values({
                shop_id: shop.id,
                ozon_product_id: info.id || 0,
                offer_id: info.offer_id,
                name: info.name || '',
                description: null,
                main_image: mainImageUrl,
                images: imageUrls as any,
                attributes: [],
                price: null,
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
                raw_data: info as any,
              });
            }
            synced++;
          }
        } catch (error) {
          console.error(`同步店铺 ${shop.name} 商品图片失败:`, error);
        }
      }
      
      return NextResponse.json({
        success: true,
        data: { synced },
        message: `同步了 ${synced} 个商品图片`
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
