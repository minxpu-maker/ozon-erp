"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, Search, RefreshCw, Filter } from "lucide-react";
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
import { fetchPurchaseRecords, PurchaseRecord } from "@/lib/api/purchase";
import { OrderedCard, OrderedRecord } from "./ordered-card";
import { cn } from "@/lib/utils";

interface TabOrderedProps {
  onCardClick: (record: OrderedRecord) => void;
  stats: { orderedCount: number; orderedWithoutTrackingCount: number } | null;
  onRefresh: () => void;
}

export function TabOrdered({ onCardClick, stats, onRefresh }: TabOrderedProps) {
  const [data, setData] = useState<OrderedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterType, setFilterType] = useState<"all" | "without-tracking">("all");
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<OrderedRecord[]> => {
    try {
      setLoading(true);
      const result = await fetchPurchaseRecords({ status: "ordered" });
      const records = result as OrderedRecord[];
      setData(records);
      
      // 首次加载时，默认展开最近采购且无快递单号的1张卡片
      if (isFirstLoad && records.length > 0) {
        // 按 orderedAt 降序排序，找最近采购的
        const sortedByTime = [...records].sort((a, b) => {
          const aTime = a.orderedAt ? new Date(a.orderedAt).getTime() : 0;
          const bTime = b.orderedAt ? new Date(b.orderedAt).getTime() : 0;
          return bTime - aTime;
        });
        // 找最近采购且无快递单号的
        const latestWithoutTracking = sortedByTime.find(
          (r) => !r.domesticTrackingNo || r.domesticTrackingNo.trim() === ""
        );
        if (latestWithoutTracking) {
          setExpandedId(latestWithoutTracking.id);
        }
        setIsFirstLoad(false);
      }
      
      return records;
    } catch (error) {
      console.error("Failed to load ordered records:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // 手风琴模式：同时只展开一张
  const handleExpandChange = useCallback((id: number, expanded: boolean) => {
    if (expanded) {
      setExpandedId(id);
    } else {
      setExpandedId(null);
    }
  }, []);

  // 绑定成功后：刷新 + 自动展开下一张
  const handleBindSuccess = useCallback(async (currentId: number) => {
    // 先刷新数据，获取新数组
    const newRecords = await loadData();
    onRefresh();
    
    // 用新数组找下一张没有快递单号的卡片
    const nextRecord = newRecords.find(
      (r) =>
        r.id !== currentId &&
        (!r.domesticTrackingNo || r.domesticTrackingNo.trim() === "")
    );
    if (nextRecord) {
      setExpandedId(nextRecord.id);
    } else {
      setExpandedId(null);
    }
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

  // 筛选后的数据（搜索支持供应商名和快递单号）
  const filteredData = data.filter((r) => {
    // 关键词搜索（供应商名模糊匹配 或 快递单号包含匹配）
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      const supplierMatch = r.supplierName && r.supplierName.toLowerCase().includes(kw);
      const trackingMatch = r.domesticTrackingNo && r.domesticTrackingNo.toLowerCase().includes(kw);
      // 任一命中即保留，或者两者都为null时不保留
      if (!supplierMatch && !trackingMatch) {
        return false;
      }
    }
    // 无快递单号筛选
    if (filterType === "without-tracking") {
      if (r.domesticTrackingNo && r.domesticTrackingNo.trim() !== "") {
        return false;
      }
    }
    return true;
  });

  // 按供应商+采购链接聚合（相同供应商 + 相同采购链接才合并）
  const aggregatedData = filteredData.reduce<Map<string, OrderedRecord[]>>(
    (acc, record) => {
      // 聚合key：供应商名 + 采购链接
      const supplierKey = record.supplierName || "未知供应商";
      const sourceKey = record.sourceUrl || "";
      const key = `${supplierKey}||${sourceKey}`;
      const existing = acc.get(key);
      if (existing) {
        existing.push(record);
      } else {
        acc.set(key, [record]);
      }
      return acc;
    },
    new Map()
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
        <Select
          value={filterType}
          onValueChange={(v) => setFilterType(v as "all" | "without-tracking")}
        >
          <SelectTrigger className="w-[180px] h-9">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部已下单</SelectItem>
            <SelectItem value="without-tracking">
              待录快递单号 ({stats?.orderedWithoutTrackingCount || 0})
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
          <p className="text-gray-500">暂无已下单记录</p>
          {filterType === "without-tracking" && (
            <p className="text-sm text-gray-400 mt-2">所有已下单记录都已录入快递单号</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4 p-4">
          {Array.from(aggregatedData.entries()).map(([compositeKey, records]) => {
            // 如果只有1条，不聚合
            if (records.length === 1) {
              const record = records[0];
              return (
                <OrderedCard
                  key={record.id}
                  record={record}
                  isExpanded={expandedId === record.id}
                  onExpandChange={(expanded) =>
                    handleExpandChange(record.id, expanded)
                  }
                  onCardClick={() => onCardClick(record)}
                  onBindSuccess={() => handleBindSuccess(record.id)}
                  onToast={handleToast}
                />
              );
            }

            // 多条聚合：显示第一条的信息，但聚合角标显示数量
            const firstRecord = records[0];

            return (
              <OrderedCard
                key={`aggregate-${compositeKey}`}
                record={firstRecord}
                records={records}
                isExpanded={expandedId === firstRecord.id}
                onExpandChange={(expanded) =>
                  handleExpandChange(firstRecord.id, expanded)
                }
                onCardClick={() => onCardClick(firstRecord)}
                onBindSuccess={() => handleBindSuccess(firstRecord.id)}
                onToast={handleToast}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}