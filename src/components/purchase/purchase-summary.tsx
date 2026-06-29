"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Package, Truck, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchPurchaseStats } from "@/lib/api/purchase";

interface PurchaseStats {
  pendingPurchaseCount: number;
  orderedCount: number;
  orderedWithoutTrackingCount: number;
  inTransitCount: number;
  todayPurchasedCount: number;
  todayPurchasedAmount: number;
}

interface PurchaseSummaryProps {
  className?: string;
}

export function PurchaseSummary({ className }: PurchaseSummaryProps) {
  const [stats, setStats] = useState<PurchaseStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await fetchPurchaseStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to load purchase stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      label: "待采购",
      icon: ShoppingCart,
      value: stats?.pendingPurchaseCount ?? 0,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      iconBg: "bg-amber-100",
    },
    {
      label: "已下单",
      icon: Package,
      value: stats?.orderedCount ?? 0,
      subLabel: stats ? `待录快递 ${stats.orderedWithoutTrackingCount} 单` : "",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      iconBg: "bg-blue-100",
    },
    {
      label: "运输中",
      icon: Truck,
      value: stats?.inTransitCount ?? 0,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      iconBg: "bg-purple-100",
    },
    {
      label: "今日已采购",
      icon: ClipboardCheck,
      value: stats?.todayPurchasedCount ?? 0,
      subLabel: stats ? `¥${stats.todayPurchasedAmount.toFixed(2)}` : "",
      color: "text-teal-600",
      bgColor: "bg-teal-50",
      iconBg: "bg-teal-100",
    },
  ];

  return (
    <div className={cn("grid grid-cols-4 gap-4", className)}>
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-lg", card.iconBg)}>
              <card.icon className={cn("w-5 h-5", card.color)} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className={cn("text-2xl font-bold", card.color)}>
                {loading ? "..." : card.value}
              </p>
              {card.subLabel && (
                <p className="text-xs text-gray-400 mt-0.5">{card.subLabel}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}