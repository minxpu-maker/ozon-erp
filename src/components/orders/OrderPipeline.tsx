"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import OrderToolbar, { ToolbarFilters, Shop } from './OrderToolbar';
import { SummaryBar } from './SummaryBar';
import { ErrorState } from "./ErrorState";
import { PaginationBar } from "./PaginationBar";
import BatchActionBar from "./BatchActionBar";
import { OrderCard, type OrderRecord } from "./OrderCard";
import { OrderListView } from "./OrderListView";
import EmptyState from "./EmptyState";
import { OrderCardSkeletonList } from "./OrderCardSkeleton";
import { getOrderStatusLabel } from "@/lib/utils";
import { PIPELINE_TABS, TabConfig, OrderStatus, default as PipelineTabs } from "./PipelineTabs";
import { cn } from "@/lib/utils";

// 初始筛选状态
const INITIAL_FILTERS: ToolbarFilters = {
  keyword: "",
  urgency: "all",
  timeRange: "all",
  shops: ["all"],
};

interface OrderPipelineProps {
  // 使用 unknown[] 避免类型不匹配，然后内部转换
  orders: unknown[];
  onSync?: () => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  lastSyncedAt?: Date | null;
}

export default function OrderPipeline({ orders, onSync, isLoading, error, onRetry, lastSyncedAt }: OrderPipelineProps) {
  const { mutate } = useSWRConfig();
  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("awaiting_deliver");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [filters, setFilters] = useState<ToolbarFilters>(INITIAL_FILTERS);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [prevTab, setPrevTab] = useState(activeTab);
  const [tabAnimating, setTabAnimating] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const listRef = useRef<HTMLDivElement>(null);

  // 将订单转换为 OrderRecord 类型
  const typedOrders = useMemo(() => orders as OrderRecord[], [orders]);

  // 从订单数据中动态提取店铺列表
  const availableShops: Shop[] = useMemo(() => {
    const shopMap = new Map<string, Shop>();
    typedOrders.forEach(order => {
      if (order.shopId && order.shopName && !shopMap.has(order.shopId)) {
        shopMap.set(order.shopId, { id: order.shopId, name: order.shopName });
      }
    });
    return Array.from(shopMap.values());
  }, [typedOrders]);

  // 筛选逻辑：先按Tab过滤，再按搜索+筛选条件过滤
  const filteredOrders = useMemo(() => {
    // 在渲染时计算当前时间，确保时区正确
    const now = Date.now();

    // Step 1: 按Tab过滤
    let result = typedOrders;
    if (activeTab !== "all") {
      result = result.filter((o) => o.status === activeTab);
    }

    // Step 2: 按搜索关键词过滤
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      result = result.filter((o) => {
        const matchPostingNumber = o.ozonPostingNumber?.toLowerCase().includes(keyword);
        const matchSku = o.products?.some(
          (p: { sku?: string; name?: string }) =>
            p.sku?.toLowerCase().includes(keyword) ||
            p.name?.toLowerCase().includes(keyword)
        );
        return matchPostingNumber || matchSku;
      });
    }

    // Step 3: 按紧急度过滤
    if (filters.urgency !== "all") {
      result = result.filter((o) => {
        if (!o.shipmentDeadline) return false;
        const deadline = new Date(o.shipmentDeadline).getTime();
        const diffHours = (deadline - now) / (1000 * 60 * 60);

        if (filters.urgency === "overdue") return diffHours < 0;
        if (filters.urgency === "urgent") return diffHours >= 0 && diffHours < 24;
        if (filters.urgency === "normal") return diffHours >= 24;
        return true;
      });
    }

    // Step 4: 按时间范围过滤
    if (filters.timeRange !== "all") {
      result = result.filter((o) => {
        if (!o.createdAt) return false;
        const created = new Date(o.createdAt).getTime();
        const diffHours = (now - created) / (1000 * 60 * 60);

        if (filters.timeRange === "today") return diffHours < 24;
        if (filters.timeRange === "3days") return diffHours < 72;
        if (filters.timeRange === "7days") return diffHours < 168;
        if (filters.timeRange === "30days") return diffHours < 720;
        return true;
      });
    }

    // Step 5: 按店铺过滤（多选OR关系）
    if (!filters.shops.includes("all") && filters.shops.length > 0) {
      result = result.filter((o) => filters.shops.includes(o.shopId || ""));
    }

    return result;
  }, [activeTab, typedOrders, filters]);

  // 批量选择
  const toggleSelect = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set<string | number>(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (paginatedOrders.every((o) => selectedIds.has(o.ozonPostingNumber))) {
      // 取消全选
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedOrders.forEach((o) => next.delete(o.ozonPostingNumber));
        return next;
      });
    } else {
      // 全选当前页
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedOrders.forEach((o) => next.add(o.ozonPostingNumber));
        return next;
      });
    }
  };

  const selectedCount = selectedIds.size;
  const selectedOrderIds = useMemo(() => {
    return Array.from(selectedIds).map(id => String(id));
  }, [selectedIds]);

  // 同步订单 - 4态逻辑
  const handleSync = async () => {
    if (!onSync || syncing) return;
    setSyncing(true);
    setSyncStatus("idle");
    try {
      await onSync();
      setSyncStatus("success");
      // 2秒后恢复默认状态
      setTimeout(() => setSyncStatus("idle"), 2000);
    } catch {
      setSyncStatus("error");
    } finally {
      setSyncing(false);
    }
  };

  // 新建采购
  const handleNewPurchase = () => {
    const ids = selectedOrderIds.join(",");
    window.location.href = `/purchase?from=orders&ids=${ids}`;
  };

  // 计算"X分钟前"
  const getSyncTimeLabel = (date: Date | null | undefined) => {
    if (!date) return "未同步";
    const diffMs = NOW - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return "刚刚";
    if (diffMinutes === 1) return "1分钟前";
    return `${diffMinutes}分钟前`;
  };

  // 清空选择
  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // 批量采购
  const handleBatchPurchase = async () => {
    try {
      const res = await fetch("/api/purchase/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedOrderIds }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        toast.success("批量采购成功");
      } else {
        throw new Error("批量采购失败");
      }
    } catch {
      toast.error("批量采购功能开发中");
    }
  };

  // 批量标记发货
  const handleBatchShip = async () => {
    try {
      const res = await fetch("/api/orders/batch/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedOrderIds, status: "shipped" }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        toast.success("批量标记发货成功");
      } else {
        throw new Error("批量标记发货失败");
      }
    } catch {
      toast.error("批量标记发货功能开发中");
    }
  };

  // 批量打印（占位）
  const handleBatchPrint = async () => {
    toast.info("批量打印功能开发中");
  };

  // 翻页处理
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    // 滚动到列表顶部
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    // 触发数据重新获取
    if (onSync) {
      onSync();
    }
  }, [onSync]);

  // 重置页码（当Tab或筛选条件变化时）
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filters]);

  // 计算分页
  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredOrders.slice(start, end);
  }, [filteredOrders, currentPage, pageSize]);

  // 全局快捷键注册
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查是否在输入框中
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || 
                            target.tagName === 'TEXTAREA' || 
                            target.isContentEditable;

      // Cmd/Ctrl + K - 唤起全局搜索
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('open-global-search'));
        return;
      }

      // Esc - 关闭弹窗/取消选中
      if (e.key === 'Escape') {
        if (selectedIds.size > 0) {
          setSelectedIds(new Set());
        }
        return;
      }

      // 数字键 1-7 切换 Tab（无输入框focus时）
      if (!isInputFocused && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 7) {
          e.preventDefault();
          const index = num - 1;
          if (index < PIPELINE_TABS.length) {
            const tab = PIPELINE_TABS[index];
            if (tab && !tab.disabled) {
              setPrevTab(activeTab);
              setTabAnimating(true);
              setTimeout(() => {
                setActiveTab(tab.key as OrderStatus);
                setSelectedIds(new Set());
                setTimeout(() => setTabAnimating(false), 50);
              }, 150);
            }
          }
        }
      }

      // Cmd/Ctrl + A - 全选当前页
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !isInputFocused) {
        e.preventDefault();
        const allIds = new Set(paginatedOrders.map((o: OrderRecord) => o.id));
        setSelectedIds(allIds);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, selectedIds, paginatedOrders]);

  // 计算Tab订单数（基于Tab过滤，不含筛选条件，用于Tab栏显示）
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    PIPELINE_TABS.forEach((tab: TabConfig) => {
      if (tab.key === "all") {
        counts.all = typedOrders.length;
      } else {
        counts[tab.key] = typedOrders.filter((o: OrderRecord) => o.status === tab.key).length;
      }
    });
    return counts;
  }, [typedOrders]);

  // Tab栏 - 使用新的卡片+箭头布局
  const renderTabs = () => (
    <PipelineTabs
      orders={typedOrders}
      activeTab={activeTab}
      onTabChange={(tab) => {
        if (tab !== activeTab) {
          setPrevTab(activeTab);
          setTabAnimating(true);
          setTimeout(() => {
            setActiveTab(tab);
            setSelectedIds(new Set());
            setTimeout(() => setTabAnimating(false), 50);
          }, 150);
        }
      }}
    />
  );


  // 摘要行 - 使用 SummaryBar 组件
  const renderSummary = () => (
    <SummaryBar orders={filteredOrders} currentTab={getOrderStatusLabel(activeTab)} totalCount={filteredOrders.length} />
  );

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-xl">
      {renderTabs()}
      <div className="mb-4" /> {/* Tab行→搜索栏间距 */}
      <OrderToolbar
        filters={filters}
        onFiltersChange={setFilters}
        availableShops={availableShops}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSync={handleSync}
        syncing={syncing}
      />
      <div className="mb-4" /> {/* 搜索栏→摘要行间距 */}
      {renderSummary()}
      
      {/* 错误态显示 */}
      {error && (
        <ErrorState
          message={error}
          onRetry={onRetry}
        />
      )}
      
      <div className="mb-4" />
      <div 
        ref={listRef}
        className={cn(
          "flex-1 overflow-y-auto px-4 py-3 pb-20 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent",
          "transition-opacity duration-150",
          tabAnimating ? "opacity-0" : "opacity-100"
        )}>
        {/* 加载态骨架屏 */}
        {isLoading ? (
          <OrderCardSkeletonList count={5} />
        ) : filteredOrders.length === 0 ? (
          <EmptyState tabName={getOrderStatusLabel(activeTab)} keyword={filters.keyword} />
        ) : viewMode === 'list' ? (
          <OrderListView
            orders={paginatedOrders as unknown as OrderRecord[]}
            selectedIds={new Set(Array.from(selectedIds).map(String))}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {paginatedOrders.map((order: OrderRecord) => (
              <OrderCard
                key={order.ozonPostingNumber}
                order={order}
                selected={selectedIds.has(order.ozonPostingNumber)}
                onSelect={toggleSelect}
                currentTab={activeTab}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* 底部：分页栏 */}
      {!error && (
        <PaginationBar
          page={currentPage}
          pageSize={pageSize}
          total={filteredOrders.length}
          totalPages={totalPages || 1}
          onPageChange={handlePageChange}
          onPageSizeChange={(size: number) => setCurrentPage(1)}
        />
      )}
    </div>
  );
}
