"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, Search, RefreshCw, Filter, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { fetchPurchaseRecords } from "@/lib/api/purchase";
import { InTransitCard, InTransitRecord } from "./in-transit-card";
import { cn } from "@/lib/utils";

interface TabInTransitProps {
  onCardClick: (record: InTransitRecord) => void;
  stats: { inTransitCount: number } | null;
  onRefresh: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function TabInTransit({ onCardClick, stats, onRefresh, searchInputRef }: TabInTransitProps) {
  const [data, setData] = useState<InTransitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterType, setFilterType] = useState<"all" | "warning">("all");
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<InTransitRecord[]> => {
    try {
      setLoading(true);
      const result = await fetchPurchaseRecords({ status: "shipped" });
      const records = result as InTransitRecord[];
      setData(records);
      return records;
    } catch (error) {
      console.error("Failed to load in-transit records:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // 计算运输天数
  const calcTransitDays = useCallback((orderedAt: string | null): number => {
    if (!orderedAt) return 0;
    const orderedDate = new Date(orderedAt);
    const today = new Date();
    const diffTime = today.getTime() - orderedDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }, []);

  // 筛选后的数据（搜索支持供应商名和快递单号）
  const filteredData = data.filter((r) => {
    // 关键词搜索（供应商名模糊匹配 或 快递单号包含匹配）
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      const supplierMatch = r.supplierName && r.supplierName.toLowerCase().includes(kw);
      const trackingMatch = r.domesticTrackingNo && r.domesticTrackingNo.toLowerCase().includes(kw);
      if (!supplierMatch && !trackingMatch) {
        return false;
      }
    }
    // 超时预警筛选（>3天）
    if (filterType === "warning") {
      const days = calcTransitDays(r.orderedAt);
      if (days <= 3) {
        return false;
      }
    }
    return true;
  });

  // 统计
  const warningCount = data.filter((r) => calcTransitDays(r.orderedAt) > 3).length;

  // 确认到货成功回调
  const handleConfirmSuccess = useCallback(async () => {
    await loadData();
    onRefresh();
  }, [onRefresh]);

  // Toast 显示
  const handleToast = useCallback(
    (msg: string, type: "success" | "error") => {
      setToastMessage({ text: msg, type });
      setTimeout(() => {
        setToastMessage(null);
      }, 5000);
    },
    []
  );

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
      {/* Toast 通知 */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-100 px-4 py-3 flex items-center gap-3">
          <span
            className={cn(
              "text-sm",
              toastMessage.type === "success" ? "text-green-600" : "text-red-600"
            )}
          >
            {toastMessage.text}
          </span>
        </div>
      )}

      {/* 筛选栏 */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-4">
        {/* 统计Badge */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>共 {data.length} 笔运输中</span>
          {warningCount > 0 && (
            <Badge
              variant="secondary"
              className="bg-amber-100 text-amber-700 border-amber-200 px-2 py-0.5 text-xs"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              {warningCount}笔超时
            </Badge>
          )}
        </div>

        {/* 搜索 */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            ref={searchInputRef}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="供应商名称 / 快递单号"
            className="pl-10 h-9"
          />
        </div>

        {/* 快速筛选 */}
        <Select
          value={filterType}
          onValueChange={(v) => setFilterType(v as "all" | "warning")}
        >
          <SelectTrigger className="w-[140px] h-9">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部运输中</SelectItem>
            <SelectItem value="warning">
              超时预警 ({warningCount})
            </SelectItem>
          </SelectContent>
        </Select>

        {/* 刷新按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadData();
            onRefresh();
          }}
          className="h-9"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* 数据列表 */}
      {filteredData.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">暂无运输中记录</p>
          {filterType === "warning" && (
            <p className="text-sm text-gray-400 mt-2">无超时预警记录</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4 p-4">
          {filteredData.map((record) => (
            <InTransitCard
              key={record.id}
              record={record}
              onConfirmSuccess={handleConfirmSuccess}
              onCardClick={() => onCardClick(record)}
              onToast={handleToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}