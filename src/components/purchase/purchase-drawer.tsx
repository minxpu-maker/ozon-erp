'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { X, Package, ExternalLink, Loader2, ChevronDown, ChevronUp, Check, AlertTriangle } from 'lucide-react';
import { cn, formatCNY } from '@/lib/utils';
import { formatRUB } from '@/lib/utils';
import { PendingOrder, calcDeadline, getUrgencyBarClass, getDeadlineDisplay } from './pending-card';
import { DemandGroup } from './tab-pending';
import { createPurchaseRecord, fetchLastPrice } from '@/lib/api/purchase';


// 表单错误类型
interface FormErrors {
  purchasePrice?: string;
  supplierName?: string;
}

interface PurchaseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit' | 'view';
  data?: DemandGroup | null;
  selectedOrders?: string[]; // 选中的订单ID列表（批量模式）
  onSelectedOrdersChange?: (ids: string[]) => void;
  autoNextEnabled?: boolean; // 自动下一条开关
  onAutoNextChange?: (enabled: boolean) => void;
  onSubmit?: (success: boolean) => void; // 提交成功/失败回调
  onSkip?: () => void; // 跳过回调
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void; // Toast回调
}

export function PurchaseDrawer({
  open,
  onOpenChange,
  mode,
  data,
  selectedOrders = [],
  onSelectedOrdersChange,
  autoNextEnabled = true,
  onAutoNextChange,
  onSubmit,
  onSkip,
  onToast,
}: PurchaseDrawerProps) {
  // 表单状态
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [supplierSource, setSupplierSource] = useState<'1688' | 'pdd' | 'manual'>('1688');
  const [supplierName, setSupplierName] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  
  // UI状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [lastPrice, setLastPrice] = useState<{ purchasePrice: number | null; supplierName: string | null; orderedAt: string | null } | null>(null);
  const [lastPriceLoading, setLastPriceLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  
  // 加载上次采购价
  useEffect(() => {
    if (open && data?.sku) {
      setLastPriceLoading(true);
      fetchLastPrice(data.sku)
        .then(result => {
          // result 可能是 null 或包含 purchasePrice/supplierName/orderedAt
          setLastPrice(result);
        })
        .catch(() => {
          setLastPrice(null);
        })
        .finally(() => {
          setLastPriceLoading(false);
        });
    } else {
      setLastPrice(null);
    }
  }, [open, data?.sku]);
  
  // 重置表单
  useEffect(() => {
    if (!open) {
      setPurchasePrice('');
      setSupplierSource('1688');
      setSupplierName('');
      setSourceUrl('');
      setErrors({});
      setShowAllOrders(false);
    }
  }, [open]);
  
  // 表单校验
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!purchasePrice || parseFloat(purchasePrice) <= 0) {
      newErrors.purchasePrice = '采购价必须大于0';
    }
    
    if (!supplierName.trim()) {
      newErrors.supplierName = '供应商名称必填';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // 提交采购记录
  const handleSubmit = async () => {
    if (!validateForm() || !data) return;
    
    setIsSubmitting(true);
    
    try {
      // 获取选中的订单对应的demandId
      const ordersToProcess = selectedOrders.length > 0 
        ? data.orders.filter(o => selectedOrders.includes(o.orderId))
        : data.orders;
      
      if (ordersToProcess.length === 0) {
        onToast?.('请选择至少一条订单', 'error');
        setIsSubmitting(false);
        return;
      }
      
      // 批量创建采购记录
      for (const order of ordersToProcess) {
        await createPurchaseRecord({
          demandId: order.demandId, // 使用订单中的 demandId
          supplierSource,
          purchasePrice: parseFloat(purchasePrice),
          supplierName: supplierName.trim(),
          sourceUrl: sourceUrl.trim(),
          purchaseQty: order.quantity,
        });
      }
      
      onToast?.(`已确认 ${ordersToProcess.length} 笔采购`, 'success');
      onSubmit?.(true);
      
      // 自动下一条
      if (autoNextEnabled && onSkip) {
        setTimeout(() => {
          onSkip();
        }, 500);
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建采购记录失败';
      onToast?.(message, 'error');
      onSubmit?.(false);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // 跳过当前卡片
  const handleSkip = () => {
    onSkip?.();
  };
  
  // 计算最早截止时间
  const earliestDeadline = data?.orders.reduce<string | null>((min, o) => {
    if (!o.shipmentDeadline) return min;
    if (!min) return o.shipmentDeadline;
    return new Date(o.shipmentDeadline) < new Date(min) ? o.shipmentDeadline : min;
  }, null);
  
  const deadlineInfo = earliestDeadline ? calcDeadline(earliestDeadline) : { text: '无截止时间', level: 'normal' as const };
  const urgencyBarClass = getUrgencyBarClass(deadlineInfo.level);
  const deadlineDisplay = getDeadlineDisplay(deadlineInfo.level);
  
  // 按截止时间排序订单
  const sortedOrders = data?.orders.sort((a, b) => {
    if (!a.shipmentDeadline) return 1;
    if (!b.shipmentDeadline) return -1;
    return new Date(a.shipmentDeadline).getTime() - new Date(b.shipmentDeadline).getTime();
  }) || [];
  
  // 显示的订单（默认只显示前3条）
  const displayOrders = showAllOrders ? sortedOrders : sortedOrders.slice(0, 3);
  const hiddenCount = sortedOrders.length - displayOrders.length;
  
  // 订单勾选处理
  const toggleOrderSelection = (orderId: string) => {
    if (!onSelectedOrdersChange) return;
    
    if (selectedOrders.includes(orderId)) {
      onSelectedOrdersChange(selectedOrders.filter(id => id !== orderId));
    } else {
      onSelectedOrdersChange([...selectedOrders, orderId]);
    }
  };
  
  // 全选/取消全选
  const toggleAllOrders = () => {
    if (!onSelectedOrdersChange || !data) return;
    
    if (selectedOrders.length === data.orders.length) {
      onSelectedOrdersChange([]);
    } else {
      onSelectedOrdersChange(data.orders.map(o => o.orderId));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-[720px] max-w-[720px] rounded-l-2xl p-0 flex flex-col",
          "bg-white"
        )}
      >
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 左侧紧急度色条 */}
            <div className={cn("w-1.5 h-8 rounded-full", urgencyBarClass)} />
            <h2 className="text-lg font-semibold text-gray-900">
              录入采购
              {data?.orders && data.orders.length > 1 && (
                <span className="text-sm text-blue-500 ml-2">
                  （{data.orders.length}笔待采购）
                </span>
              )}
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 商品信息区 */}
        {data && (
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex gap-4">
              {/* 商品图片 */}
              <div className="w-28 h-28 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                {data.productImage ? (
                  <img
                    src={data.productImage}
                    alt={data.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-10 h-10 text-gray-300" />
                )}
              </div>
              
              {/* 商品信息 */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium text-gray-900 line-clamp-2 leading-snug">
                  {data.productName}
                </h3>
                <p className="text-sm text-gray-400 font-mono mt-1">
                  SKU: {data.sku || '未知'}
                </p>
                
                {/* 上次采购价提示 */}
                {lastPriceLoading ? (
                  <div className="text-sm text-gray-400 mt-2">
                    <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                    查询上次采购价...
                  </div>
                ) : lastPrice ? (
                  <div className="text-sm text-gray-500 mt-2 bg-gray-50 px-3 py-1.5 rounded-lg inline-flex items-center gap-2">
                    <span className="text-gray-600">上次采购价:</span>
                    <span className="font-medium text-gray-900">{lastPrice.purchasePrice ? formatCNY(lastPrice.purchasePrice) : '未知'}</span>
                    {lastPrice.supplierName && (
                      <span className="text-gray-400">({lastPrice.supplierName})</span>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 mt-2">
                    无历史采购记录
                  </div>
                )}
                
                {/* 自动下一条开关 */}
                {data.orders.length > 1 && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoNextEnabled}
                        onChange={(e) => onAutoNextChange?.(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      录入后自动跳下一张
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 关联订单区 */}
        {data && data.orders.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                关联订单 ({data.orders.length}笔)
              </h4>
              {data.orders.length > 1 && (
                <button
                  onClick={toggleAllOrders}
                  className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                >
                  {selectedOrders.length === data.orders.length ? '取消全选' : '全选'}
                </button>
              )}
            </div>
            
            <div className="space-y-2">
              {displayOrders.map((order) => {
                const orderDeadline = calcDeadline(order.shipmentDeadline);
                const orderDeadlineDisplay = getDeadlineDisplay(orderDeadline.level);
                const isSelected = selectedOrders.includes(order.orderId);
                
                return (
                  <div
                    key={order.orderId}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                      isSelected 
                        ? "bg-blue-50 border-blue-200" 
                        : "bg-white border-gray-100 hover:border-gray-200"
                    )}
                  >
                    {/* 勾选框 */}
                    {data.orders.length > 1 && (
                      <button
                        onClick={() => toggleOrderSelection(order.orderId)}
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          isSelected 
                            ? "bg-blue-600 border-blue-600" 
                            : "border-gray-300 hover:border-blue-400"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </button>
                    )}
                    
                    {/* 订单信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-blue-500 font-medium">
                          {order.ozonOrderId}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{order.shopName}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm font-bold text-gray-700">×{order.quantity}</span>
                        <span className="text-xs text-gray-500">{formatRUB(parseFloat(order.orderAmount) || 0)}</span>
                        <span className={cn("flex items-center gap-1", orderDeadlineDisplay.textClass)}>
                          {orderDeadlineDisplay.icon}
                          {orderDeadline.text}
                        </span>
                      </div>
                    </div>
                    
                    {/* 订单链接 */}
                    <a
                      href={`https://seller.ozon.ru/orders/${order.ozonOrderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                );
              })}
            </div>
            
            {/* 展开/收起按钮 */}
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAllOrders(true)}
                className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1"
              >
                <ChevronDown className="w-3 h-3" />
                展示全部 ({hiddenCount}笔隐藏)
              </button>
            )}
            {showAllOrders && sortedOrders.length > 3 && (
              <button
                onClick={() => setShowAllOrders(false)}
                className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1"
              >
                <ChevronUp className="w-3 h-3" />
                收起
              </button>
            )}
          </div>
        )}

        {/* 录入表单区 */}
        <div className="flex-1 px-6 py-5 overflow-auto">
          <div className="space-y-5">
            {/* 采购价 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                采购价 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
                <input
                  type="number"
                  step="0.01"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="0.00"
                  className={cn(
                    "w-full pl-8 pr-4 py-2.5 rounded-lg border bg-gray-50 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400",
                    "transition-colors",
                    errors.purchasePrice 
                      ? "border-red-300 bg-red-50 focus:ring-red-400" 
                      : "border-gray-200"
                  )}
                />
              </div>
              {errors.purchasePrice && (
                <p className="text-xs text-red-500 mt-1">{errors.purchasePrice}</p>
              )}
            </div>
            
            {/* 采购平台 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                采购平台
              </label>
              <select
                value={supplierSource}
                onChange={(e) => setSupplierSource(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-colors"
              >
                <option value="1688">1688</option>
                <option value="pdd">拼多多</option>
                <option value="manual">线下采购</option>
              </select>
            </div>
            
            {/* 供应商名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                供应商 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="输入供应商名称或店铺名"
                className={cn(
                  "w-full px-4 py-2.5 rounded-lg border bg-gray-50 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400",
                  "transition-colors",
                  errors.supplierName 
                    ? "border-red-300 bg-red-50 focus:ring-red-400" 
                    : "border-gray-200"
                )}
              />
              {errors.supplierName && (
                <p className="text-xs text-red-500 mt-1">{errors.supplierName}</p>
              )}
            </div>
            
            {/* 采购链接 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                采购链接
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="粘贴1688/拼多多商品链接"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-colors"
                />
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-blue-500"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
            
            {/* V2.8设计：快递单号在已下单Tab内联录入，不在Drawer中 */}
          </div>
        </div>

        {/* 操作按钮区 */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            {/* 跳过按钮 */}
            <button
              onClick={handleSkip}
              className="text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              跳过 →
            </button>
            
            {/* 主要操作 */}
            <div className="flex gap-3">
              <button
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "px-5 py-2 text-sm rounded-lg transition-colors flex items-center gap-2",
                  isSubmitting 
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                    : "bg-emerald-500 hover:bg-emerald-600 text-white"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    确认采购
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}