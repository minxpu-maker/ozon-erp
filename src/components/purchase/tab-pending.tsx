"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPurchaseDemands } from "@/lib/api/purchase";

interface PurchaseDemand {
  id: number;
  orderId: string;
  sku: string;
  productName: string | null;
  quantity: number;
  status: string;
}

export function TabPending() {
  const [data, setData] = useState<PurchaseDemand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchPurchaseDemands();
      setData(result);
    } catch (error) {
      console.error("Failed to load purchase demands:", error);
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
        <p className="text-lg font-medium">待采购 Tab</p>
        <p className="text-sm mt-2">开发中 - 后续指令完善</p>
        <p className="text-xs mt-4 text-gray-400">
          已加载 {data.length} 条需求记录
        </p>
      </div>
    </div>
  );
}