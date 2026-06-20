import { cn, getOrderStatusLabel, getOrderStatusColor } from '@/lib/utils';

interface PurchaseStatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Ozon订单状态Badge组件
 * 显示ERP Tab中文名（不是Ozon原名）
 * 例如: awaiting_deliver → "待采购"
 */
export function PurchaseStatusBadge({ status, className }: PurchaseStatusBadgeProps) {
  const label = getOrderStatusLabel(status);
  const color = getOrderStatusColor(status);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        color.bg,
        color.text,
        color.border,
        className
      )}
    >
      {label}
    </span>
  );
}
