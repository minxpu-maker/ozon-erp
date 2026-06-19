'use client';

import { cn } from '@/lib/utils';
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
  products?: OrderProduct[];
}

interface OrderCardProps {
  order: OrderRecord;
  selected?: boolean;
  onSelect?: (id: string | number) => void;
}

export function OrderCard({ order, selected, onSelect }: OrderCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-sm transition-all duration-200 cursor-pointer',
        'hover:shadow-md',
        selected && 'ring-2 ring-blue-500'
      )}
      onClick={() => onSelect?.(order.id)}
    >
      {/* 左侧色条 */}
      <div
        className={cn(
          'w-1 rounded-l-xl transition-all duration-200',
          selected ? 'w-1.5 bg-blue-600' : 'w-1 bg-blue-500'
        )}
      />

      <div className="flex flex-col">
        {/* 顶部：复选框 + 商品信息 + 金额 + 操作 */}
        <div className="flex items-center gap-4 p-4">
          {/* 复选框 */}
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect?.(order.id)}
            onClick={(e) => e.stopPropagation()}
          />

          {/* 左栏60% - 商品信息（订单号占位） */}
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

          {/* 中栏20% - 金额（售价占位） */}
          <div className="w-24 text-right">
            <span className="text-sm font-medium">
              {order.totalPrice ? `¥${Number(order.totalPrice).toFixed(2)}` : '—'}
            </span>
          </div>

          {/* 右栏20% - 操作区 */}
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
