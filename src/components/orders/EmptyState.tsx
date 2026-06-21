"use client";

import { Inbox } from "lucide-react";
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
      <div className="flex flex-col items-center justify-center py-20">
        <Inbox className="text-gray-300 w-16 h-16" />
        <p className="text-gray-500 text-sm mt-3">
          未找到匹配&quot;{keyword}&quot;的订单
        </p>
        {onClearFilter && (
          <button
            onClick={onClearFilter}
            className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors mt-2"
          >
            清除筛选
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Inbox className="text-gray-300 w-16 h-16" />
      <p className="text-gray-400 text-sm mt-3">
        {tabLabel ? `暂无${tabLabel}订单` : "暂无订单"}
      </p>
    </div>
  );
}
