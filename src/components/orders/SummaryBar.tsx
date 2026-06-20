"use client";

import { OrderRecord } from "@/components/orders/OrderCard";

interface SummaryBarProps {
  orders: OrderRecord[];
  currentTab: string;
  totalCount: number;
}

interface StatItemProps {
  label: string;
  value: number;
  color: "red" | "amber" | "blue" | "gray";
  pulse?: boolean;
}

function StatItem({ label, value, color, pulse }: StatItemProps) {
  const colorClasses = {
    red: "text-red-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    gray: "text-gray-500",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-lg font-bold ${colorClasses[color]} ${pulse ? "animate-pulse" : ""}`}>
        {value}
      </span>
      <span className="text-sm text-gray-500">{label}</span>
    </div>
  );
}

function calculateStats(orders: OrderRecord[]) {
  const now = new Date();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  let overdueCount = 0;
  let urgentCount = 0;

  for (const order of orders) {
    if (!order.shipmentDeadline) continue;

    const deadline = new Date(order.shipmentDeadline);

    // 逾期：已过截止时间
    if (deadline < now) {
      overdueCount++;
    }

    // 紧急：距今小于24小时但还未逾期
    const timeDiff = deadline.getTime() - now.getTime();
    if (timeDiff >= 0 && timeDiff < twentyFourHours) {
      urgentCount++;
    }
  }

  return { overdueCount, urgentCount };
}

export function SummaryBar({ orders, currentTab, totalCount }: SummaryBarProps) {
  const { overdueCount, urgentCount } = calculateStats(orders);

  return (
    <div className="bg-white rounded-xl px-4 py-2.5 flex items-center justify-between">
      <StatItem
        label="逾期"
        value={overdueCount}
        color={overdueCount > 0 ? "red" : "gray"}
        pulse={overdueCount > 0}
      />
      <StatItem
        label="紧急"
        value={urgentCount}
        color={urgentCount > 0 ? "amber" : "gray"}
        pulse={urgentCount > 0}
      />
      <StatItem label="共" value={totalCount} color="blue" />
    </div>
  );
}
