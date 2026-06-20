import { cn } from '@/lib/utils';
import { getOrderStatusLabel, getOrderStatusColor } from '@/lib/utils';

interface OzonStatusTagProps {
  /** Ozon 订单状态 order_status */
  status: string;
  className?: string;
}

/**
 * Ozon订单状态标签（小圆角，轻量级）
 * 显示在订单号/店铺名那一行
 */
export function OzonStatusTag({ status, className }: OzonStatusTagProps) {
  const label = getOrderStatusLabel(status);
  const colors = getOrderStatusColor(status);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border',
        colors.bg,
        colors.text,
        colors.border,
        className
      )}
    >
      {label}
    </span>
  );
}
