"use client";

import { getOrderStatusLabel } from "@/lib/utils";

type OrderStatus = "awaiting_packaging" | "awaiting_deliver" | "delivering" | "disputed" | "delivered" | "cancelled" | "all";

interface EmptyStateProps {
  tabName: string;
}

export default function EmptyState({ tabName }: EmptyStateProps) {
  const tabLabel = tabName === "all" ? "" : getOrderStatusLabel(tabName);

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <span className="text-5xl text-gray-300 mb-4">📦</span>
      <p className="text-gray-400 text-base">
        {tabLabel ? `暂无${tabLabel}订单` : "暂无订单"}
      </p>
    </div>
  );
}
