import { NextRequest, NextResponse } from "next/server";
import { pool } from '@/storage/database/client';
import { OzonClient } from '@/lib/ozon-client';
import { decrypt } from '@/lib/crypto';

/**
 * POST /api/orders/update-images
 * 更新现有订单的商品图片（通过Ozon API获取订单详情）
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const shopId = searchParams.get('shopId');
    
    let orders: { id: string; shop_id: string; ozon_posting_number: string }[] = [];
    
    if (orderId) {
      // 更新指定订单
      const result = await pool.query(
        `SELECT o.id, o.shop_id, o.ozon_posting_number, s.ozon_client_id, s.ozon_api_key
         FROM orders o
         LEFT JOIN shops s ON o.shop_id = s.id
         WHERE o.id = $1`,
        [orderId]
      );
      orders = result.rows;
    } else if (shopId) {
      // 更新指定店铺的所有订单
      const result = await pool.query(
        `SELECT o.id, o.shop_id, o.ozon_posting_number, s.ozon_client_id, s.ozon_api_key
         FROM orders o
         LEFT JOIN shops s ON o.shop_id = s.id
         WHERE o.shop_id = $1`,
        [shopId]
      );
      orders = result.rows;
    } else {
      // 更新所有订单
      const result = await pool.query(
        `SELECT o.id, o.shop_id, o.ozon_posting_number, s.ozon_client_id, s.ozon_api_key
         FROM orders o
         LEFT JOIN shops s ON o.shop_id = s.id`
      );
      orders = result.rows;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    
    // 按shop分组处理
    const ordersByShop = new Map<string, typeof orders>();
    for (const order of orders) {
      if (!ordersByShop.has(order.shop_id)) {
        ordersByShop.set(order.shop_id, []);
      }
      ordersByShop.get(order.shop_id)!.push(order);
    }
    
    for (const [shopIdKey, shopOrders] of ordersByShop) {
      if (shopOrders.length === 0) continue;
      
      const firstOrder = shopOrders[0] as any;
      if (!firstOrder.ozon_client_id || !firstOrder.ozon_api_key) {
        console.log(`[UpdateImages] 店铺 ${shopIdKey} 缺少凭证，跳过 ${shopOrders.length} 个订单`);
        skippedCount += shopOrders.length;
        continue;
      }
      
      try {
        const apiKey = firstOrder.ozon_api_key.includes(':') 
          ? decrypt(firstOrder.ozon_api_key) 
          : firstOrder.ozon_api_key;
        const client = new OzonClient({ clientId: firstOrder.ozon_client_id, apiKey });
        
        for (const order of shopOrders) {
          if (!order.ozon_posting_number) {
            skippedCount++;
            continue;
          }
          
          try {
            // 获取订单详情
            const details = await client.getPostingDetails(order.ozon_posting_number);
            
            if (details?.products) {
              // 获取现有ozon_raw_data
              const rawResult = await pool.query(
                'SELECT ozon_raw_data FROM orders WHERE id = $1',
                [order.id]
              );
              
              if (rawResult.rows.length > 0) {
                const rawData = rawResult.rows[0].ozon_raw_data;
                const rawDataObj = (typeof rawData === 'string') 
                  ? JSON.parse(rawData) 
                  : rawData || {};
                
                // 更新products中的images字段
                const updatedProducts = (rawDataObj.products || []).map((existingP: any) => {
                  const newP = details.products.find((np: any) => 
                    np.offer_id === existingP.offer_id || np.sku === existingP.sku
                  );
                  if (newP && newP.images && Array.isArray(newP.images) && newP.images.length > 0) {
                    return { ...existingP, images: newP.images };
                  }
                  return existingP;
                });
                
                const newRawData = { ...rawDataObj, products: updatedProducts };
                
                // 更新数据库
                await pool.query(
                  'UPDATE orders SET ozon_raw_data = $1, updated_at = NOW() WHERE id = $2',
                  [JSON.stringify(newRawData), order.id]
                );
                updatedCount++;
              }
            }
          } catch (e: any) {
            errors.push(`订单 ${order.id}: ${e.message}`);
          }
        }
      } catch (e: any) {
        errors.push(`店铺 ${shopIdKey}: ${e.message}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: skippedCount > 0 ? `注意：有 ${skippedCount} 个订单因缺少店铺凭证被跳过，请在系统设置中配置店铺的Ozon凭证` : undefined,
    });
  } catch (error: any) {
    console.error('[UpdateImages] 更新失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
