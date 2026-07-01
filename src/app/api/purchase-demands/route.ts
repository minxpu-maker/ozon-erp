import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseDemands } from '@/storage/database/shared/fulfillment';
import { orders, shops } from '@/storage/database/shared/schema';
import { eq, and, desc, asc, isNull, sql, or, like, gte, lte } from 'drizzle-orm';

/**
 * 计算deadline（orders.createdAt + 48小时）
 */
function calculateDeadline(orderCreatedAt: Date | null): Date | null {
  if (!orderCreatedAt) return null;
  const deadline = new Date(orderCreatedAt);
  deadline.setHours(deadline.getHours() + 48);
  return deadline;
}

/**
 * 计算urgency_level
 */
function calculateUrgencyLevel(deadline: Date | null): 'overdue' | 'today' | 'tomorrow' | 'later' {
  if (!deadline) return 'later';
  
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000);
  
  if (deadline < todayStart) return 'overdue';
  if (deadline < todayEnd) return 'today';
  if (deadline < tomorrowEnd) return 'tomorrow';
  return 'later';
}

/**
 * GET /api/purchase-demands
 * 获取采购需求列表（待采购订单）
 * 支持分页、排序、筛选
 * 
 * 查询参数：
 * - page: 页码（默认1）
 * - pageSize: 每页数量（默认50）
 * - sortBy: 排序字段 - deadline(默认)/createdAt/totalPrice
 * - sortOrder: 排序方向 - asc(默认)/desc
 * - groupBy: 分组方式 - order(默认)/supplier/store
 * - urgency: 紧急程度 - overdue/today/tomorrow/all(默认)
 * - channel: 采购渠道 - 1688/pdd/manual/all(默认)
 * - keyword: 搜索关键词（匹配订单号/商品名/SKU）
 * - dateFrom/dateTo: 截止日期范围
 * - status: 状态（默认pending）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 基础参数
    const status = searchParams.get('status') || 'pending';
    
    // 分页参数
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    
    // 排序参数
    const sortBy = searchParams.get('sortBy') || 'deadline';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    
    // 筛选参数
    const groupBy = searchParams.get('groupBy') || 'order';
    const urgency = searchParams.get('urgency') || 'all';
    const channel = searchParams.get('channel') || 'all';
    const keyword = searchParams.get('keyword') || '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // 查询采购需求
    const demands = await db
      .select()
      .from(purchaseDemands)
      .where(eq(purchaseDemands.status, status))
      .orderBy(desc(purchaseDemands.createdAt));

    // 如果没有需求，直接返回空结果
    if (demands.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
        stats: { overdue: 0, today: 0, tomorrow: 0, total: 0 },
      });
    }

    // 批量查询关联的订单
    const orderIds = demands.map(d => d.orderId).filter(Boolean);
    const orderData = orderIds.length > 0 ? await db
      .select()
      .from(orders)
      .where(sql`${orders.id} IN ${orderIds}`) : [];

    // 批量查询店铺
    const shopIds = orderData.map(o => o.shopId).filter(Boolean);
    const shopData = shopIds.length > 0 ? await db
      .select()
      .from(shops)
      .where(sql`${shops.id} IN ${shopIds}`) : [];

    // 组装结果并计算字段
    let result = demands.map(d => {
      const order = orderData.find(o => o.id === d.orderId);
      const shop = shopData.find(s => s.id === order?.shopId);
      
      // 计算deadline
      const deadline = calculateDeadline(order?.createdAt || null);
      
      // 计算urgency_level
      const urgencyLevel = calculateUrgencyLevel(deadline);

      return {
        id: d.id,
        orderId: d.orderId,
        sku: d.sku,
        productName: d.productName,
        productImage: d.productImage,
        quantity: d.quantity,
        priority: d.priority,
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        // 计算字段
        deadline: deadline?.toISOString() || null,
        urgencyLevel: urgencyLevel,
        sourceMatchStatus: 'unmatched', // 货源池后续Phase实现
        sourceMatchCount: 0, // 货源池后续Phase实现
        // 关联订单信息
        order: order ? {
          id: order.id,
          postingNumber: order.ozonPostingNumber,
          status: order.status,
          erpStatus: order.erpStatus,
          shipmentDeadline: order.shipmentDeadline,
          shopId: order.shopId,
          totalPrice: order.totalPrice,
          createdAt: order.createdAt,
          shopName: shop?.name || null,
        } : null,
      };
    });

    // 紧急程度筛选
    if (urgency !== 'all') {
      result = result.filter(item => item.urgencyLevel === urgency);
    }

    // 关键词筛选（匹配订单号/商品名/SKU）
    if (keyword) {
      const kw = keyword.toLowerCase();
      result = result.filter(item => 
        (item.order?.postingNumber?.toLowerCase().includes(kw)) ||
        (item.productName?.toLowerCase().includes(kw)) ||
        (item.sku?.toLowerCase().includes(kw))
      );
    }

    // 截止日期范围筛选
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      result = result.filter(item => 
        item.deadline && new Date(item.deadline) >= fromDate
      );
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      result = result.filter(item => 
        item.deadline && new Date(item.deadline) <= toDate
      );
    }

    // 计算统计数据
    const stats = {
      overdue: result.filter(item => item.urgencyLevel === 'overdue').length,
      today: result.filter(item => item.urgencyLevel === 'today').length,
      tomorrow: result.filter(item => item.urgencyLevel === 'tomorrow').length,
      total: result.length,
    };

    // 排序
    if (sortBy === 'deadline') {
      result.sort((a, b) => {
        const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return sortOrder === 'asc' ? aDeadline - bDeadline : bDeadline - aDeadline;
      });
    } else if (sortBy === 'createdAt') {
      result.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
      });
    } else if (sortBy === 'totalPrice') {
      result.sort((a, b) => {
        const aPrice = Number(a.order?.totalPrice) || 0;
        const bPrice = Number(b.order?.totalPrice) || 0;
        return sortOrder === 'asc' ? aPrice - bPrice : bPrice - aPrice;
      });
    }

    // 分页
    const total = result.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedResult = result.slice(startIndex, startIndex + pageSize);

    return NextResponse.json({
      success: true,
      data: paginatedResult,
      pagination: { page, pageSize, total, totalPages },
      stats,
    });
  } catch (error) {
    console.error('获取采购需求失败:', error);
    return NextResponse.json(
      { success: false, error: '获取采购需求失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/purchase-demands
 * 创建采购需求（一般由订单同步自动创建，此接口用于手动补充）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, sku, productName, productImage, quantity, priority } = body;

    if (!orderId || !sku) {
      return NextResponse.json(
        { success: false, error: 'orderId 和 sku 为必填字段' },
        { status: 400 }
      );
    }

    const result = await db
      .insert(purchaseDemands)
      .values({
        orderId,
        sku,
        productName,
        productImage,
        quantity: quantity || 1,
        priority: priority || 'normal',
        status: 'pending',
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error('创建采购需求失败:', error);
    return NextResponse.json(
      { success: false, error: '创建采购需求失败' },
      { status: 500 }
    );
  }
}