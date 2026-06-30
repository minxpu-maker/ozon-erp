"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, Search, RefreshCw, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchPurchaseRecords, PurchaseRecord } from "@/lib/api/purchase";
import { AllCard, AllRecord } from "./all-card";

interface TabAllProps {
  onCardClick: (record: AllRecord) => void;
  onCardAction: (record: AllRecord, action: "bindTracking" | "confirmReceived" | "gotoQc") => void;
  stats: { orderedCount: number; inTransitCount: number; receivedCount: number } | null;
  onRefresh: () => void;
}

// 转换为 AllRecord
function convertToAllRecord(record: PurchaseRecord): AllRecord {
  return { ...record };
}

export type { AllRecord };

export function TabAll({ onCardClick, onCardAction, stats, onRefresh }: TabAllProps) {
  const [data, setData] = useState<AllRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ordered" | "shipped" | "received">("all");
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

  const loadData = async (): Promise<AllRecord[]> => {
    try {
      setLoading(true);
      const result = await fetchPurchaseRecords({});
      const records = result.map(convertToAllRecord);
      // 按 updatedAt 倒序（最近操作的最靠前）
      records.sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });
      setData(records);
      return records;
    } catch (error) {
      console.error("Failed to load all records:", error);
      return [];
    } finally {
      setLoading(false);
    }
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

    // 状态筛选
    if (statusFilter !== "all") {
      if (r.status !== statusFilter) return false;
    }

    return true;
  });

  // 刷新
  const handleRefresh = useCallback(async () => {
    await loadData();
    onRefresh();
  }, [onRefresh]);

  // 处理卡片动作
  const handleCardAction = useCallback((record: AllRecord, action: "bindTracking" | "confirmReceived" | "gotoQc") => {
    if (action === "gotoQc") {
      showToast("入库验货模块开发中，敬请期待", "success");
    }
    onCardAction(record, action);
  }, [showToast, onCardAction]);

  // 计算总数
  const totalCount = (stats?.orderedCount ?? 0) + (stats?.inTransitCount ?? 0) + (stats?.receivedCount ?? 0);

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
          <Layers className="w-4 h-4 text-gray-400" />
          <span>共 {totalCount} 笔采购记录</span>
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

        {/* 状态筛选 */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "ordered" | "shipped" | "received")}
          className="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white"
        >
          <option value="all">全部状态 ({totalCount})</option>
          <option value="ordered">已下单 ({stats?.orderedCount ?? 0})</option>
          <option value="shipped">运输中 ({stats?.inTransitCount ?? 0})</option>
          <option value="received">已到货 ({stats?.receivedCount ?? 0})</option>
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
          <Layers className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-400">暂无采购记录</p>
          <p className="text-xs text-gray-300 mt-2">新订单同步后会自动出现在这里</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4 p-4">
          {filteredData.map((record) => (
            <AllCard
              key={record.id}
              record={record}
              onCardClick={() => onCardClick(record)}
              onBindTracking={(r) => handleCardAction(r, "bindTracking")}
              onConfirmReceived={(r) => handleCardAction(r, "confirmReceived")}
              onGotoQc={(r) => handleCardAction(r, "gotoQc")}
              onToast={showToast}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";