"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, Search, RefreshCw, PackageCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchPurchaseRecords, PurchaseRecord } from "@/lib/api/purchase";
import { cn, formatCNY } from "@/lib/utils";
import { getCarrierColor } from "@/lib/utils/express-carrier";

interface ReceivedRecord extends PurchaseRecord {
  receivedAt: string | null;
}

interface TabReceivedProps {
  onCardClick: (record: ReceivedRecord) => void;
  stats: { receivedCount: number } | null;
  onRefresh: () => void;
}

export function TabReceived({ onCardClick, stats, onRefresh }: TabReceivedProps) {
  const [data, setData] = useState<ReceivedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<ReceivedRecord[]> => {
    try {
      setLoading(true);
      const result = await fetchPurchaseRecords({ status: "received" });
      const records = result as ReceivedRecord[];
      setData(records);
      return records;
    } catch (error) {
      console.error("Failed to load received records:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // 格式化到货时间
  const formatReceivedTime = useCallback((dateStr: string | null): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hour}:${minute}`;
  }, []);

  // 筛选后的数据（搜索支持供应商名和快递单号）
  const filteredData = data.filter((r) => {
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

  // 确认到货成功回调（从运输中转入）
  const handleConfirmSuccess = useCallback(async () => {
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
      {/* 筛选栏 */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-4">
        {/* 统计 */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <PackageCheck className="w-4 h-4 text-green-500" />
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
          <PackageCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">暂无已到货记录</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4 p-4">
          {filteredData.map((record) => (
            <div
              key={record.id}
              className={cn(
                "relative rounded-xl bg-white border border-gray-100 shadow-sm transition-all duration-200",
                "hover:shadow-md hover:border-gray-200 cursor-pointer"
              )}
              onClick={() => onCardClick(record)}
            >
              {/* 左侧绿色色条 */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-l-xl" />

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
                    {/* 供应商 + 采购价 */}
                    <div className="flex items-center gap-2 mb-1">
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

                    {/* 到货时间 */}
                    <div className="text-xs text-gray-400 mb-1">
                      到货: {formatReceivedTime(record.receivedAt)}
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
          ))}
        </div>
      )}
    </div>
  );
}