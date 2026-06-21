"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import useSWR from 'swr';
import OrderPipeline from "@/components/orders/OrderPipeline";
import { toast } from "@/hooks/useToast";
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
      const result = await res.json();
      
      // 显示同步详情
      const { newOrders = 0, updatedOrders = 0, newDemands = 0, syncedShops = 0, failedShops = 0, errors = [] } = result;
      
      if (syncedShops > 0 || failedShops > 0) {
        // 有同步记录，显示详情
        let detail = `同步完成 | ${syncedShops}个店铺成功`;
        if (failedShops > 0) {
          detail += ` | ${failedShops}个店铺失败`;
        }
        if (newOrders > 0) {
          detail += ` | 新增 ${newOrders} 单`;
        }
        if (updatedOrders > 0) {
          detail += ` | 更新 ${updatedOrders} 单`;
        }
        if (newDemands > 0) {
          detail += ` | 新需求 ${newDemands}`;
        }
        if (failedShops > 0) {
          toast.warning(detail);
        } else {
          toast.success(detail);
        }
      } else {
        // 没有同步记录
        toast.info("暂无需要同步的店铺或凭证未配置");
      }
      
      // 重新获取订单列表
      await mutate();
      setLastSyncedAt(new Date());
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
      <Toast position="top-center" />
    </AppLayout>
  );
}
