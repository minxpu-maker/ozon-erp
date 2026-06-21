/**
 * Ozon 产品同步模块
 * 同步所有店铺的产品信息到本地数据库
 */

import { db, schema } from '@/storage/database/client';
import { eq, sql } from 'drizzle-orm';
import { OzonClient } from './ozon-client';
import { decrypt } from './crypto';

const { shops, ozonProducts } = schema;

export interface ProductSyncResult {
  success: boolean;
  shopId: string;
  shopName: string;
  totalProducts: number;
  newProducts: number;
  updatedProducts: number;
  errors: string[];
}

export interface BatchProductSyncResult {
  success: boolean;
  syncedShops: number;
  failedShops: number;
  totalProducts: number;
  newProducts: number;
  updatedProducts: number;
  shopResults: ProductSyncResult[];
  errors: Array<{ shopId: string; shopName: string; error: string }>;
}

/**
 * 同步单个店铺的产品信息
 * @param maxProducts 最大同步产品数，默认1000，防止超时
 */
export async function syncProductsForShop(
  shopId: string,
  shopName: string,
  clientId: string,
  apiKey: string,
  maxProducts: number = 1000
): Promise<ProductSyncResult> {
  const result: ProductSyncResult = {
    success: false,
    shopId,
    shopName,
    totalProducts: 0,
    newProducts: 0,
    updatedProducts: 0,
    errors: [],
  };

  const client = new OzonClient({ clientId, apiKey });
  const batchSize = 100;
  let offset = 0;
  let hasMore = true;

  console.log(`[ProductSync] 开始同步店铺 ${shopName} 的产品（最多${maxProducts}个）...`);

  try {
    while (hasMore && result.totalProducts < maxProducts) {
      const remaining = maxProducts - result.totalProducts;
      const currentBatch = Math.min(batchSize, remaining);
      
      const response = await client.getProductList(currentBatch, offset);

      if (response.items.length === 0) {
        hasMore = false;
        break;
      }

      result.totalProducts += response.items.length;
      offset += currentBatch;

      // 处理每个产品
      for (const product of response.items) {
        try {
          const existing = await db
            .select({ id: ozonProducts.id })
            .from(ozonProducts)
            .where(eq(ozonProducts.ozon_product_id, product.product_id))
            .limit(1);

          const productData = {
            shop_id: shopId,
            ozon_product_id: product.product_id,
            offer_id: product.offer_id,
            name: product.name,
            sku: product.sku || null,
            barcode: product.barcodes?.[0] || null,
            price: product.price ? String(product.price) : null,
            old_price: null,
            weight: product.weight ? String(product.weight) : null,
            height: product.dimensions?.height ? String(product.dimensions.height) : null,
            width: product.dimensions?.width ? String(product.dimensions.width) : null,
            depth: product.dimensions?.length ? String(product.dimensions.length) : null,
            status: product.status,
            category_id: product.category_id ? String(product.category_id) : null,
            brand: product.brand || null,
            main_image: product.image || null,
            images: product.images || [],
            raw_data: product,
            updated_at: new Date(),
          };

          if (existing.length > 0) {
            // 更新现有产品
            await db
              .update(ozonProducts)
              .set(productData)
              .where(eq(ozonProducts.ozon_product_id, product.product_id));
            result.updatedProducts++;
          } else {
            // 新增产品
            await db.insert(ozonProducts).values(productData);
            result.newProducts++;
          }
        } catch (err) {
          result.errors.push(`产品 ${product.offer_id}: ${err instanceof Error ? err.message : '未知错误'}`);
        }
      }

      offset += batchSize;
      hasMore = response.items.length === batchSize;

      // 避免请求过快
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    result.success = true;
    console.log(`[ProductSync] ${shopName}: 总计${result.totalProducts}, 新增${result.newProducts}, 更新${result.updatedProducts}`);
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : '未知错误');
    console.error(`[ProductSync] ${shopName} 同步失败:`, err);
  }

  return result;
}

/**
 * 同步所有店铺的产品信息
 */
export async function syncAllShopProducts(): Promise<BatchProductSyncResult> {
  const result: BatchProductSyncResult = {
    success: true,
    syncedShops: 0,
    failedShops: 0,
    totalProducts: 0,
    newProducts: 0,
    updatedProducts: 0,
    shopResults: [],
    errors: [],
  };

  // 获取所有活跃店铺
  const activeShops = await db
    .select({
      id: shops.id,
      name: shops.name,
      ozonClientId: shops.ozonClientId,
      ozonApiKey: shops.ozonApiKey,
      clientId: shops.clientId,
      apiKey: shops.apiKey,
    })
    .from(shops)
    .where(eq(shops.isActive, true));

  if (activeShops.length === 0) {
    console.log('[ProductSync] 没有找到活跃店铺');
    return result;
  }

  console.log(`[ProductSync] 找到 ${activeShops.length} 个活跃店铺`);

  for (const shop of activeShops) {
    const encryptedKey = shop.ozonApiKey;
    const plainKey = shop.apiKey;
    const clientId = (shop.ozonClientId || shop.clientId) as string | null;

    if (!clientId || (!encryptedKey && !plainKey)) {
      result.errors.push({
        shopId: shop.id,
        shopName: shop.name || '未知店铺',
        error: '缺少 ClientId 或 API Key',
      });
      result.failedShops++;
      continue;
    }

    // 解密 API Key
    let decryptedApiKey: string;
    try {
      const raw = encryptedKey || plainKey;
      decryptedApiKey = (raw as string).includes(':') ? decrypt(raw as string) : raw as string;
    } catch {
      result.errors.push({
        shopId: shop.id,
        shopName: shop.name || '未知店铺',
        error: 'API密钥解密失败',
      });
      result.failedShops++;
      continue;
    }

    const shopResult = await syncProductsForShop(
      shop.id,
      shop.name || '未知店铺',
      clientId,
      decryptedApiKey
    );

    result.shopResults.push(shopResult);

    if (shopResult.success) {
      result.syncedShops++;
      result.totalProducts += shopResult.totalProducts;
      result.newProducts += shopResult.newProducts;
      result.updatedProducts += shopResult.updatedProducts;
    } else {
      result.failedShops++;
      result.errors.push({
        shopId: shop.id,
        shopName: shop.name || '未知店铺',
        error: shopResult.errors.join('; '),
      });
    }
  }

  result.success = result.failedShops === 0;

  console.log(`[ProductSync] 同步完成: ${result.syncedShops}成功, ${result.failedShops}失败, 总产品${result.totalProducts}`);

  return result;
}
