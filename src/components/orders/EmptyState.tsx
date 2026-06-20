"use client";

import { getOrderStatusLabel } from "@/lib/utils";

type OrderStatus = "awaiting_packaging" | "awaiting_deliver" | "delivering" | "disputed" | "delivered" | "cancelled" | "all";

interface EmptyStateProps {
  tabName: string;
  keyword?: string;
  onClearFilter?: () => void;
}

export default function EmptyState({ tabName, keyword, onClearFilter }: EmptyStateProps) {
  const tabLabel = tabName === "all" ? "" : getOrderStatusLabel(tabName);

  // 搜索无结果
  if (keyword) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <span className="text-5xl text-gray-300 mb-4">🔍</span>
        <p className="text-gray-500 text-base mb-2">
          未找到匹配&quot;{keyword}&quot;的订单
        </p>
        {onClearFilter && (
          <button
            onClick={onClearFilter}
            className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors"
          >
            清除筛选
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <span className="text-5xl text-gray-300 mb-4">📦</span>
      <p className="text-gray-400 text-base">
        {tabLabel ? `暂无${tabLabel}订单` : "暂无订单"}
      </p>
    </div>
  );
}
