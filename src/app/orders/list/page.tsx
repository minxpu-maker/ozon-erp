"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import useSWR from 'swr';
import OrderPipeline from "@/components/orders/OrderPipeline";

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
  // 获取订单数据
  const { data, error, isLoading } = useSWR<OrdersResponse>(
    "/api/orders?pageSize=100",
    fetcher,
    { revalidateOnFocus: false }
  );

  const orders = data?.orders ?? [];

  return (
    <AppLayout title="订单列表" subtitle="管理来自 Ozon 的 FBS 订单">
      <OrderPipeline orders={orders} />
    </AppLayout>
  );
}
