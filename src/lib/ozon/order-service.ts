/**
 * 订单服务
 * 处理订单同步、查询、更新等业务逻辑
 */

import { OzonApiClient, createOzonClient } from './client';
import type {
  OzonPostingStatus,
  Order,
  OrderProduct,
  OrderSyncResult,
  OrderQueryParams,
  OzonPosting,
} from '@/types/ozon';

// 店铺配置类型
interface ShopConfig {
  id: string;
  name: string;
  clientId: string;
  apiKey: string;
  isActive: boolean;
  isDefault?: boolean;
}

// 订单服务配置
interface OrderServiceConfig {
  shops: ShopConfig[];
  defaultShopId?: string;
}

export class OrderService {
  private clients: Map<string, OzonApiClient> = new Map();
  private shops: Map<string, ShopConfig> = new Map();
  private defaultShopId?: string;

  constructor(config: OrderServiceConfig) {
    for (const shop of config.shops) {
      this.shops.set(shop.id, shop);
      if (shop.isActive) {
        this.clients.set(
          shop.id,
          createOzonClient({
            clientId: shop.clientId,
            apiKey: shop.apiKey,
          })
        );
      }
      if (shop.isDefault) {
        this.defaultShopId = shop.id;
      }
    }
    if (!this.defaultShopId && config.shops.length > 0) {
      this.defaultShopId = config.shops[0].id;
    }
  }

  /**
   * 获取店铺客户端
   */
  private getClient(shopId?: string): OzonApiClient {
    const id = shopId || this.defaultShopId;
    if (!id) {
      throw new Error('No shop configured');
    }
    const client = this.clients.get(id);
    if (!client) {
      throw new Error(`Shop ${id} is not active or not found`);
    }
    return client;
  }

