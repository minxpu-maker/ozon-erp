import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatRUB, formatCNY } from '@/lib/utils';
import { PurchaseDemand } from '@/lib/api/purchase';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Check,
  AlertCircle,
  X,
  MoreHorizontal,
  ChevronRight,
} from 'lucide-react';

/**
 * 列表行组件 Props
 */
export interface ListRowProps {
  demand: PurchaseDemand;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (id: number) => void;
  onOpenDrawer: (id: number) => void;
  style?: React.CSSProperties;
  measureRef?: (el: HTMLElement | null) => void;
}

/**
 * 获取紧急程度色条样式
 */
function getUrgencyBarStyle(urgencyLevel: string): string {
  switch (urgencyLevel) {
    case 'overdue':
      return 'bg-gradient-to-b from-red-500 to-red-300 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse-glow';
    case 'today':
      return 'bg-gradient-to-b from-orange-500 to-orange-300 shadow-[0_0_8px_rgba(249,115,22,0.6)]';
    case 'tomorrow':
      return 'bg-gradient-to-b from-yellow-500 to-yellow-300 shadow-[0_0_8px_rgba(234,179,8,0.6)]';
    default:
      return 'bg-gradient-to-b from-emerald-500 to-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
  }
}

/**
 * 获取截止时间显示样式和文字
 */
function getDeadlineDisplay(
  deadline: string | null | undefined,
  urgencyLevel: string | undefined
): { text: string; className: string } {
  if (!deadline) {
    return { text: '-', className: 'text-gray-500' };
  }

  const deadlineDate = new Date(deadline);
  const now = new Date();

  if (urgencyLevel === 'overdue') {
    const diffMs = now.getTime() - deadlineDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    return { text: `已超时${diffHours}h`, className: 'text-red-600 font-semibold' };
  }

  const month = deadlineDate.getMonth() + 1;
  const day = deadlineDate.getDate();
  const hour = deadlineDate.getHours().toString().padStart(2, '0');
  const minute = deadlineDate.getMinutes().toString().padStart(2, '0');

  if (urgencyLevel === 'today') {
    return { text: `今天 ${hour}:${minute}`, className: 'text-orange-600' };
  }

  return {
    text: `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')} ${hour}:${minute}`,
    className: 'text-gray-500',
  };
}

/**
 * 获取货源匹配图标
 */
function getSourceMatchIcon(status: string | undefined): React.ReactNode {
  switch (status) {
    case 'matched':
      return <Check className="w-3 h-3 text-emerald-500" />;
    case 'partial':
      return <AlertCircle className="w-3 h-3 text-amber-500" />;
    default:
      return <X className="w-3 h-3 text-gray-400" />;
  }
}

/**
 * 格式化采购价（将CNY替换为¥）
 */
function formatPurchasePrice(price: number | string | null): string {
  if (!price) return '-';
  const formatted = formatCNY(price);
  return formatted.replace('CNY ', '¥');
}

/**
 * 计算毛利（简化计算：售价*汇率 - 采购价）
 */
function calculateProfit(ozonPrice: string | null, purchasePrice: number | string | null): {
  profit: number;
  rate: number;
} | null {
  if (!ozonPrice) return null;
  const ozon = parseFloat(ozonPrice);
  const purchase = purchasePrice ? parseFloat(String(purchasePrice)) : 0;
  if (isNaN(ozon)) return null;

  const RUB_TO_CNY_RATE = 0.07;
  const estimatedCNY = ozon * RUB_TO_CNY_RATE;
  const profit = estimatedCNY - purchase;
  const rate = purchase > 0 ? (profit / purchase) * 100 : 0;

  return { profit, rate };
}

/**
 * 列表行组件
 * 72px高紧凑行，用于列表视角渲染
 */
