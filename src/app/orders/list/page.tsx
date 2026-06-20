"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import useSWR from 'swr';
import OrderPipeline from "@/components/orders/OrderPipeline";
import { Toaster, toast } from "sonner";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then(async (r) => {
  if (!r.ok) throw new Error("请求失败");
  return r.json();
});

interface OrderRecord {
  id: string | number;
  ozonOrderId: string;
  ozonPostingNumber: string;
  shopId: string;
  status: string;
  erpStatus: string;
  buyerName: string | null;
  recipientName: string | null;
  recipientCity: string | null;
  totalPrice: number | string | null;
  orderAmount: number | string | null;
  shipmentDeadline: string | null;
  products?: Array<{
    name: string;
    sku: string;
    quantity: number;
    price: number | string;
    image?: string | null;
  }>;
  purchaseInfo?: {
    platform: string;
    unitPrice: number;
    quantity: number;
    totalAmount: number;
    url?: string;
    trackingNumber?: string;
    note?: string;
  } | null;
  createdAt: string;
}

interface OrdersResponse {
  success: boolean;
  orders: OrderRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface Shop {
  id: string;
  shopName: string;
}

export default function OrdersListPage() {
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // 获取订单数据
  const { data, error, isLoading, mutate } = useSWR<OrdersResponse>(
    "/api/orders?pageSize=100",
    fetcher,
    { revalidateOnFocus: false }
  );

  const orders = data?.orders ?? [];

  // 同步订单
  const handleSync = async () => {
    try {
      const res = await fetch("/api/sync/orders", { method: "POST" });
      if (res.ok) {
        // 重新获取订单列表
        await mutate();
        setLastSyncedAt(new Date());
        toast.success("同步成功");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "同步失败");
      }
    } catch (err) {
      console.error("同步失败:", err);
      toast.error("网络错误，同步失败");
    }
  };

  return (
    <AppLayout>
      <OrderPipeline
        orders={orders}
        onSync={handleSync}
        isLoading={isLoading}
        error={error ? "数据加载失败" : null}
        onRetry={() => mutate()}
        lastSyncedAt={lastSyncedAt}
      />
      <Toaster position="top-right" richColors />
    </AppLayout>
  );
}
