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
    red: "text-red-500",
    amber: "text-amber-500",
    blue: "text-blue-600",
    gray: "text-gray-400",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-2xl font-bold ${colorClasses[color]} ${pulse ? "animate-pulse" : ""}`}>
        {value}
      </span>
      <span className="text-xs text-gray-500">{label}</span>
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

    // 超时：已过截止时间
    if (deadline < now) {
      overdueCount++;
    }

    // 紧急：距今小于24小时但还未超时
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
    <div className="rounded-xl bg-gray-100 px-5 py-2.5 flex items-center gap-6">
      <StatItem
        label="超时"
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