  /**
   * 同步订单
   * 从Ozon拉取已付款订单，保存到本地数据库
   */
  async syncOrders(params: {
    shopId?: string;
    since?: string;
    to?: string;
    status?: OzonPostingStatus;
  }): Promise<OrderSyncResult> {
    const client = this.getClient(params.shopId);
    const shopId = params.shopId || this.defaultShopId || '';

    const result: OrderSyncResult = {
      total: 0,
      new: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    try {
      // 分页获取订单列表
      let hasMore = true;
      let offset = 0;
      const limit = 100;
      const allPostings: OzonPosting[] = [];

      while (hasMore) {
        const response = await client.getPostingList({
          filter: {
            since: params.since,
            to: params.to,
            status: params.status,
          },
          limit,
          offset,
          with: {
            analytics_data: true,
            financial_data: true,
          },
        });

        // 批量获取订单详情
        const postingNumbers = response.result.postings.map((p) => p.posting_number);
        if (postingNumbers.length > 0) {
          const details = await client.getPostingsBatch(postingNumbers);
          for (const [, detail] of details) {
            allPostings.push(detail);
          }
        }

        hasMore = response.result.has_next;
        offset += limit;
      }

      result.total = allPostings.length;

      // 转换并保存订单
      for (const posting of allPostings) {
        try {
          const order = this.convertToOrder(posting, shopId);
          // TODO: 保存到数据库
          // const existing = await db.order.findUnique({ where: { postingNumber: posting.posting_number } });
          // if (existing) {
          //   await db.order.update({ where: { postingNumber: posting.posting_number }, data: order });
          //   result.updated++;
          // } else {
          //   await db.order.create({ data: order });
          //   result.new++;
          // }
          
          // 暂时模拟保存逻辑
          result.new++;
        } catch (error) {
          result.failed++;
          result.errors?.push({
            postingNumber: posting.posting_number,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to sync orders: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * 转换Ozon订单为ERP订单格式
   */
  private convertToOrder(posting: OzonPosting, shopId: string): Order {
    const products: OrderProduct[] = posting.products.map((p) => ({
      offerId: p.offer_id,
      name: p.name,
      quantity: p.quantity,
      price: parseFloat(p.price),
    }));

    // 计算总金额
    const totalAmount = products.reduce(
      (sum, p) => sum + p.price * p.quantity,
      0
    );

    return {
      id: `${shopId}-${posting.posting_number}`,
      postingNumber: posting.posting_number,
      orderId: posting.order_id,
      orderNumber: posting.order_number,
      status: posting.status,
      customerId: posting.customer?.customer_id,
      customerName: posting.customer?.name,
      customerPhone: posting.customer?.phone,
      customerEmail: posting.customer?.email,
      shippingAddress: posting.customer?.address?.address_line,
      shippingCity: posting.customer?.address?.city,
      shippingCountry: posting.customer?.address?.country,
      products,
      totalAmount,
      currency: 'RUB',
      createdAt: posting.created_at,
      updatedAt: new Date().toISOString(),
      processedAt: posting.in_process_at,
      trackingNumber: posting.tracking_number,
      syncStatus: 'synced',
      lastSyncAt: new Date().toISOString(),
      shopId,
    };
  }

  /**
   * 获取订单列表
   */
  async getOrders(params: OrderQueryParams): Promise<{
    orders: Order[];
    total: number;
    page: number;
    limit: number;
  }> {
    // TODO: 从数据库查询
    // 暂时直接从Ozon API获取
    const client = this.getClient(params.shopId);

    const response = await client.getPostingList({
      filter: {
        status: params.status,
        since: params.startDate,
        to: params.endDate,
      },
      limit: params.limit || 20,
      offset: ((params.page || 1) - 1) * (params.limit || 20),
      with: {
        analytics_data: true,
        financial_data: true,
      },
    });

    // 批量获取详情
    const postingNumbers = response.result.postings.map((p) => p.posting_number);
    const details = await client.getPostingsBatch(postingNumbers);

    const orders = Array.from(details.values()).map((posting) =>
      this.convertToOrder(posting, params.shopId || this.defaultShopId || '')
    );

    return {
      orders,
      total: response.result.postings.length,
      page: params.page || 1,
      limit: params.limit || 20,
    };
  }

  /**
   * 获取订单详情
   */
  async getOrderById(postingNumber: string, shopId?: string): Promise<Order> {
    const client = this.getClient(shopId);

    const response = await client.getPosting({
      posting_number: postingNumber,
      with: {
        analytics_data: true,
        financial_data: true,
        barcodes: true,
      },
    });

    return this.convertToOrder(
      response.result,
      shopId || this.defaultShopId || ''
    );
  }

  /**
   * 订单打包
   */
  async shipOrder(
    postingNumber: string,
    products: Array<{ product_id: number; quantity: number }>,
    shopId?: string
  ): Promise<{
    success: boolean;
    packageNumber?: string;
    error?: string;
  }> {
    const client = this.getClient(shopId);

    try {
      const response = await client.shipPosting({
        posting_number: postingNumber,
        packages: [{ products }],
      });

      const result = response.result[0];
      if (result.error) {
        return {
          success: false,
          error: result.error.message,
        };
      }

      return {
        success: true,
        packageNumber: result.package_number,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 设置物流单号并标记发货
   */
  async deliverOrder(
    postingNumber: string,
    trackingNumber: string,
    shopId?: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const client = this.getClient(shopId);

    try {
      // 设置物流单号
      await client.setTrackingNumber({
        posting_number: postingNumber,
        tracking_number: trackingNumber,
      });

      // 标记发货
      await client.markDelivering({
        posting_number: postingNumber,
      });

      // TODO: 更新本地数据库订单状态

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 获取面单
   */
  async getLabel(
    postingNumbers: string[],
    shopId?: string
  ): Promise<{
    success: boolean;
    file?: string; // Base64
    error?: string;
  }> {
    const client = this.getClient(shopId);

    try {
      const response = await client.getLabel({
        posting_numbers: postingNumbers,
        file_type: 'pdf',
      });

      return {
        success: true,
        file: response.result.file,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 测试店铺连接
   */
  async testConnection(shopId?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const client = this.getClient(shopId);
    return client.testConnection();
  }
}

// 单例实例
let orderServiceInstance: OrderService | null = null;

/**
 * 获取订单服务实例
 */
export function getOrderService(): OrderService {
  if (!orderServiceInstance) {
    // 从环境变量读取配置
    const shops: ShopConfig[] = [];
    
    // 支持多店铺配置
    // SHOP_1_ID, SHOP_1_NAME, SHOP_1_CLIENT_ID, SHOP_1_API_KEY
    let shopIndex = 1;
    while (
      process.env[`SHOP_${shopIndex}_CLIENT_ID`] &&
      process.env[`SHOP_${shopIndex}_API_KEY`]
    ) {
      shops.push({
        id: process.env[`SHOP_${shopIndex}_ID`] || `shop-${shopIndex}`,
        name: process.env[`SHOP_${shopIndex}_NAME`] || `Shop ${shopIndex}`,
        clientId: process.env[`SHOP_${shopIndex}_CLIENT_ID`]!,
        apiKey: process.env[`SHOP_${shopIndex}_API_KEY`]!,
        isActive: process.env[`SHOP_${shopIndex}_ACTIVE`] !== 'false',
        isDefault: process.env[`SHOP_${shopIndex}_DEFAULT`] === 'true' || shopIndex === 1,
      });
      shopIndex++;
    }

    // 单店铺配置（向后兼容）
    if (shops.length === 0 && process.env.OZON_CLIENT_ID && process.env.OZON_API_KEY) {
      shops.push({
        id: 'default',
        name: 'Default Shop',
        clientId: process.env.OZON_CLIENT_ID,
        apiKey: process.env.OZON_API_KEY,
        isActive: true,
        isDefault: true,
      });
    }

    if (shops.length === 0) {
      throw new Error('No Ozon shop configured. Please set OZON_CLIENT_ID and OZON_API_KEY environment variables.');
    }

    orderServiceInstance = new OrderService({ shops });
  }

  return orderServiceInstance;
}
