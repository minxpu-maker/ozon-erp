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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ShoppingCart,
  Edit,
  Truck,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Minus,
  X,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface OrderProduct {
  name: string;
  sku: string;
  quantity: number;
  price: string;
  image?: string | null;
}

interface PurchaseInfo {
  platform?: string;
  purchasePrice?: number;
  purchaseQuantity?: number;
  totalAmount?: number;
  expressNumber?: string;
  supplier?: string;
  purchaseUrl?: string;
}

export interface OrderRecord {
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
  purchaseInfo?: PurchaseInfo | null;
  createdAt?: string;
  lastSyncedAt?: string;
}

export interface OrderCardProps {
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

// 采购详情Popover组件
function PurchaseDetailPopover({
  order,
  children,
}: {
  order: OrderRecord;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const purchaseInfo = order.purchaseInfo;
  const hasPurchaseInfo = !!purchaseInfo;

  // 判断状态是否可以点击查看采购详情
  const erpStatus = order.erpStatus || 'pending';
  const clickableStatuses = ['purchasing', 'purchased', 'shipped_domestic', 'received', 'qc_passed', 'packing', 'shipped', 'settled'];
  const isClickable = clickableStatuses.includes(erpStatus);

  // 复制快递号
  const copyExpressNumber = async () => {
    if (purchaseInfo?.expressNumber) {
      await navigator.clipboard.writeText(purchaseInfo.expressNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 跳转到采购工作台
  const goToPurchase = () => {
    setOpen(false);
    router.push(`/purchase?orderId=${order.id}&action=view`);
  };

  if (!isClickable) {
    // pending状态不可点击
    return <>{children}</>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <div className="cursor-pointer hover:opacity-80 transition-opacity">
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        side="bottom"
        align="start"
        sideOffset={4}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题行 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">采购详情</span>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-3">
          {hasPurchaseInfo ? (
            <>
              {/* 采购信息列表 */}
              <div className="space-y-2">
                {/* 采购平台 */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">采购平台</span>
                  <span className="text-gray-900">
                    {purchaseInfo.platform === 'pinduoduo' ? '拼多多' : '1688'}
                  </span>
                </div>

                {/* 采购单价 */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">采购单价</span>
                  <span className="text-gray-900 font-medium">
                    {purchaseInfo.purchasePrice
                      ? formatCNY(purchaseInfo.purchasePrice)
                      : '—'}
                  </span>
                </div>

                {/* 采购数量 */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">采购数量</span>
                  <span className="text-gray-900">
                    {purchaseInfo.purchaseQuantity
                      ? `${purchaseInfo.purchaseQuantity}件`
                      : '—'}
                  </span>
                </div>

                {/* 采购总价 */}
                <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                  <span className="text-gray-400">采购总价</span>
                  <span className="text-gray-900 font-bold">
                    {(purchaseInfo as Record<string, unknown>).total_cost != null
                      ? formatCNY(Number((purchaseInfo as Record<string, unknown>).total_cost))
                      : '—'}
                  </span>
                </div>

                {/* 快递单号 */}
                {purchaseInfo.expressNumber !== undefined && (
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                    <span className="text-gray-400">快递单号</span>
                    <span className="text-gray-900">
                      {purchaseInfo.expressNumber || (
                        <span className="text-gray-400">待填写</span>
                      )}
                    </span>
                  </div>
                )}

                {/* 供应商 */}
                {purchaseInfo.supplier && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">供应商</span>
                    <span className="text-gray-900">{purchaseInfo.supplier}</span>
                  </div>
                )}

                {/* 1688链接 */}
                {purchaseInfo.purchaseUrl && (
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-400 block mb-1">1688链接</span>
                    <a
                      href={purchaseInfo.purchaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 truncate"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">查看链接</span>
                    </a>
                  </div>
                )}
              </div>

              {/* 快捷操作 */}
              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                <Button size="sm" variant="outline" className="flex-1" onClick={goToPurchase}>
                  查看详情
                </Button>
                {purchaseInfo.expressNumber && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={copyExpressNumber}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    {copied ? '已复制' : '复制快递号'}
                  </Button>
                )}
              </div>
            </>
          ) : (
            /* 无采购记录 */
            <div className="text-center py-4">
              <p className="text-sm text-gray-400 mb-3">暂无采购记录</p>
              <Button size="sm" className="w-full" onClick={goToPurchase}>
                <ShoppingCart className="w-3 h-3 mr-1" />
                去采购
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
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
  isOverdue: boolean
): ActionButton | null {
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
  const [expandedProducts, setExpandedProducts] = useState(false);
  const countdown = getCountdown(order.shipmentDeadline);
  const isEmpty = !order.shipmentDeadline;

  // 获取商品列表
  const products = order.products || [];
  const visibleProducts = expandedProducts ? products : products.slice(0, 2);
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
  const actionButton = getActionButton(erpStatus, isOverdue || isUrgent);

  return (
    <div
      className={cn(
        'rounded-xl shadow-sm transition-all duration-200 ease-in-out',
        'hover:shadow-md hover:-translate-y-0.5',
        selected ? 'bg-gray-50' : 'bg-white',
        selected && 'ring-2 ring-blue-500'
      )}
      onClick={() => onSelect?.(order.id)}
    >
      {/* 左侧紧急度色条 */}
      <div
        className={cn(
          'w-1 rounded-l-xl transition-all duration-200',
          selected ? 'w-1.5' : 'w-1',
          // 选中时颜色变浅
          selected && isEmpty ? 'bg-gray-400' :
          selected && isOverdue ? 'bg-red-400' :
          selected && isUrgent ? 'bg-red-400' :
          selected && countdown.level === 'warning' ? 'bg-amber-300' :
          selected && 'bg-green-400',
          // 未选中时使用正常颜色
          !selected && colors.bar
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
                      setExpandedProducts(!expandedProducts);
                    }}
                  >
                    {expandedProducts ? '收起 ▲' : `+${hiddenCount}个商品`}
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

          {/* 中栏 - 金额 + 采购状态（带Popover） */}
          <div className="w-32 flex flex-col items-center justify-center gap-2">
            {/* Ozon售价 */}
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Ozon售价</p>
              <p className="text-base font-bold text-gray-900">
                {order.totalPrice ? formatCNY(Number(order.totalPrice)) : '—'}
              </p>
            </div>
            {/* 采购状态Badge - 带Popover */}
            <PurchaseDetailPopover order={order}>
              <Badge className={cn('text-xs px-2 py-0.5', statusConfig.className)}>
                {statusConfig.label}
              </Badge>
            </PurchaseDetailPopover>
          </div>

          {/* 右栏 - 操作按钮 */}
          <div className="w-28 flex items-center justify-end">
            {actionButton ? (
              <Button
                size="sm"
                variant={actionButton.variant}
                className={cn(actionButton.className, 'active:scale-95 transition-transform duration-100')}
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

        {/* 底部：订单号 + 店铺名 + Ozon原始状态 + 展开箭头 */}
        <div 
          className="px-4 pb-3 flex items-center gap-3 text-xs cursor-pointer select-none"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedProducts((prev) => !prev);
          }}
        >
          <span className="font-mono text-gray-500 hover:text-blue-500 transition-colors">
            #{order.ozonPostingNumber || order.ozonOrderId}
          </span>
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
          <span className="ml-auto">
            {expandedProducts ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-400 transition-transform duration-200" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 transition-transform duration-200" />
            )}
          </span>
        </div>

        {/* 展开详情面板 */}
        <div 
          className={cn(
            'overflow-hidden transition-all duration-200',
            expandedProducts ? 'max-h-[500px]' : 'max-h-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 pb-4">
            <div className="bg-gray-50 rounded-b-xl p-4 border-t border-gray-100">
              <div className="grid grid-cols-3 gap-4">
                {/* 左列 - 买家信息 */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">买家信息</h4>
                  <div className="space-y-1.5">
                    {order.recipientName || order.buyerName ? (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-sm text-gray-700 truncate cursor-help">
                              {order.recipientName || order.buyerName}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="max-w-xs">{order.recipientName || order.buyerName}</p>
                          </TooltipContent>
                        </Tooltip>
                        {order.recipientCity && (
                          <p className="text-xs text-gray-500">{order.recipientCity}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">买家信息缺失</p>
                    )}
                  </div>
                </div>

                {/* 中列 - 时间信息 */}
                <div className="space-y-2 border-l border-gray-200 pl-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">时间信息</h4>
                  <div className="space-y-1.5">
                    {order.createdAt && (
                      <div>
                        <p className="text-xs text-gray-400">创建时间</p>
                        <p className="text-sm text-gray-700">
                          {new Date(order.createdAt).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    )}
                    {order.lastSyncedAt && (
                      <div>
                        <p className="text-xs text-gray-400">同步时间</p>
                        <p className="text-sm text-gray-700">
                          {new Date(order.lastSyncedAt).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    )}
                    <a
                      href={`https://www.ozon.ru.com/seller/products/${order.ozonPostingNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      在Ozon查看
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* 右列 - 订单摘要 */}
                <div className="space-y-2 border-l border-gray-200 pl-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">订单摘要</h4>
                  <div className="space-y-1.5">
                    <div>
                      <p className="text-xs text-gray-400">订单金额</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {order.totalPrice ? formatCNY(Number(order.totalPrice)) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">商品数</p>
                      <p className="text-sm text-gray-700">
                        {products.length > 0 
                          ? `${totalSkus}个SKU · ${totalItems}件商品` 
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Ozon状态</p>
                      <p className="text-sm text-gray-700">{ozonStatusConfig.label}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
