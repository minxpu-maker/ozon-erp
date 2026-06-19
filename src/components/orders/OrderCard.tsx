'use client';

import { cn, getCountdown } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

interface OrderProduct {
  name: string;
  sku: string;
  quantity: number;
  price: string;
  image?: string | null;
}

interface OrderRecord {
  id: string | number;
  ozonOrderId: string;
  ozonPostingNumber: string;
  shopId: string;
  shopName?: string | null;
  status: string;
  erpStatus: string;
  buyerName: string | null;
  recipientName: string | null;
  recipientCity: string | null;
  totalPrice: number | string | null;
  orderAmount: number | string | null;
  shipmentDeadline?: string | null;
  products?: OrderProduct[];
}

interface OrderCardProps {
  order: OrderRecord;
  selected?: boolean;
  onSelect?: (id: string | number) => void;
}

// 紧急度色条颜色映射
const levelColors = {
  overdue: {
    bar: 'bg-red-700',
    dot: 'bg-red-700',
    text: 'text-red-700',
  },
  urgent: {
    bar: 'bg-red-500',
    dot: 'bg-red-500',
    text: 'text-red-500',
  },
  warning: {
    bar: 'bg-amber-400',
    dot: 'bg-amber-400',
    text: 'text-amber-500',
  },
  normal: {
    bar: 'bg-green-500',
    dot: 'bg-green-500',
    text: 'text-green-600',
  },
  empty: {
    bar: 'bg-gray-300',
    dot: 'bg-gray-300',
    text: 'text-gray-400',
  },
};

export function OrderCard({ order, selected, onSelect }: OrderCardProps) {
  const countdown = getCountdown(order.shipmentDeadline);
  const isEmpty = !order.shipmentDeadline;
  
  // 根据状态获取颜色配置
  const colors = isEmpty ? levelColors.empty : levelColors[countdown.level];
  const isOverdue = countdown.level === 'overdue';
  const isUrgent = countdown.level === 'urgent';

  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-sm transition-all duration-200 cursor-pointer',
        'hover:shadow-md',
        selected && 'ring-2 ring-blue-500'
      )}
      onClick={() => onSelect?.(order.id)}
    >
      {/* 左侧紧急度色条 */}
      <div
        className={cn(
          'w-1 rounded-l-xl transition-all duration-200',
          selected ? 'w-1.5' : 'w-1',
          isEmpty ? colors.bar : colors.bar,
          isOverdue && !selected && 'bg-red-700',
          isOverdue && selected && 'bg-red-600'
        )}
      />

      <div className="flex flex-col">
        {/* 顶部：复选框 + 倒计时 + 商品信息 + 金额 + 操作 */}
        <div className="flex items-center gap-3 p-4">
          {/* 复选框 */}
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect?.(order.id)}
            onClick={(e) => e.stopPropagation()}
          />

          {/* 倒计时显示 */}
          <div className="flex items-center gap-1.5 min-w-[80px]">
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                colors.dot
              )}
            />
            <span
              className={cn(
                'text-sm font-bold',
                colors.text,
                isOverdue && 'font-bold',
                isEmpty && 'text-gray-400 font-normal'
              )}
            >
              {countdown.text}
            </span>
          </div>

          {/* 左栏 - 商品信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-blue-600 font-medium">
                {order.ozonPostingNumber || order.ozonOrderId || order.id}
              </span>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {order.recipientName || order.buyerName || '—'}
            </p>
          </div>

          {/* 中栏 - 金额 */}
          <div className="w-24 text-right">
            <span className="text-sm font-medium">
              {order.totalPrice ? `¥${Number(order.totalPrice).toFixed(2)}` : '—'}
            </span>
          </div>

          {/* 右栏 - 操作区 */}
          <div className="w-20 text-right">
            {/* 占位：后续指令填充操作按钮 */}
          </div>
        </div>

        {/* 底部：订单号 + 店铺名 */}
        <div className="px-4 pb-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-mono">{order.ozonPostingNumber || order.ozonOrderId}</span>
          <span>•</span>
          <span>{order.shopName || order.shopId || '未知店铺'}</span>
        </div>
      </div>
    </div>
  );
}
