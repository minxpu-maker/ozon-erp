'use client';

import { useState, type ReactNode } from 'react';
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
      <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <ShoppingBag className="w-8 h-8 text-gray-300" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 animate-pulse">
        <div className="w-12 h-12 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="relative">
      <img
        src={image}
        alt={name || sku}
        className="w-24 h-24 rounded-lg object-cover flex-shrink-0 cursor-pointer transition-transform duration-200 hover:scale-105"
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
  const [expandedDetails, setExpandedDetails] = useState(false);
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
        {/* 顶部：订单号 + 状态映射 + 店铺名（右对齐） */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            {/* 订单号 - 使用ozonPostingNumber */}
            <span className="text-sm font-medium text-blue-600 max-w-[280px] truncate" title={String(order.ozonPostingNumber || order.ozonOrderId || order.id)}>
              {order.ozonPostingNumber || order.ozonOrderId || order.id}
            </span>
            {/* 复制图标 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const orderNum = String(order.ozonPostingNumber || order.ozonOrderId || order.id);
                navigator.clipboard.writeText(orderNum);
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="复制订单编号"
            >
              <Copy className="w-3 h-3" />
            </button>
            {/* 状态Badge */}
            <span className={cn(
              'rounded-md px-2 py-0.5 text-xs font-medium border',
              badgeColors.bg, badgeColors.text, badgeColors.border
            )}>
              {statusLabel}
            </span>
          </div>
          {/* 店铺名 - 右上角 */}
          {order.shopName && (
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {order.shopName}
            </span>
          )}
        </div>

        {/* 商品区 */}
        <div className="px-5 pt-3 pb-3 flex-1">

          {products.length > 0 ? (
            <>
              {/* 1个商品：完整显示 */}
              {products.length === 1 && (
                <SingleProductRow 
                  product={products[0]} 
                  orderPrice={Number(order.totalPrice || 0)}
                  exchangeRate={rate}
                  actionButton={actionButton ?? undefined}
                  destination={order.recipientCity || ''}
                  deliveryDeadline={order.shipmentDeadline ? formatDateTime(order.shipmentDeadline) : ''}
                />
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
                  className="text-xs text-blue-500 hover:text-blue-600 mt-1"
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
                <>
                  <div className="mt-3 space-y-3">
                    {products.map((product, index) => (
                      <SingleProductRow 
                        key={`${product.sku || index}-${index}`} 
                        product={product} 
                      />
                    ))}
                  </div>
                  {/* 展开后显示总价 */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-baseline">
                    <span className="text-lg font-bold text-gray-900 mr-2">合计:</span>
                    <span className="text-xl font-bold tracking-tight text-gray-900">
                      {formatRUB(Number(order.totalPrice || 0))}
                    </span>
                    {rate && (
                      <span className="text-sm text-gray-400 ml-2">
                        ≈{formatCNYFromRUB(Number(order.totalPrice || 0))}
                      </span>
                    )}
                  </div>
                </>
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

        {/* 价格区 + 去采购按钮（多商品时显示，单商品时隐藏） */}
        <div className="px-5 pb-3">
          {products.length > 1 && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline">
                  <span className="text-2xl font-bold tracking-tight text-gray-900">
                    {formatRUB(Number(order.totalPrice || 0))}
                  </span>
                  {rate && (
                    <span className="text-sm text-gray-400 ml-2">
                      ≈{formatCNYFromRUB(Number(order.totalPrice || 0))}
                    </span>
                  )}
                </div>
              </div>
              {/* 外部已显示目的地和截止日期 */}
            </div>
          )}
        </div>

        {/* 底部元数据 */}
        <div className="px-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
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
          {/* 查看详情按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedDetails(!expandedDetails);
            }}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition-colors"
          >
            <span>{expandedDetails ? '收起详情' : '查看详情'}</span>
            {expandedDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* 展开详情面板 */}
        <div className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{
            gridTemplateRows: expandedDetails ? '1fr' : '0fr',
          }}
        >
          <div className="overflow-hidden">
            <div className="bg-gray-50 border-t border-gray-100 px-6 py-5 rounded-b-xl">
              <div className="grid grid-cols-3 gap-8">
                {/* 第1列：订单信息 */}
                <div>
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">订单信息</h4>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">订单号</span>
                      <div className="flex items-center gap-1 text-right">
                        <span className="text-xs text-gray-700 font-mono max-w-[180px] truncate" title={String(order.ozonPostingNumber || order.ozonOrderId || order.id)}>
                          {order.ozonPostingNumber || order.ozonOrderId || order.id}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(String(order.ozonPostingNumber || order.ozonOrderId || order.id));
                          }}
                          className="text-gray-300 hover:text-gray-500 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">创建时间</span>
                      <span className="text-xs text-gray-700">
                        {order.createdAt ? formatDateTime(order.createdAt) : <span className="text-gray-300 italic">暂无</span>}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">商品数量</span>
                      <span className="text-xs text-gray-700">{totalItems}件 / {totalSkus}SKU</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">总重量</span>
                      <span className="text-xs text-gray-700">
                        {totalWeight > 0 ? formatWeight(totalWeight) : <span className="text-gray-300 italic">暂无</span>}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">Ozon链接</span>
                      <a
                        href={products[0]?.productId ? `https://www.ozon.ru/product/${products[0].productId}/` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-600 hover:underline underline-offset-2 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        在Ozon查看
                      </a>
                    </div>
                  </div>
                </div>

                {/* 第2列：收货信息 */}
                <div>
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">收货信息</h4>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">收货城市</span>
                      <span className="text-xs text-gray-700">
                        {order.recipientCity || <span className="text-gray-300 italic">暂无</span>}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">发货截止</span>
                      <span className="text-xs text-gray-700">
                        {order.shipmentDeadline ? (
                          <span className="text-red-500 font-medium">{formatDateTime(order.shipmentDeadline)}</span>
                        ) : <span className="text-gray-300 italic">暂无</span>}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">配送方式</span>
                      <span className="text-xs text-gray-700">
                        {(order as any).deliveryType || <span className="text-gray-300 italic">暂无</span>}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">快递单号</span>
                      <span className="text-xs text-gray-700 font-mono">
                        {(order as any).trackingNumber || <span className="text-gray-300 italic">暂无</span>}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 第3列：支付信息 */}
                <div>
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">支付信息</h4>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">商品总价</span>
                      <span className="text-xs text-gray-700 font-medium">
                        {order.totalPrice ? formatRUB(Number(order.totalPrice)) : <span className="text-gray-300 italic">暂无</span>}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">买家实付</span>
                      <span className="text-xs text-gray-700">
                        {order.orderAmount ? formatRUB(Number(order.orderAmount)) : <span className="text-gray-300 italic">暂无</span>}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">折扣金额</span>
                      <span className="text-xs text-emerald-600">
                        {(order as any).discountAmount ? `-${formatRUB(Number((order as any).discountAmount))}` : <span className="text-gray-300 italic">无</span>}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">人民币</span>
                      <span className="text-xs text-gray-400">
                        {order.totalPrice ? formatCNYFromRUB(Number(order.totalPrice)) : <span className="text-gray-300 italic">暂无</span>}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 底部：展开/收起按钮 */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedDetails(false);
                  }}
                  className="w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
                >
                  <span>收起详情</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 单个商品行组件 - 完整尺寸
