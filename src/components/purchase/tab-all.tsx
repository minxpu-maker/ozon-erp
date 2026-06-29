"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPurchaseRecords } from "@/lib/api/purchase";

interface PurchaseRecord {
  id: number;
  demandId: number;
  shopId: string;
  supplierName: string | null;
  supplierSource: string | null;
  purchasePrice: string | null;
  purchaseQty: number | null;
  status: string;
  orderedAt: string | null;
}

export function TabAll() {
  const [data, setData] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchPurchaseRecords({});
      setData(result);
    } catch (error) {
      console.error("Failed to load all records:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
            <Skeleton className="h-4 w-1/2 mb-2" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="text-center text-gray-500 py-8">
        <p className="text-lg font-medium">全部 Tab</p>
        <p className="text-sm mt-2">开发中 - 后续指令完善</p>
        <p className="text-xs mt-4 text-gray-400">
          已加载 {data.length} 条采购记录
        </p>
      </div>
    </div>
  );
}