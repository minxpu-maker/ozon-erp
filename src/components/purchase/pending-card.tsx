'use client';

import { Package, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRUB } from '@/lib/utils';

// 计算倒计时和紧急度等级（导出给 drawer 使用）
export function calcDeadline(deadline: string | null | undefined): {
  text: string;
  level: 'expired' | 'urgent' | 'warning' | 'normal';
  hoursLeft: number;
} {
  if (!deadline) {
    return { text: '无截止时间', level: 'normal', hoursLeft: Infinity };
  }

  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const hoursLeft = diffMs / (1000 * 60 * 60);

  if (hoursLeft <= 0) {
    return { text: '已超时', level: 'expired', hoursLeft: 0 };
  }

  if (hoursLeft < 12) {
    const hours = Math.floor(hoursLeft);
    const mins = Math.floor((hoursLeft - hours) * 60);
    return { text: `${hours}时${mins}分`, level: 'urgent', hoursLeft };
  }

  if (hoursLeft < 48) {
    const hours = Math.floor(hoursLeft);
    return { text: `${hours}小时`, level: 'warning', hoursLeft };
  }

  const days = Math.floor(hoursLeft / 24);
  return { text: `${days}天`, level: 'normal', hoursLeft };
}

// 紧急度色条样式（导出给 drawer 使用）
export function getUrgencyBarClass(level: 'expired' | 'urgent' | 'warning' | 'normal'): string {
  switch (level) {
    case 'expired':
      return 'bg-red-700 shadow-[0_0_12px_rgba(185,28,28,0.6)]';
    case 'urgent':
      return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
    case 'warning':
      return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]';
    case 'normal':
      return 'bg-emerald-400';
    default:
      return 'bg-emerald-400';
  }
}

// 倒计时图标和样式（导出给 drawer 使用）
export function getDeadlineDisplay(level: 'expired' | 'urgent' | 'warning' | 'normal'): {
  icon: React.ReactNode;
  textClass: string;
} {
  switch (level) {
    case 'expired':
      return {
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        textClass: 'text-xs font-bold text-red-600 animate-pulse',
      };
    case 'urgent':
      return {
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        textClass: 'text-xs text-red-500',
      };
    case 'warning':
      return {
        icon: <Clock className="w-3.5 h-3.5" />,
        textClass: 'text-xs text-amber-500',
      };
    case 'normal':
      return {
        icon: <Clock className="w-3.5 h-3.5" />,
        textClass: 'text-xs text-gray-400',
      };
    default:
      return {
        icon: <Clock className="w-3.5 h-3.5" />,
        textClass: 'text-xs text-gray-400',
      };
  }
}

export interface PendingOrder {
  demandId: number; // 采购需求ID（用于创建采购记录）
  orderId: string;
  ozonOrderId: string; // postingNumber
  shopName: string;
  quantity: number;
  orderAmount: string; // totalPrice (numeric string)
  shipmentDeadline: string | null;
  erpStatus: string;
}

export interface PendingCardProps {
  sku: string | null;
  productName: string;
  productImage: string | null;
  orders: PendingOrder[];
  isSelected: boolean;
  onClick: () => void;
}

export function PendingCard({
  sku,
  productName,
  productImage,
  orders,
  isSelected,
  onClick,
}: PendingCardProps) {
  // 计算最早截止时间（用于排序和紧急度判断）
  const earliestDeadline = orders.reduce<string | null>((min, o) => {
    if (!o.shipmentDeadline) return min;
    if (!min) return o.shipmentDeadline;
    return new Date(o.shipmentDeadline) < new Date(min) ? o.shipmentDeadline : min;
  }, null);

  const deadlineInfo = calcDeadline(earliestDeadline);
  const urgencyBarClass = getUrgencyBarClass(deadlineInfo.level);
  const deadlineDisplay = getDeadlineDisplay(deadlineInfo.level);

  // 总数量
  const totalQuantity = orders.reduce((sum, o) => sum + o.quantity, 0);

  // 聚合信息（多条订单时显示）
  const isAggregated = orders.length > 1;

  // Ozon售价（聚合显示各订单售价）
  const prices = orders.map(o => parseFloat(o.orderAmount) || 0);
  const uniquePrices = [...new Set(prices)].filter(p => p > 0);
  const priceDisplay = uniquePrices.length > 0
    ? uniquePrices.map(p => formatRUB(p)).join(' / ')
    : '— ₽';

  // 店铺名（多条时显示"多店铺"，单条显示店铺名）
  const shopNames = [...new Set(orders.map(o => o.shopName).filter(Boolean))];
  const shopDisplay = shopNames.length > 1 ? '多店铺' : shopNames[0] || '未知店铺';

  // 是否超时
  const isExpired = deadlineInfo.level === 'expired';

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'relative rounded-xl bg-white border p-4 shadow-sm',
        'hover:shadow-md hover:border-gray-200 hover:-translate-y-0.5',
        'transition-all duration-200 cursor-pointer',
        // 边框颜色
        isExpired ? 'border-red-200' : 'border-gray-100',
        // 选中态
        isSelected && 'ring-2 ring-blue-400 border-blue-200',
      )}
    >
      {/* 左侧紧急度色条 */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-xl', urgencyBarClass)} />

      {/* 聚合角标 */}
      {isAggregated && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
          {orders.length}
        </div>
      )}

      {/* 内容区：左图右信息 */}
      <div className="flex gap-3">
        {/* 缩略图 */}
        <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
          {productImage ? (
            <img
              src={productImage}
              alt={productName}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="w-6 h-6 text-gray-300" />
          )}
        </div>

        {/* 信息区 */}
        <div className="flex-1 min-w-0">
          {/* 商品名 */}
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
            {productName}
          </h3>

          {/* SKU */}
          {sku && (
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              {sku}
            </p>
          )}

          {/* 聚合信息 */}
          {isAggregated && (
            <p className="text-xs text-blue-500 mt-1">
              ⚠️ {orders.length}笔待采购 · 共需采购 {totalQuantity} 件
            </p>
          )}

          {/* Ozon售价 */}
          <p className="text-xs text-gray-500 mt-1">
            Ozon: {priceDisplay}
          </p>

          {/* 底部行：数量 + 倒计时 + 店铺 */}
          <div className="flex items-center justify-between mt-2">
            {/* 左：数量 */}
            <span className="text-sm font-bold text-gray-700">
              ×{totalQuantity}
            </span>

            {/* 中：倒计时 */}
            <span className={cn('flex items-center gap-1', deadlineDisplay.textClass)}>
              {deadlineDisplay.icon}
              {deadlineInfo.text}
            </span>

            {/* 右：店铺 */}
            <span className="text-xs text-gray-400 truncate max-w-[80px]">
              {shopDisplay}
            </span>
          </div>

          {/* 操作引导 */}
          <div className="mt-2 flex justify-end">
            <span className="text-xs text-blue-500 hover:text-blue-600 font-medium">
              录入采购 →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}