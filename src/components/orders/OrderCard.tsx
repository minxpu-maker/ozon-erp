'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn, getCountdown, formatCNY } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ShoppingCart,
  Edit,
  Truck,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Minus,
} from 'lucide-react';

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

// 采购状态映射
const erpStatusMap: Record<string, { label: string; className: string }> = {
  pending: { label: '待采购', className: 'bg-blue-100 text-blue-700' },
  purchasing: { label: '采购中', className: 'bg-amber-100 text-amber-700' },
  purchased: { label: '已采购', className: 'bg-green-100 text-green-700' },
  shipped_domestic: { label: '运输中', className: 'bg-purple-100 text-purple-700' },
  received: { label: '已到货', className: 'bg-teal-100 text-teal-700' },
  qc_passed: { label: '验货通过', className: 'bg-teal-100 text-teal-700' },
  packing: { label: '打包中', className: 'bg-cyan-100 text-cyan-700' },
  shipped: { label: '已发货', className: 'bg-gray-100 text-gray-600' },
  settled: { label: '已结算', className: 'bg-gray-100 text-gray-500' },
  cancelled: { label: '已取消', className: 'bg-red-100 text-red-700' },
};

// Ozon原始状态映射
const ozonStatusMap: Record<string, { label: string; isAbnormal: boolean }> = {
  'awaiting-collecting': { label: '待揽收', isAbnormal: false },
  'awaiting-packaging': { label: '待打包', isAbnormal: false },
  'awaiting-deliver': { label: '待发货', isAbnormal: false },
  'delivering': { label: '配送中', isAbnormal: false },
  'delivered': { label: '已送达', isAbnormal: false },
  'cancelled': { label: '已取消', isAbnormal: true },
  'refund': { label: '退款中', isAbnormal: true },
  'refunded': { label: '已退款', isAbnormal: true },
  'cancelled-by-player': { label: '买家取消', isAbnormal: true },
  'cancelled-by-seller': { label: '卖家取消', isAbnormal: true },
};

// 商品图片占位组件
function ProductImage({ product }: { product: OrderProduct }) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = product.image;

  if (!imageUrl || hasError) {
    // 无图占位：显示SKU首字母
    const initial = product.sku?.charAt(0)?.toUpperCase() || '?';
    return (
      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <span className="text-lg text-gray-400 font-bold">{initial}</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={product.name || product.sku}
      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
      onError={() => setHasError(true)}
    />
  );
}

// 单个商品行组件
function ProductRow({ product, index }: { product: OrderProduct; index: number }) {
  const displayName = product.name || '商品信息缺失';
  const isLongName = displayName.length > 30;

  return (
    <div className="flex items-center gap-3">
      {/* 商品图片 */}
      <ProductImage product={product} />

      {/* 商品信息 */}
      <div className="flex-1 min-w-0">
        {/* 商品名 - 超长截断+Tooltip */}
        {isLongName ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-sm font-medium text-gray-900 truncate cursor-help">
                {displayName}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>{displayName}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <p className="text-sm font-medium text-gray-900 truncate">
            {displayName}
          </p>
        )}
        {/* SKU + 数量 */}
        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
          <span className="font-mono">{product.sku || '—'}</span>
          <span>·</span>
          <span className="text-sm font-semibold text-gray-600">×{product.quantity}</span>
        </div>
      </div>
    </div>
  );
}

// 操作按钮配置
interface ActionButton {
  label: string;
  icon: React.ReactNode;
  variant: 'default' | 'outline' | 'destructive' | 'secondary';
  className?: string;
}

function getActionButton(
  erpStatus: string,
  isOverdue: boolean,
  router: ReturnType<typeof useRouter>
): ActionButton | null {
  const orderId = typeof router === 'function' ? '' : '';

  // 已完成状态不显示按钮
  if (['shipped', 'settled', 'cancelled'].includes(erpStatus)) {
    return null;
  }

  // 已超时或紧急 - 红色立即处理
  if (isOverdue) {
    return {
      label: '立即处理',
      icon: <AlertTriangle className="w-3 h-3" />,
      variant: 'destructive',
    };
  }

  switch (erpStatus) {
    case 'pending':
      return {
        label: '去采购',
        icon: <ShoppingCart className="w-3 h-3" />,
        variant: 'default',
      };
    case 'purchasing':
      return {
        label: '继续录入',
        icon: <Edit className="w-3 h-3" />,
        variant: 'outline',
        className: 'border-amber-400 text-amber-600 hover:bg-amber-50',
      };
    case 'purchased':
      return {
        label: '查看快递',
        icon: <Truck className="w-3 h-3" />,
        variant: 'outline',
      };
    case 'shipped_domestic':
      return {
        label: '跟踪物流',
        icon: <MapPin className="w-3 h-3" />,
        variant: 'outline',
      };
    case 'received':
    case 'qc_passed':
    case 'packing':
      return {
        label: '去验货',
        icon: <CheckCircle className="w-3 h-3" />,
        variant: 'outline',
        className: 'border-green-400 text-green-600 hover:bg-green-50',
      };
    default:
      return {
        label: '去采购',
        icon: <ShoppingCart className="w-3 h-3" />,
        variant: 'default',
      };
  }
}

