'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn, formatCNY, formatRUB, formatCNYFromRUB, formatWeight, formatDateTime } from '@/lib/utils';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Button } from '@/components/ui/button';
import { PurchaseStatusBadge } from './PurchaseStatusBadge';
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
  ShoppingBag,
  Edit,
  Truck,
  MapPin,
  CheckCircle,
  AlertTriangle,
  X,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { OrderStatus } from './PipelineTabs';

interface OrderProduct {
  name: string;
  sku: string;
  quantity: number;
  price: string;
  image?: string | null;
  productId?: string | number;
  weight?: number | null;
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
  updatedAt?: string;
  lastSyncedAt?: string;
  weight?: number | null;
  isInspected?: boolean;
  isPacked?: boolean;
  isPurchaseBound?: boolean;
}

export interface OrderCardProps {
  order: OrderRecord;
  selected?: boolean;
  onSelect?: (id: string | number) => void;
  currentTab?: OrderStatus | 'all';
}

// 状态Badge颜色映射（带border）
const statusBadgeColors: Record<string, { bg: string; text: string; border: string }> = {
  'awaiting-packaging': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  'awaiting_packaging': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  'awaiting-deliver': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  'awaiting_deliver': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  'delivering': { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  'delivered': { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  'cancelled': { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
};

// 状态标签映射
const statusLabels: Record<string, string> = {
  'awaiting-packaging': '等待备货',
  'awaiting_packaging': '等待备货',
  'awaiting-deliver': '等待发运',
  'awaiting_deliver': '等待发运',
  'delivering': '运输中',
  'delivered': '已签收',
  'cancelled': '已取消',
};

// 商品图片占位组件 - 14x14
function ProductImageMini({ image, name, sku }: { image?: string | null; name: string; sku: string }) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!image);

  if (!image || hasError) {
    return (
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <ShoppingBag className="w-5 h-5 text-gray-300" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 animate-pulse">
        <div className="w-5 h-5 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <img
      src={image}
      alt={name || sku}
      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
      onLoad={() => setIsLoading(false)}
      onError={() => {
        setHasError(true);
        setIsLoading(false);
      }}
    />
  );
}

// 商品图片占位组件 - 完整尺寸 14x14
function ProductImage({ image, name, sku }: { image?: string | null; name: string; sku: string }) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!image);
  const [isHovering, setIsHovering] = useState(false);

  if (!image || hasError) {
    return (
      <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <ShoppingBag className="w-6 h-6 text-gray-300" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 animate-pulse">
        <div className="w-8 h-8 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="relative">
      <img
        src={image}
        alt={name || sku}
        className="w-14 h-14 rounded-lg object-cover flex-shrink-0 cursor-pointer transition-transform duration-200 hover:scale-110"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      />
      {/* 悬停放大预览 */}
      {isHovering && (
        <div className="absolute left-full ml-2 top-0 z-50 pointer-events-none">
          <img
            src={image}
            alt={name || sku}
            className="w-64 h-64 rounded-lg object-cover border border-gray-200 shadow-lg"
          />
        </div>
      )}
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

  const erpStatus = order.erpStatus || 'pending';
  const clickableStatuses = ['purchasing', 'purchased', 'shipped_domestic', 'received', 'qc_passed', 'packing', 'shipped', 'settled'];
  const isClickable = clickableStatuses.includes(erpStatus);

  const copyExpressNumber = async () => {
    if (purchaseInfo?.expressNumber) {
      await navigator.clipboard.writeText(purchaseInfo.expressNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const goToPurchase = () => {
    setOpen(false);
    router.push(`/purchase?orderId=${order.id}&action=view`);
  };

  if (!isClickable) {
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
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">采购详情</span>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3">
          {hasPurchaseInfo ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">采购平台</span>
                <span className="text-gray-900">
                  {purchaseInfo.platform === 'pinduoduo' ? '拼多多' : '1688'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">采购单价</span>
                <span className="text-gray-900 font-medium">
                  {purchaseInfo.purchasePrice ? formatCNY(purchaseInfo.purchasePrice) : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">采购数量</span>
                <span className="text-gray-900">
                  {purchaseInfo.purchaseQuantity ? `${purchaseInfo.purchaseQuantity}件` : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                <span className="text-gray-400">采购总价</span>
                <span className="text-gray-900 font-bold">
                  {(purchaseInfo as Record<string, unknown>).total_cost != null
                    ? formatCNY(Number((purchaseInfo as Record<string, unknown>).total_cost))
                    : '—'}
                </span>
              </div>
              {purchaseInfo.expressNumber !== undefined && (
                <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                  <span className="text-gray-400">快递单号</span>
                  <span className="text-gray-900">{purchaseInfo.expressNumber || <span className="text-gray-400">待填写</span>}</span>
                </div>
              )}
              {purchaseInfo.supplier && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">供应商</span>
                  <span className="text-gray-900">{purchaseInfo.supplier}</span>
                </div>
              )}
              {purchaseInfo.purchaseUrl && (
                <div className="pt-2 border-t border-gray-100">
                  <span className="text-sm text-gray-400 block mb-1">1688链接</span>
                  <a href={purchaseInfo.purchaseUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 truncate">
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">查看链接</span>
                  </a>
                </div>
              )}
              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                <Button size="sm" variant="outline" className="flex-1" onClick={goToPurchase}>查看详情</Button>
                {purchaseInfo.expressNumber && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={copyExpressNumber}>
                    <Copy className="w-3 h-3 mr-1" />{copied ? '已复制' : '复制快递号'}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400 mb-3">暂无采购记录</p>
              <Button size="sm" className="w-full" onClick={goToPurchase}>
                <ShoppingCart className="w-3 h-3 mr-1" />去采购
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// 获取操作按钮
function getActionButton(
  erpStatus: string,
  currentTab: OrderStatus | 'all'
): { label: string; icon: React.ReactNode; variant: string; className?: string } | null {
  // 根据Tab决定按钮
  if (currentTab === 'delivering' || currentTab === 'delivered' || currentTab === 'cancelled') {
    return null; // 运输中/已签收/已取消隐藏按钮
  }

  if (currentTab === 'awaiting_packaging') {
    // 等待备货 Tab
    return {
      label: '备货',
      icon: <ShoppingCart className="w-3.5 h-3.5" />,
      variant: 'default',
      className: 'rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2',
    };
  }

  if (currentTab === 'all') {
    // 全部 Tab：仅pending_purchase状态显示
    if (erpStatus === 'pending_purchase') {
      return {
        label: '去采购',
        icon: <ShoppingCart className="w-3.5 h-3.5" />,
        variant: 'default',
        className: 'rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2',
      };
    }
    return null;
  }

  // 默认：等待发运 Tab
  return {
    label: '去采购',
    icon: <ShoppingCart className="w-3.5 h-3.5" />,
    variant: 'default',
    className: 'rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2',
  };
}

export function OrderCard({ order, selected, onSelect, currentTab = 'all' }: OrderCardProps) {
  const router = useRouter();
  const [expandedProducts, setExpandedProducts] = useState(false);
  const { rate } = useExchangeRate();

  const products = order.products || [];
  const totalSkus = products.length;
  const totalItems = products.reduce((sum: number, p: OrderProduct) => sum + (p.quantity || 0), 0);

  const erpStatus = order.erpStatus || 'pending';

  // 获取状态Badge样式
  const statusKey = order.status || 'awaiting_deliver';
  const badgeColors = statusBadgeColors[statusKey] || statusBadgeColors['awaiting_deliver'];
  const statusLabel = statusLabels[statusKey] || '等待发运';

  // 处理操作按钮点击
  const handleAction = () => {
    const id = String(order.id);
    router.push(`/purchase?orderId=${id}&action=create`);
  };

  const actionButton = getActionButton(erpStatus, currentTab);

  // 计算所有商品总重量
  const totalWeight = products.reduce((sum: number, p: OrderProduct) => {
    return sum + ((p.weight || 0) * (p.quantity || 1));
  }, 0);

  return (
    <div
      className={cn(
        'rounded-xl bg-white border border-gray-100 shadow-sm',
        'hover:shadow-md hover:border-gray-200 transition-all duration-200',
        selected ? 'ring-2 ring-blue-400 shadow-md' : ''
      )}
      onClick={() => onSelect?.(order.id)}
    >
      <div className="flex flex-col">
        {/* 顶部：订单号 + 状态Badge + 元数据 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          {/* 左侧：订单号 + 状态Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-medium text-gray-700">
              # {order.ozonPostingNumber || order.ozonOrderId || order.id}
            </span>
            <span className={cn(
              'rounded-md px-2 py-0.5 text-xs font-medium border',
              badgeColors.bg, badgeColors.text, badgeColors.border
            )}>
              {statusLabel}
            </span>
          </div>
          {/* 右侧：店铺名 */}
          <span className="text-xs text-gray-400">
            {order.shopName || '未知店铺'}
          </span>
        </div>

        {/* 商品区 */}
        <div className="px-5">
          {products.length > 0 ? (
            <>
              {/* 1个商品：完整显示 */}
              {products.length === 1 && (
                <SingleProductRow product={products[0]} />
              )}

              {/* 2-3个商品：横向排列 */}
              {products.length >= 2 && products.length <= 3 && !expandedProducts && (
                <div className="flex items-center gap-3 overflow-x-auto">
                  {products.map((product, index) => (
                    <div key={`${product.sku || index}-${index}`} className="flex items-center gap-2 flex-shrink-0">
                      <ProductImageMini image={product.image} name={product.name} sku={product.sku} />
                      <span className="text-sm text-gray-700 line-clamp-1 max-w-[120px]">
                        {product.name || '商品信息缺失'}
                      </span>
                      <span className="text-xs text-gray-500">×{product.quantity}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 2-3个商品：展开查看详情 */}
              {products.length >= 2 && products.length <= 3 && (
                <button
                  className="text-xs text-blue-500 hover:text-blue-600 mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedProducts(!expandedProducts);
                  }}
                >
                  {expandedProducts ? '收起 ▲' : `查看详情 ▼`}
                </button>
              )}

              {/* 4个以上：显示前3个 */}
              {products.length >= 4 && !expandedProducts && (
                <>
                  <div className="flex items-center gap-3 overflow-x-auto">
                    {products.slice(0, 3).map((product, index) => (
                      <div key={`${product.sku || index}-${index}`} className="flex items-center gap-2 flex-shrink-0">
                        <ProductImageMini image={product.image} name={product.name} sku={product.sku} />
                        <span className="text-sm text-gray-700 line-clamp-1 max-w-[100px]">
                          {product.name || '商品信息缺失'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 mt-2 block">+{products.length - 3}件商品</span>
                </>
              )}

              {/* 4个以上：展开查看全部 */}
              {products.length >= 4 && (
                <button
                  className="text-xs text-blue-500 hover:text-blue-600 mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedProducts(!expandedProducts);
                  }}
                >
                  {expandedProducts ? `收起 ▲` : `查看全部${products.length}个商品 ▼`}
                </button>
              )}

              {/* 展开后的完整商品列表 */}
              {expandedProducts && (
                <div className="mt-3 space-y-3">
                  {products.map((product, index) => (
                    <SingleProductRow key={`${product.sku || index}-${index}`} product={product} />
                  ))}
                </div>
              )}

              {/* 商品汇总 */}
              {products.length > 1 && !expandedProducts && (
                <div className="text-xs text-gray-400 mt-2">
                  共{totalSkus}个SKU · {totalItems}件商品
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 py-4">商品信息缺失</p>
          )}
        </div>

        {/* 价格区 */}
        <div className="px-5 py-3 mt-2">
          <div className="flex items-baseline">
            {/* Ozon售价 */}
            <span className="text-2xl font-bold tracking-tight text-gray-900">
              {order.totalPrice ? formatRUB(Number(order.totalPrice)) : '—'}
            </span>
            {/* 人民币换算 */}
            <span className="text-sm text-gray-400 ml-2">
              ≈{order.totalPrice ? formatCNYFromRUB(Number(order.totalPrice)) : '¥ 0.00'}
            </span>
          </div>
          {/* 买家实付 */}
          {order.orderAmount && order.orderAmount !== order.totalPrice && (
            <div className="text-xs text-gray-400 mt-0.5">
              买家实付 {formatRUB(Number(order.orderAmount))}
            </div>
          )}
        </div>

        {/* 底部元数据 */}
        <div 
          className="px-5 pb-3 flex items-center gap-2 text-xs text-gray-400 flex-wrap"
          onClick={(e) => {
            e.stopPropagation();
            if (products.length > 1) {
              setExpandedProducts((prev) => !prev);
            }
          }}
        >
          {order.recipientCity && (
            <>
              <span>{order.recipientCity}</span>
              <span>·</span>
            </>
          )}
          {totalWeight > 0 && (
            <>
              <span>{formatWeight(totalWeight)}</span>
              <span>·</span>
            </>
          )}
          {order.shipmentDeadline && (
            <span className="text-gray-600">截止 {formatDateTime(order.shipmentDeadline)}</span>
          )}
        </div>

        {/* 操作区 */}
        {actionButton && (
          <div className="px-5 pb-4 border-t border-gray-100 pt-3 mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAction();
              }}
              className={cn(
                'rounded-lg text-white text-sm font-medium px-4 py-2',
                'transition-colors duration-150',
                'active:scale-[0.98] active:bg-blue-700',
                'bg-blue-500 hover:bg-blue-600'
              )}
            >
              <span className="flex items-center justify-center gap-1.5">
                {actionButton.icon}
                <span>{actionButton.label}</span>
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 单个商品行组件 - 完整尺寸
function SingleProductRow({ product }: { product: OrderProduct }) {
  const displayName = product.name || '商品信息缺失';
  const isLongName = displayName.length > 30;

  const productUrl = product.productId
    ? `https://www.ozon.ru/product/${product.productId}/`
    : product.sku ? `https://www.ozon.ru/search/?text=${encodeURIComponent(product.sku)}` : null;

  return (
    <div className="flex items-start gap-3">
      <ProductImage image={product.image} name={product.name} sku={product.sku} />
      <div className="flex-1 min-w-0">
        {isLongName ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {productUrl ? (
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-700 line-clamp-2 leading-snug hover:text-blue-600"
                  onClick={(e) => e.stopPropagation()}
                >
                  {displayName}
                </a>
              ) : (
                <p className="text-sm text-gray-700 line-clamp-2 leading-snug">{displayName}</p>
              )}
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>{displayName}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          productUrl ? (
            <a
              href={productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-700 line-clamp-2 leading-snug hover:text-blue-600"
              onClick={(e) => e.stopPropagation()}
            >
              {displayName}
            </a>
          ) : (
            <p className="text-sm text-gray-700 line-clamp-2 leading-snug">{displayName}</p>
          )
        )}
        <div className="flex items-center gap-1 mt-1">
          <span className="text-xs font-mono text-gray-400">{product.sku || '—'}</span>
          <span className="text-gray-300">·</span>
          <span className="text-xs font-medium text-gray-500">×{product.quantity}</span>
        </div>
      </div>
    </div>
  );
}