const ListRow = React.memo(function ListRow({
  demand,
  isSelected,
  isActive,
  onSelect,
  onOpenDrawer,
  style,
  measureRef,
}: ListRowProps) {
  // 截止时间静默刷新（60秒）
  const deadlineRef = useRef<HTMLDivElement>(null);
  const deadlineTextRef = useRef(getDeadlineDisplay(demand.deadline, demand.urgencyLevel));

  // 货源匹配状态徽章（使用sourceMatchStatus，不是erpStatus）
  const sourceMatchBadge = useMemo(() => {
    const status = demand.sourceMatchStatus;
    if (status === 'matched') {
      return { text: '1688', style: 'bg-orange-50 text-orange-700 border-orange-100' };
    }
    if (status === 'partial') {
      return { text: '部分匹配', style: 'bg-amber-50 text-amber-700 border-amber-100' };
    }
    // unmatched or pending
    return { text: '待匹配', style: 'bg-gray-50 text-gray-500 border-gray-100' };
  }, [demand.sourceMatchStatus]);

  useEffect(() => {
    if (!demand.deadline) return;

    const interval = setInterval(() => {
      const newDisplay = getDeadlineDisplay(demand.deadline, demand.urgencyLevel);
      if (deadlineTextRef.current.text !== newDisplay.text && deadlineRef.current) {
        deadlineRef.current.textContent = newDisplay.text;
        deadlineTextRef.current = newDisplay;
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [demand.deadline, demand.urgencyLevel]);

  // 点击行非按钮区域 = 切换选中
  const handleRowClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // 忽略按钮、checkbox、更多操作区域的点击
    if (
      target.closest('button') ||
      target.closest('[data-checkbox]') ||
      target.closest('[data-more]')
    ) {
      return;
    }
    onSelect(demand.id!);
  }, [demand.id, onSelect]);

  // 打开Drawer
  const handleOpenDrawer = useCallback(() => {
    onOpenDrawer(demand.id!);
  }, [demand.id, onOpenDrawer]);

  // 计算利润
  const profitInfo = calculateProfit(demand.order?.totalPrice ?? null, null);

  const urgencyLevel = demand.urgencyLevel || 'later';
  const deadlineDisplay = getDeadlineDisplay(demand.deadline, urgencyLevel);

  return (
    <div
      ref={measureRef}
      style={style}
      onClick={handleRowClick}
      className={cn(
        'relative flex items-center h-[72px] px-3 border-b border-slate-100/80',
        'transition-all duration-200',
        'hover:bg-blue-50/30 hover:-translate-y-px',
        isSelected && 'bg-blue-50/60',
        isActive && 'ring-2 ring-blue-400/50 border-blue-200 bg-blue-50/40',
        urgencyLevel === 'overdue' && 'bg-red-50/20'
      )}
    >
      {/* 左侧色条 */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-[4px] rounded-l-xl',
          getUrgencyBarStyle(urgencyLevel)
        )}
      />

      {/* Checkbox */}
      <div data-checkbox className="flex items-center ml-[18px] mr-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(demand.id!)}
          className={cn(
            'w-[18px] h-[18px] rounded border-slate-300',
            isSelected && 'bg-blue-500 border-blue-500'
          )}
        />
      </div>

      {/* 主体内容区 */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* 第一行 */}
        <div className="flex items-center gap-2 min-w-0">
          {/* 商品名 */}
          <span className="text-sm font-semibold text-gray-900 tracking-tight truncate max-w-[200px]">
            {demand.productName || '-'}
          </span>

          {/* 店铺标签 */}
          {demand.order?.shopName && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-1">
              {demand.order.shopName}
            </span>
          )}

          {/* 货源匹配状态标签 */}
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded ml-1',
              sourceMatchBadge.style
            )}
          >
            {sourceMatchBadge.text}
          </span>

          {/* 截止时间（右对齐） */}
          <div
            ref={deadlineRef}
            className={cn(
              'ml-auto text-xs',
              deadlineDisplay.className
            )}
          >
            {deadlineDisplay.text}
          </div>
        </div>

        {/* 第二行 */}
        <div className="flex items-center gap-2 text-xs text-gray-500 min-w-0">
          {/* 订单号 */}
          <span className="font-mono tracking-wide truncate">
            {demand.order?.postingNumber || '-'}
          </span>

          <span>·</span>

          {/* SKU */}
          <span className="font-mono tracking-wide truncate">
            {demand.sku || '-'}
          </span>

          {/* 货源匹配指示器 */}
          <div className="flex items-center ml-1">
            {getSourceMatchIcon(demand.sourceMatchStatus)}
          </div>

          {/* 数量 */}
          <span className="text-gray-600 ml-2">
            ×{demand.quantity}
          </span>

          {/* 价格链 */}
          <div className="flex items-center gap-1 ml-2 text-gray-700">
            {/* Ozon售价 */}
            <span>{formatRUB(demand.order?.totalPrice || 0)}</span>

            <ChevronRight className="w-3 h-3 text-gray-400" />

            {/* 采购价（待采购状态显示-） */}
            <span>-</span>

            <ChevronRight className="w-3 h-3 text-gray-400" />

            {/* 毛利 */}
            <span className="text-emerald-600 font-medium">
              {profitInfo ? `↗ ¥${profitInfo.profit.toFixed(2)}` : '-'}
            </span>

            {/* 利润率 */}
            {profitInfo && profitInfo.rate > 0 && (
              <span className="text-gray-400">
                ({profitInfo.rate.toFixed(0)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 右侧操作区 */}
      <div className="flex items-center gap-2 ml-4 w-[120px]">
        {/* 去采购按钮 */}
        <Button
          size="sm"
          onClick={handleOpenDrawer}
          className={cn(
            'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
            'px-3 py-1.5 rounded-lg text-sm font-medium',
            'hover:shadow-lg active:scale-[0.97]',
            'transition-all duration-200'
          )}
        >
          去采购
        </Button>

        {/* 更多操作 */}
        <button
          data-more
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-lg',
            'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
            'transition-all duration-200'
          )}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export { ListRow };