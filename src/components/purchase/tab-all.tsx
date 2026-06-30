"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, Search, RefreshCw, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchPurchaseRecords, PurchaseRecord } from "@/lib/api/purchase";
import { cn, formatCNY } from "@/lib/utils";
import { getCarrierColor } from "@/lib/utils/express-carrier";

interface AllRecord extends PurchaseRecord {
  orderedAt: string | null;
  receivedAt: string | null;
}

interface TabAllProps {
  onCardClick: (record: AllRecord) => void;
  stats: { orderedCount: number; inTransitCount: number; receivedCount: number } | null;
  onRefresh: () => void;
}

export function TabAll({ onCardClick, stats, onRefresh }: TabAllProps) {
  const [data, setData] = useState<AllRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ordered" | "shipped" | "received">("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<AllRecord[]> => {
    try {
      setLoading(true);
      const result = await fetchPurchaseRecords({});
      const records = result as AllRecord[];
      setData(records);
      return records;
    } catch (error) {
      console.error("Failed to load all records:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // 状态色条和Badge映射
  const getStatusColor = useCallback((status: string): { bar: string; badge: string; badgeBg: string; badgeText: string } => {
    switch (status) {
      case "ordered":
        return { bar: "bg-blue-500", badge: "已下单", badgeBg: "bg-blue-100", badgeText: "text-blue-600" };
      case "shipped":
        return { bar: "bg-purple-500", badge: "运输中", badgeBg: "bg-purple-100", badgeText: "text-purple-600" };
      case "received":
        return { bar: "bg-green-500", badge: "已到货", badgeBg: "bg-green-100", badgeText: "text-green-600" };
      default:
        return { bar: "bg-gray-300", badge: "其他", badgeBg: "bg-gray-100", badgeText: "text-gray-600" };
    }
  }, []);

  // 格式化时间
  const formatTime = useCallback((dateStr: string | null): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hour}:${minute}`;
  }, []);

  // 筛选后的数据
  const filteredData = data.filter((r) => {
    // 状态筛选
    if (statusFilter !== "all" && r.status !== statusFilter) {
      return false;
    }
    // 搜索筛选（供应商名 + 快递单号）
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      const supplierMatch = r.supplierName && r.supplierName.toLowerCase().includes(kw);
      const trackingMatch = r.domesticTrackingNo && r.domesticTrackingNo.toLowerCase().includes(kw);
      if (!supplierMatch && !trackingMatch) {
        return false;
      }
    }
    return true;
  });

  // 计算各状态数量
  const orderedCount = data.filter(r => r.status === "ordered").length;
  const shippedCount = data.filter(r => r.status === "shipped").length;
  const receivedCount = data.filter(r => r.status === "received").length;

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
      {/* 筛选栏 */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-4">
        {/* 统计 */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Layers className="w-4 h-4 text-gray-400" />
          <span>共 {data.length} 笔记录</span>
        </div>

        {/* 状态筛选下拉 */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "ordered" | "shipped" | "received")}
          className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">全部状态</option>
          <option value="ordered">已下单 ({orderedCount})</option>
          <option value="shipped">运输中 ({shippedCount})</option>
          <option value="received">已到货 ({receivedCount})</option>
        </select>

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
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">暂无采购记录</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4 p-4">
          {filteredData.map((record) => {
            const statusInfo = getStatusColor(record.status);
            return (
              <div
                key={record.id}
                className={cn(
                  "relative rounded-xl bg-white border border-gray-100 shadow-sm transition-all duration-200",
                  "hover:shadow-md hover:border-gray-200 cursor-pointer"
                )}
                onClick={() => onCardClick(record)}
              >
                {/* 左侧状态色条 */}
                <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", statusInfo.bar)} />

                {/* 卡片内容区 */}
                <div className="pl-4 pr-4 pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    {/* 主图 */}
                    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      {record.demandProductImage ? (
                        <img
                          src={record.demandProductImage}
                          alt={record.demandProductName || "商品"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-gray-300 m-auto" />
                      )}
                    </div>

                    {/* 信息区 */}
                    <div className="flex-1 min-w-0">
                      {/* 状态Badge + 供应商 + 采购价 */}
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn(statusInfo.badgeBg, statusInfo.badgeText, "text-xs px-1.5")}>
                          {statusInfo.badge}
                        </Badge>
                        {record.supplierName && (
                          <span className="text-xs text-gray-500 truncate">{record.supplierName}</span>
                        )}
                        {record.purchasePrice && (
                          <span className="text-sm font-medium text-gray-900">
                            {formatCNY(record.purchasePrice)}
                          </span>
                        )}
                      </div>

                      {/* 快递信息行 */}
                      {record.domesticTrackingNo && (
                        <div className="flex items-center gap-1.5 mb-1">
                          {record.domesticCarrier && (
                            <span
                              className={cn(
                                "text-xs px-1.5 py-0.5 rounded",
                                getCarrierColor(record.domesticCarrier)
                              )}
                            >
                              {record.domesticCarrier}
                            </span>
                          )}
                          <span className="text-xs font-mono text-gray-600">
                            {record.domesticTrackingNo}
                          </span>
                        </div>
                      )}

                      {/* 时间（根据状态显示不同字段） */}
                      <div className="text-xs text-gray-400 mb-1">
                        {record.status === "ordered" && formatTime(record.orderedAt) && (
                          <>下单: {formatTime(record.orderedAt)}</>
                        )}
                        {record.status === "shipped" && formatTime(record.orderedAt) && (
                          <>发货: {formatTime(record.orderedAt)}</>
                        )}
                        {record.status === "received" && formatTime(record.receivedAt) && (
                          <>到货: {formatTime(record.receivedAt)}</>
                        )}
                      </div>

                      {/* 关联Ozon订单号 */}
                      {record.ozonPostingNumbers && record.ozonPostingNumbers.length > 0 && (
                        <div className="text-xs text-gray-400">
                          Ozon: {record.ozonPostingNumbers.join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}