export function OrderCard({ order, selected, onSelect }: OrderCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const countdown = getCountdown(order.shipmentDeadline);
  const isEmpty = !order.shipmentDeadline;

  // 获取商品列表
  const products = order.products || [];
  const visibleProducts = expanded ? products : products.slice(0, 2);
  const hiddenCount = products.length - 2;
  const totalSkus = products.length;
  const totalItems = products.reduce((sum: number, p: OrderProduct) => sum + (p.quantity || 0), 0);

  // 根据状态获取颜色配置
  const colors = isEmpty ? levelColors.empty : levelColors[countdown.level];
  const isOverdue = countdown.level === 'overdue';
  const isUrgent = countdown.level === 'urgent';

  // 获取采购状态
  const erpStatus = order.erpStatus || 'pending';
  const statusConfig = erpStatusMap[erpStatus] || erpStatusMap.pending;

  // 获取Ozon原始状态
  const ozonStatus = order.status || '';
  const ozonStatusConfig = ozonStatusMap[ozonStatus] || { label: ozonStatus, isAbnormal: false };

  // 处理操作按钮点击
  const handleAction = () => {
    const id = String(order.id);
    if (['shipped', 'settled', 'cancelled'].includes(erpStatus)) {
      return;
    }
    if (isOverdue) {
      router.push(`/purchase?orderId=${id}&action=create`);
      return;
    }
    switch (erpStatus) {
      case 'pending':
        router.push(`/purchase?orderId=${id}&action=create`);
        break;
      case 'purchasing':
        router.push(`/purchase?orderId=${id}&action=view`);
        break;
      default:
        router.push(`/purchase?orderId=${id}&action=view`);
    }
  };

  // 获取操作按钮
  const actionButton = getActionButton(erpStatus, isOverdue || isUrgent, router);

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
          colors.bar
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
            {/* 订单号 */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-sm text-blue-600 font-medium">
                {order.ozonPostingNumber || order.ozonOrderId || order.id}
              </span>
            </div>

            {/* 商品列表 */}
            {products.length > 0 ? (
              <>
                {visibleProducts.map((product, index) => (
                  <div key={`${product.sku || index}-${index}`} className={index > 0 ? 'mt-2' : ''}>
                    <ProductRow product={product} index={index} />
                  </div>
                ))}

                {/* 展开/收起按钮 */}
                {hiddenCount > 0 && (
                  <button
                    className="text-xs text-blue-500 hover:text-blue-600 mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(!expanded);
                    }}
                  >
                    {expanded ? '收起 ▲' : `+${hiddenCount}个商品`}
                  </button>
                )}

                {/* 底部汇总 */}
                {products.length > 1 && (
                  <div className="text-xs text-gray-400 mt-2">
                    共{totalSkus}个SKU · {totalItems}件商品
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">商品信息缺失</p>
            )}
          </div>

          {/* 中栏 - 金额 + 采购状态 */}
          <div className="w-32 flex flex-col items-center justify-center gap-2">
            {/* Ozon售价 */}
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Ozon售价</p>
              <p className="text-base font-bold text-gray-900">
                {order.totalPrice ? formatCNY(Number(order.totalPrice)) : '—'}
              </p>
            </div>
            {/* 采购状态Badge */}
            <Badge className={cn('text-xs px-2 py-0.5', statusConfig.className)}>
              {statusConfig.label}
            </Badge>
          </div>

          {/* 右栏 - 操作按钮 */}
          <div className="w-28 flex items-center justify-end">
            {actionButton ? (
              <Button
                size="sm"
                variant={actionButton.variant}
                className={cn(actionButton.className)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction();
                }}
              >
                {actionButton.icon}
                <span className="ml-1">{actionButton.label}</span>
              </Button>
            ) : (
              <span className="text-gray-400 text-sm">—</span>
            )}
          </div>
        </div>

        {/* 底部：订单号 + 店铺名 + Ozon原始状态 */}
        <div className="px-4 pb-3 flex items-center gap-3 text-xs">
          <span className="font-mono text-gray-500">#{order.ozonPostingNumber || order.ozonOrderId}</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">{order.shopName || '未知店铺'}</span>
          <span className="text-gray-300">·</span>
          <Badge
            variant="outline"
            className={cn(
              'text-xs px-1.5 py-0',
              ozonStatusConfig.isAbnormal
                ? 'border-red-200 text-red-600 bg-red-50'
                : 'border-gray-200 text-gray-500'
            )}
          >
            {ozonStatusConfig.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}
