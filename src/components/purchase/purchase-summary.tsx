"use client";

import { ShoppingCart, Package, Truck, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface PurchaseStats {
  pendingPurchaseCount: number;
  orderedCount: number;
  orderedWithoutTrackingCount: number;
  inTransitCount: number;
  receivedCount: number;
  todayPurchasedCount: number;
  todayPurchasedAmount: number;
}

interface PurchaseSummaryProps {
  stats: PurchaseStats | null;
  loading?: boolean;
  className?: string;
}

export function PurchaseSummary({ stats, loading = false, className }: PurchaseSummaryProps) {
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
      {cards.map((card) => {
        const Icon = card.icon;
        
        if (loading) {
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
            </div>
          );
        }
        
        return (
          <div
            key={card.label}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className={cn("p-2.5 rounded-lg", card.iconBg)}>
                <Icon className={cn("w-5 h-5", card.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                <p className={cn("text-xl font-bold", card.color)}>
                  {card.value}
                </p>
                {card.subLabel && (
                  <p className="text-xs text-gray-400 mt-0.5">{card.subLabel}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}