"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, Search, RefreshCw, ClipboardCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchPurchaseRecords, PurchaseRecord } from "@/lib/api/purchase";
import { ReceivedCard, ReceivedRecord } from "./received-card";

interface TabReceivedProps {
  onCardClick: (record: ReceivedRecord) => void;
  stats: { receivedCount: number } | null;
  onRefresh: () => void;
}

// 扩展 PurchaseRecord 为 ReceivedRecord
function convertToReceivedRecord(record: PurchaseRecord): ReceivedRecord {
  return {
    ...record,
    receivedAt: record.receivedAt || null,
  };
}

export type { ReceivedRecord };

export function TabReceived({ onCardClick, stats, onRefresh }: TabReceivedProps) {
  const [data, setData] = useState<ReceivedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [quickFilter, setQuickFilter] = useState<"all" | "thisWeek" | "thisMonth">("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error"; visible: boolean }>({
    message: "",
    type: "success",
    visible: false,
  });

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<ReceivedRecord[]> => {
    try {
      setLoading(true);
      const result = await fetchPurchaseRecords({ status: "received" });
      const records = result.map(convertToReceivedRecord);
      setData(records);
      return records;
    } catch (error) {
      console.error("Failed to load received records:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // 判断是否在本周
  const isThisWeek = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return date >= weekStart;
  };

  // 判断是否在本月
  const isThisMonth = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return date >= monthStart;
  };

  // 筛选后的数据
  const filteredData = data.filter((r) => {
    // 搜索筛选（供应商名模糊 + 快递单号包含）
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      const supplierMatch = r.supplierName && r.supplierName.toLowerCase().includes(kw);
      const trackingMatch = r.domesticTrackingNo && r.domesticTrackingNo.toLowerCase().includes(kw);
      if (!supplierMatch && !trackingMatch) {
        return false;
      }
    }

    // 快速筛选
    if (quickFilter === "thisWeek") {
      if (!isThisWeek(r.receivedAt)) return false;
    } else if (quickFilter === "thisMonth") {
      if (!isThisMonth(r.receivedAt)) return false;
    }

    return true;
  });

  // 刷新
  const handleRefresh = useCallback(async () => {
    await loadData();
    onRefresh();
  }, [onRefresh]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4 p-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
            <Skeleton className="h-4 w-1/2 mb-2" />
            <Skeleton className="h-12 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Toast */}
      {toast.visible && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border",
            toast.type === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          )}
        >
          {toast.message}
        </div>
      )}

      {/* 筛选栏 */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-4 flex-wrap">
        {/* 统计 */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ClipboardCheck className="w-4 h-4 text-teal-500" />
          <span>共 {data.length} 笔已到货</span>
        </div>

        {/* 搜索 */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="供应商名称 / 快递单号"
            className="pl-10 h-9"
          />
        </div>

        {/* 快速筛选 */}
        <select
          value={quickFilter}
          onChange={(e) => setQuickFilter(e.target.value as "all" | "thisWeek" | "thisMonth")}
          className="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white"
        >
          <option value="all">全部</option>
          <option value="thisWeek">本周</option>
          <option value="thisMonth">本月</option>
        </select>

        {/* 刷新按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="h-9"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* 数据列表 */}
      {filteredData.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardCheck className="w-12 h-12 text-teal-500 mx-auto mb-4" />
          <p className="text-sm text-gray-400">暂无已到货记录</p>
          <p className="text-xs text-gray-300 mt-2">新订单同步后会自动出现在这里</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4 p-4">
          {filteredData.map((record) => (
            <ReceivedCard
              key={record.id}
              record={record}
              onCardClick={() => onCardClick(record)}
              onToast={showToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";