function SingleProductRow({ 
  product, 
  orderPrice,
  exchangeRate: rate,
  actionButton,
  destination,
  deliveryDeadline,
}: { 
  product: OrderProduct;
  orderPrice?: number;
  exchangeRate?: number;
  actionButton?: { label: string; icon: React.ReactNode; variant?: string; className?: string };
  destination?: string;
  deliveryDeadline?: string;
}) {
  const displayName = product.name || '商品信息缺失';
  const isLongName = displayName.length > 30;

  const productUrl = product.productId
    ? `https://www.ozon.ru/product/${product.productId}/`
    : product.sku ? `https://www.ozon.ru/search/?text=${encodeURIComponent(product.sku)}` : null;

  return (
    <div className="flex items-start gap-3">
      {/* 左侧：商品图片 */}
      <ProductImage image={product.image} name={product.name} sku={product.sku} />
      {/* 右侧：商品信息 */}
      <div className="flex-1 min-w-0">
        {isLongName ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {productUrl ? (
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 line-clamp-2 leading-snug hover:text-blue-600 transition-colors cursor-pointer"
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
              className="text-sm text-blue-500 line-clamp-2 leading-snug hover:text-blue-600"
              onClick={(e) => e.stopPropagation()}
            >
              {displayName}
            </a>
          ) : (
            <p className="text-sm text-gray-700 line-clamp-2 leading-snug">{displayName}</p>
          )
        )}
        {/* SKU + 复制按钮 + 数量 */}
        <div className="flex items-center gap-1 mt-2">
          <span className="text-base text-gray-400">SKU·</span>
          <span className="text-base font-mono text-gray-700 font-medium">{product.sku || '—'}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (product.sku) {
                navigator.clipboard.writeText(product.sku);
              }
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="复制SKU"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <span className="text-base text-gray-400 ml-2">数量·</span>
          <span className="text-base font-medium text-gray-700">×{product.quantity}</span>
        </div>
        {/* 金额 + 去采购按钮（单商品时显示） */}
        {orderPrice !== undefined && (
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-gray-900">{formatRUB(orderPrice)}</span>
              {rate && (
                <span className="text-sm text-gray-400">≈{formatCNYFromRUB(orderPrice)}</span>
              )}
            </div>
            {actionButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 骨架屏组件
// ============================================================================

/**
 * 订单卡片骨架屏
 */
export function OrderCardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="rounded-xl bg-white border border-gray-100 shadow-sm p-5 animate-pulse"
    >
      {/* 顶栏：Badge + 订单号 + 店铺 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-20 bg-gray-200 rounded-md" />
          <div className="h-5 w-32 bg-gray-200 rounded" />
        </div>
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </div>

      {/* 商品区 */}
      <div className="flex gap-4 mb-4">
        {/* 主商品图片 */}
        <div className="w-14 h-14 bg-gray-200 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 w-24 bg-gray-200 rounded" />
        </div>
      </div>

      {/* 底部信息行 */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="h-6 w-20 bg-gray-200 rounded" />
          <div className="h-4 w-16 bg-gray-200 rounded" />
        </div>
        <div className="h-9 w-20 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * 多商品骨架屏（2-3个商品）
 */
export function MultiProductSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="flex gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
          <div className="h-3 w-12 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Tab 计数骨架屏
 */
export function TabCountSkeleton() {
  return <div className="h-7 w-8 bg-gray-200 rounded animate-pulse" />;
}
