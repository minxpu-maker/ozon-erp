"use client";

import { useState, useMemo } from "react";
import OrderToolbar, { ToolbarFilters } from "./OrderToolbar";
import { SummaryBar } from "./SummaryBar";
import BatchActionBar from "./BatchActionBar";
import { OrderCard, OrderRecord } from "./OrderCard";
import EmptyState from "./EmptyState";
import { getOrderStatusLabel } from "@/lib/utils";
import { PIPELINE_TABS, TabConfig, OrderStatus } from "./PipelineTabs";

// 在模块顶层计算now，避免每次渲染重新计算
const NOW = Date.now();

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
}

export default function OrderPipeline({ orders, onSync }: OrderPipelineProps) {
  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("awaiting_deliver");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [filters, setFilters] = useState<ToolbarFilters>(INITIAL_FILTERS);
  const [syncing, setSyncing] = useState(false);

  // 将订单转换为 OrderRecord 类型
  const typedOrders = useMemo(() => orders as OrderRecord[], [orders]);

  // 筛选逻辑：先按Tab过滤，再按搜索+筛选条件过滤
  const filteredOrders = useMemo(() => {
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
        const diffHours = (deadline - NOW) / (1000 * 60 * 60);

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
        const now = NOW;
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

  const selectedCount = selectedIds.size;
  const selectedOrderIds = useMemo(() => {
    return Array.from(selectedIds).map(id => String(id));
  }, [selectedIds]);

  // 同步订单
  const handleSync = async () => {
    if (!onSync || syncing) return;
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  };

  // 新建采购
  const handleNewPurchase = () => {
    const ids = selectedOrderIds.join(",");
    window.location.href = `/purchase?from=orders&ids=${ids}`;
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
        // 成功后清空选中并刷新
        setSelectedIds(new Set());
        // TODO: 刷新订单列表
      } else {
        throw new Error("批量采购失败");
      }
    } catch {
      // API 未就绪时提示
      alert("批量采购功能开发中");
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
        // 成功后清空选中并刷新
        setSelectedIds(new Set());
        // TODO: 刷新订单列表
      } else {
        throw new Error("批量标记发货失败");
      }
    } catch {
      // API 未就绪时提示
      alert("批量标记发货功能开发中");
    }
  };

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

  // Tab栏
  const renderTabs = () => (
    <div className="bg-white border-b border-gray-200">
      <div className="flex px-4">
        {PIPELINE_TABS.map((tab: TabConfig) => {
          const isActive = activeTab === tab.key;
          const count = tabCounts[tab.key] || 0;
          
          return (
            <button
              key={tab.key}
              onClick={() => {
                if (!tab.disabled) {
                  setActiveTab(tab.key as OrderStatus);
                  // Tab切换时清空选中
                  setSelectedIds(new Set());
                }
              }}
              className={`
                relative px-4 py-3 text-sm font-medium transition-colors
                ${tab.disabled ? "text-gray-400 cursor-not-allowed" : ""}
                ${!tab.disabled && isActive ? tab.textColor : ""}
                ${!tab.disabled && !isActive ? "text-gray-500 hover:text-gray-700" : ""}
              `}
              disabled={tab.disabled}
              title={tab.disabled ? tab.disabledReason : undefined}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {count > 0 && (
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full
                    ${isActive ? tab.bgLight : "bg-gray-100 text-gray-600"}
                  `}>
                    {count}
                  </span>
                )}
              </span>
              {isActive && (
                <div className={`absolute bottom-0 left-2 right-2 h-0.5 ${tab.color === "amber" ? "bg-amber-500" : tab.color === "blue" ? "bg-blue-600" : tab.color === "purple" ? "bg-purple-500" : tab.color === "teal" ? "bg-teal-500" : "bg-gray-400"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );


  // 摘要行 - 使用 SummaryBar 组件
  const renderSummary = () => (
    <SummaryBar orders={filteredOrders} currentTab={getOrderStatusLabel(activeTab)} totalCount={filteredOrders.length} />
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {renderTabs()}
      <OrderToolbar
        filters={filters}
        onFiltersChange={setFilters}
        onSync={handleSync}
        syncing={syncing}
        selectedOrderIds={selectedOrderIds}
        onNewPurchase={handleNewPurchase}
      />
      {renderSummary()}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-20 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {filteredOrders.length === 0 ? (
          <EmptyState tabName={getOrderStatusLabel(activeTab)} />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredOrders.map((order: OrderRecord) => (
              <OrderCard
                key={order.ozonPostingNumber}
                order={order}
                selected={selectedIds.has(order.ozonPostingNumber)}
                onSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>
      {selectedCount > 0 && (
        <div className="h-14" /> // 占位，保持布局
      )}
      <BatchActionBar
        selectedCount={selectedCount}
        selectedIds={selectedIds}
        orders={filteredOrders}
        onClearSelection={handleClearSelection}
        onBatchPurchase={handleBatchPurchase}
        onBatchShip={handleBatchShip}
      />
    </div>
  );
}
