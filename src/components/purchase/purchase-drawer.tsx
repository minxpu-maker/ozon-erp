'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { X, Package, ExternalLink, Loader2, ChevronDown, ChevronUp, Check, AlertTriangle, Info, Undo2 } from 'lucide-react';
import { cn, formatCNY } from '@/lib/utils';
import { formatRUB } from '@/lib/utils';
import { PendingOrder, calcDeadline, getUrgencyBarClass, getDeadlineDisplay } from './pending-card';
import { DemandGroup } from './tab-pending';
import { createPurchaseRecord, fetchLastPrice, deletePurchaseRecord } from '@/lib/api/purchase';

// ERP 状态文字映射
const erpStatusText: Record<string, string> = {
  'pending_purchase': '待采购',
  'ordered': '已下单',
  'shipped': '运输中',
  'received': '已到货',
};

// 表单错误类型
interface FormErrors {
  purchasePrice?: string;
  supplierName?: string;
}

// 草稿数据结构
interface DraftData {
  purchasePrice: string;
  supplierSource: '1688' | 'pdd' | 'manual';
  supplierName: string;
  sourceUrl: string;
  savedAt: number;
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
  onRequestNextItem?: () => boolean; // 请求下一条，返回是否有下一条
  onShowUndoToast?: (recordIds: number[], sku: string) => void; // 显示撤销Toast
  purchaseInputRef?: React.RefObject<HTMLInputElement>; // 采购价输入框ref
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
  onRequestNextItem,
  onShowUndoToast,
  purchaseInputRef,
}: PurchaseDrawerProps) {
  // 表单状态
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [supplierSource, setSupplierSource] = useState<'1688' | 'pdd' | 'manual'>('1688');
  const [supplierName, setSupplierName] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  
  // UI状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false); // 确认后动画状态
  const [contentFading, setContentFading] = useState(false); // 内容淡出状态
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [lastPrice, setLastPrice] = useState<{ purchasePrice: number | null; supplierName: string | null; orderedAt: string | null } | null>(null);
  const [lastPriceLoading, setLastPriceLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  
  // 草稿恢复状态
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftData, setDraftData] = useState<DraftData | null>(null);
  
  // 创建的采购记录ID列表（用于撤销）
  const createdRecordIdsRef = useRef<number[]>([]);
  
  // 获取草稿localStorage key
  const getDraftKey = useCallback(() => {
    return `purchase_draft_${data?.sku || ''}`;
  }, [data?.sku]);
  
  // 保存草稿到localStorage
  const saveDraft = useCallback(() => {
    if (!data?.sku) return;
    const draft: DraftData = {
      purchasePrice,
      supplierSource,
      supplierName,
      sourceUrl,
      savedAt: Date.now(),
    };
    localStorage.setItem(getDraftKey(), JSON.stringify(draft));
  }, [data?.sku, purchasePrice, supplierSource, supplierName, sourceUrl, getDraftKey]);
  
  // 加载草稿
  const loadDraft = useCallback(() => {
    if (!data?.sku) return null;
    const key = getDraftKey();
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    try {
      const draft: DraftData = JSON.parse(stored);
      // 检查是否在24小时内
      const isWithin24Hours = Date.now() - draft.savedAt < 24 * 60 * 60 * 1000;
      if (!isWithin24Hours) {
        // 超过24小时，清除草稿
        localStorage.removeItem(key);
        return null;
      }
      return draft;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  }, [data?.sku, getDraftKey]);
  
  // 清除草稿
  const clearDraft = useCallback(() => {
    if (!data?.sku) return;
    localStorage.removeItem(getDraftKey());
    setShowDraftPrompt(false);
    setDraftData(null);
  }, [data?.sku, getDraftKey]);
  
  // 恢复草稿
  const restoreDraft = useCallback(() => {
    if (!draftData) return;
    setPurchasePrice(draftData.purchasePrice);
    setSupplierSource(draftData.supplierSource);
    setSupplierName(draftData.supplierName);
    setSourceUrl(draftData.sourceUrl);
    setShowDraftPrompt(false);
  }, [draftData]);
  
  // 加载上次采购价
  useEffect(() => {
    if (open && data?.sku) {
      setLastPriceLoading(true);
      fetchLastPrice(data.sku)
        .then(result => {
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
  
  // 检查并恢复草稿
  useEffect(() => {
    if (open && data?.sku) {
      const draft = loadDraft();
      if (draft) {
        setDraftData(draft);
        setShowDraftPrompt(true);
      } else {
        setShowDraftPrompt(false);
        setDraftData(null);
      }
    }
  }, [open, data?.sku, loadDraft]);
  
  // 每30秒自动保存草稿
  useEffect(() => {
    if (!open || !data?.sku) return;
    
    const interval = setInterval(() => {
      // 只有在有内容时才保存
      if (purchasePrice || supplierName || sourceUrl) {
        saveDraft();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [open, data?.sku, purchasePrice, supplierName, sourceUrl, saveDraft]);
  
  // 输入变化时立即保存草稿
  useEffect(() => {
    if (!open || !data?.sku) return;
    // 只有在有内容时才保存
    if (purchasePrice || supplierName || sourceUrl) {
      saveDraft();
    }
  }, [purchasePrice, supplierSource, supplierName, sourceUrl, open, data?.sku, saveDraft]);
  
  // 重置表单
  useEffect(() => {
    if (!open) {
      setPurchasePrice('');
      setSupplierSource('1688');
      setSupplierName('');
      setSourceUrl('');
      setErrors({});
      setShowAllOrders(false);
      setConfirmed(false);
      setContentFading(false);
      setShowDraftPrompt(false);
      setDraftData(null);
      createdRecordIdsRef.current = [];
    }
  }, [open]);
  
  // 聚焦采购价输入框
  const focusPurchaseInput = useCallback(() => {
    setTimeout(() => {
      purchaseInputRef?.current?.focus();
    }, 50);
  }, [purchaseInputRef]);
  
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
    const createdIds: number[] = [];
    
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
        const result = await createPurchaseRecord({
          demandId: order.demandId,
          supplierSource,
          purchasePrice: parseFloat(purchasePrice),
          supplierName: supplierName.trim(),
          sourceUrl: sourceUrl.trim(),
          purchaseQty: order.quantity,
        });
        // 保存创建的记录ID（假设API返回包含id）
        if (result?.id) {
          createdIds.push(result.id);
        }
      }
      
      createdRecordIdsRef.current = createdIds;
      
      // 清除草稿
      clearDraft();
      
      // 确认后动画：按钮变绿 + 文字变为"已确认"
      setConfirmed(true);
      onSubmit?.(true);
      
      // 显示撤销Toast
      if (onShowUndoToast && createdIds.length > 0) {
        onShowUndoToast(createdIds, data.sku || '');
      }
      
      // 800ms后执行后续逻辑
      setTimeout(async () => {
        setConfirmed(false);
        
        if (autoNextEnabled && onRequestNextItem) {
          // 淡出当前内容
          setContentFading(true);
          
          // 150ms后刷新为下一条数据
          setTimeout(() => {
            const hasNext = onRequestNextItem();
            setContentFading(false);
            
            if (hasNext) {
              // 有下一条，自动聚焦采购价输入框
              focusPurchaseInput();
            } else {
              // 没有下一条，关闭Drawer + 显示Toast
              onOpenChange(false);
              onToast?.('全部采购完毕！', 'success');
            }
          }, 150);
        } else {
          // 自动下一条关闭时，直接关闭Drawer
          onOpenChange(false);
        }
        
        setIsSubmitting(false);
      }, 800);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建采购记录失败';
      onToast?.(message, 'error');
      onSubmit?.(false);
      setIsSubmitting(false);
      setConfirmed(false);
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
          // 移动端：底部滑出
          "fixed bottom-0 top-auto left-0 right-0 w-full h-[85vh] rounded-t-2xl p-0 flex flex-col",
          // 桌面端：右侧滑出
          "md:top-0 md:bottom-0 md:left-auto md:right-0 md:w-[720px] md:max-w-[720px] md:rounded-l-2xl md:rounded-t-none md:h-full",
          // 桌面端：蓝色渐变边框 + 左侧阴影
          "md:border-l-2 md:border-l-blue-400/50",
          "md:shadow-[-8px_0_24px_rgba(59,130,246,0.15)]",
          "bg-white"
        )}
      >
        {/* 移动端顶部拖动条 */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-2 md:hidden" />
        
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

        {/* 内容区域（支持淡出动画） */}
        <div className={cn(
          "flex-1 flex flex-col overflow-hidden transition-opacity duration-[150ms]",
          contentFading && "opacity-0"
        )}>
          {/* 商品信息区 */}
          {data && (
            <div className="px-6 py-4 border-b border-gray-100">
              {/* 草稿恢复提示 */}
              {showDraftPrompt && draftData && (
                <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-amber-700">检测到未完成的录入草稿</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={restoreDraft}
                      className="text-sm text-blue-500 hover:text-blue-600 font-medium"
                    >
                      恢复
                    </button>
                    <button
                      onClick={clearDraft}
                      className="text-sm text-gray-400 hover:text-gray-600"
                    >
                      忽略
                    </button>
                  </div>
                </div>
              )}
              
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
                          {/* 订单号 Tooltip */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm text-blue-500 font-medium cursor-help underline underline-offset-2 decoration-dotted">
                                  {order.ozonOrderId}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent 
                                side="right" 
                                className="rounded-lg bg-white border border-gray-100 shadow-lg p-3 text-xs max-w-[240px]"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Info className="w-3.5 h-3.5 text-blue-500" />
                                    <span className="font-medium text-gray-900">订单详情</span>
                                  </div>
                                  <div className="space-y-1.5 text-gray-600">
                                    <div><span className="text-gray-400">Ozon订单号：</span>{order.ozonOrderId}</div>
                                    <div><span className="text-gray-400">店铺名：</span>{order.shopName}</div>
                                    <div><span className="text-gray-400">数量：</span>×{order.quantity}</div>
                                    <div><span className="text-gray-400">发货截止：</span>{order.shipmentDeadline ? new Date(order.shipmentDeadline).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未设置'}</div>
                                    <div><span className="text-gray-400">当前状态：</span>{erpStatusText[order.erpStatus] || order.erpStatus}</div>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
                    ref={purchaseInputRef}
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
            </div>
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
                  isSubmitting && !confirmed
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                    : confirmed
                      ? "bg-emerald-500 text-white"
                      : "bg-blue-500 hover:bg-blue-600 text-white"
                )}
              >
                {isSubmitting && !confirmed ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    提交中...
                  </>
                ) : confirmed ? (
                  <>
                    <Check className="w-4 h-4" />
                    已确认
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