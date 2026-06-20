"use client";

import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { OrderCard, OrderRecord } from "./OrderCard";
import EmptyState from "./EmptyState";
import { getOrderStatusLabel } from "@/lib/utils";
import { PIPELINE_TABS, TabConfig, OrderStatus } from "./PipelineTabs";

// 在模块顶层计算now，避免每次渲染重新计算
const NOW = Date.now();

interface OrderPipelineProps {
  // 使用 unknown[] 避免类型不匹配，然后内部转换
  orders: unknown[];
}

export default function OrderPipeline({ orders }: OrderPipelineProps) {
  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("awaiting_deliver");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // 将订单转换为 OrderRecord 类型
  const typedOrders = useMemo(() => orders as OrderRecord[], [orders]);

  // 根据Tab过滤订单
  const filteredOrders = useMemo(() => {
    if (activeTab === "all") {
      return typedOrders;
    }
    return typedOrders.filter((o) => o.status === activeTab);
  }, [activeTab, typedOrders]);

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

  // 计算Tab订单数
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
              onClick={() => !tab.disabled && setActiveTab(tab.key as OrderStatus)}
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

  // 摘要行
  const renderSummary = () => {
    const overdue = filteredOrders.filter((o: OrderRecord) => o.shipmentDeadline && new Date(o.shipmentDeadline).getTime() < NOW).length;
    const urgent = filteredOrders.filter((o: OrderRecord) => {
      if (!o.shipmentDeadline) return false;
      const deadline = new Date(o.shipmentDeadline).getTime();
      return deadline >= NOW && (deadline - NOW) < 24 * 60 * 60 * 1000;
    }).length;

    return (
      <div className="bg-white rounded-xl px-4 py-2.5 flex items-center justify-around">
        <div className="text-center">
          <span className={`text-lg font-bold ${overdue > 0 ? "text-red-600 animate-pulse" : "text-gray-400"}`}>
            {overdue}
          </span>
          <span className="text-sm text-gray-500 ml-1">逾期</span>
        </div>
        <div className="text-center">
          <span className={`text-lg font-bold ${urgent > 0 ? "text-amber-600" : "text-gray-400"}`}>
            {urgent}
          </span>
          <span className="text-sm text-gray-500 ml-1">紧急</span>
        </div>
        <div className="text-center">
          <span className="text-lg font-bold text-blue-600">{filteredOrders.length}</span>
          <span className="text-sm text-gray-500 ml-1">共</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {renderTabs()}
      <div className="h-10 bg-white border-b border-gray-200" />
      {renderSummary()}
      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
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
        <div className="h-14 bg-white border-t border-gray-200 flex items-center px-4 gap-4">
          <Checkbox
            checked={selectedCount === filteredOrders.length && filteredOrders.length > 0}
            onCheckedChange={() => {
              if (selectedCount === filteredOrders.length) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(filteredOrders.map((o: OrderRecord) => o.ozonPostingNumber)));
              }
            }}
          />
          <span className="text-sm text-gray-600">
            已选 {selectedCount}/{filteredOrders.length}
          </span>
        </div>
      )}
    </div>
  );
}
