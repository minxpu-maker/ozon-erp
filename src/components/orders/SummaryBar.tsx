"use client";

import { cn } from "@/lib/utils";
import { OrderRecord } from "@/components/orders/OrderCard";

interface SummaryBarProps {
  orders: OrderRecord[];
  currentTab: string;
  totalCount: number;
}

interface StatItemProps {
  label: string;
  value: number;
  color: "red" | "amber" | "gray" | "dark";
  pulse?: boolean;
  isFirst?: boolean;
}

function StatItem({ label, value, color, pulse, isFirst }: StatItemProps) {
  const colorClasses = {
    red: {
      number: "text-red-500",
      label: "text-red-400",
    },
    amber: {
      number: "text-amber-500",
      label: "text-amber-400",
    },
    gray: {
      number: "text-gray-400",
      label: "text-gray-500",
    },
    dark: {
      number: "text-gray-700",
      label: "text-gray-500",
    },
  };

  const colors = colorClasses[color];

  return (
    <div className={cn("flex flex-col items-center", !isFirst && "pl-8")}>
      {/* 数字 */}
      <span className={cn(
        "text-2xl font-bold tracking-tight leading-none",
        colors.number,
        pulse ? "animate-pulse" : ""
      )}>
        {value}
      </span>
      {/* 标签 */}
      <span className={cn("text-xs mt-0.5", colors.label)}>
        {label}
      </span>
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
    <div className="mx-4 rounded-xl bg-white border border-gray-100 px-5 py-3 flex items-center gap-0 shadow-sm">
      {/* 超时 */}
      <StatItem
        label="超时"
        value={overdueCount}
        color={overdueCount > 0 ? "red" : "gray"}
        pulse={overdueCount > 0}
        isFirst
      />
      
      {/* 分隔线 */}
      <div className="h-8 w-px bg-gray-200 mx-8" />
      
      {/* 紧急 */}
      <StatItem
        label="紧急"
        value={urgentCount}
        color={urgentCount > 0 ? "amber" : "gray"}
        pulse={urgentCount > 0}
      />
      
      {/* 分隔线 */}
      <div className="h-8 w-px bg-gray-200 mx-8" />
      
      {/* 总数 */}
      <StatItem
        label="共"
        value={totalCount}
        color="dark"
      />
    </div>
  );
}
