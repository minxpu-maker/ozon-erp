import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseDemands } from '@/storage/database/shared/fulfillment';
import { orders, shops } from '@/storage/database/shared/schema';
import { eq, sql, inArray, desc } from 'drizzle-orm';

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
 * 格式化截止时间显示
 */
function formatDeadline(deadline: Date | null, urgencyLevel: string): string {
  if (!deadline) return '-';
  
  if (urgencyLevel === 'overdue') {
    const now = new Date();
    const diffMs = now.getTime() - deadline.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    return `已超时${diffHours}h`;
  }
  
  const month = deadline.getMonth() + 1;
  const day = deadline.getDate();
  const hour = deadline.getHours().toString().padStart(2, '0');
  const minute = deadline.getMinutes().toString().padStart(2, '0');
  
  if (urgencyLevel === 'today') {
    return `今天 ${hour}:${minute}`;
  }
  
  return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')} ${hour}:${minute}`;
}

/**
 * 格式化人民币金额（导出用）
 */
function formatCNYForExport(amount: number | string | null): string {
  if (!amount) return '¥0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '¥0.00';
  return `¥${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * 格式化卢布金额（导出用）
 */
function formatRUBForExport(amount: number | string | null): string {
  if (!amount) return '₽0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₽0.00';
  return `₽${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * POST /api/purchase-demands/batch-export
 * 批量导出采购需求为CSV
 * 
 * Body:
 * - ids: demandId数组（空数组时导出所有pending数据）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ids: number[] = body.ids || [];
    
    // 查询采购需求
    let demands;
    if (ids.length > 0) {
      demands = await db
        .select()
        .from(purchaseDemands)
        .where(inArray(purchaseDemands.id, ids));
    } else {
      // ids为空时导出所有pending数据
      demands = await db
        .select()
        .from(purchaseDemands)
        .where(eq(purchaseDemands.status, 'pending'))
        .orderBy(desc(purchaseDemands.createdAt));
    }
    
    // 如果没有需求，返回空CSV
    if (demands.length === 0) {
      const emptyCsv = '订单号,商品名,SKU,数量,Ozon售价,采购价,毛利,供应商,店铺,截止时间,状态\n';
      return NextResponse.json({
        success: true,
        data: {
          csv: emptyCsv,
          filename: `采购需求导出_${new Date().toISOString().slice(0, 10)}.csv`,
        },
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
    
    // 生成CSV内容
    const headers = ['订单号', '商品名', 'SKU', '数量', 'Ozon售价', '采购价', '毛利', '供应商', '店铺', '截止时间', '状态'];
    const rows: string[] = [headers.join(',')];
    
    for (const d of demands) {
      const order = orderData.find(o => o.id === d.orderId);
      const shop = shopData.find(s => s.id === order?.shopId);
      
      const deadline = calculateDeadline(order?.createdAt || null);
      const urgencyLevel = calculateUrgencyLevel(deadline);
      const deadlineStr = formatDeadline(deadline, urgencyLevel);
      
      // 计算毛利（Ozon售价 - 采购价）
      const ozonPrice = order?.totalPrice ? parseFloat(order.totalPrice) : 0;
      const purchasePrice = 0; // 待采购状态采购价为0
      const profit = ozonPrice * 0.07 - purchasePrice; // 简化计算：售价*汇率估算
      
      // 格式化数据
      const row = [
        order?.ozonPostingNumber || '-',
        d.productName || '-',
        d.sku || '-',
        (d.quantity ?? 0).toString(),
        formatRUBForExport(order?.totalPrice ?? null),
        '-', // 待采购状态无采购价
        '-', // 待采购状态无毛利
        '-', // 待采购状态无供应商
        shop?.name || '-',
        deadlineStr,
        d.status || 'pending',
      ].map(cell => {
        // CSV转义：包含逗号或引号的需要用引号包裹
        if (cell.includes(',') || cell.includes('"')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      });
      
      rows.push(row.join(','));
    }
    
    // 添加UTF-8 BOM确保Excel正确识别中文
    const csvContent = '\ufeff' + rows.join('\n');
    
    // 生成文件名
    const today = new Date().toISOString().slice(0, 10);
    const filename = `采购需求导出_${today}.csv`;
    
    return NextResponse.json({
      success: true,
      data: {
        csv: csvContent,
        filename,
      },
    });
  } catch (error) {
    console.error('批量导出采购需求失败:', error);
    return NextResponse.json(
      { success: false, error: '批量导出失败' },
      { status: 500 }
    );
  }
}