"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import useSWR from 'swr';
import OrderPipeline from "@/components/orders/OrderPipeline";
import { SyncToast } from "@/components/orders/SyncToast";
import { useState, useRef } from "react";

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

interface SyncToastData {
  status: 'syncing' | 'success' | 'error';
  newOrders: number;
  statusUpdates: number;
  shopCount: number;
  syncTime: string;
  errorMessage?: string;
}

export default function OrdersListPage() {
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncToast, setSyncToast] = useState<SyncToastData | null>(null);
  const prevOrderIdsRef = useRef<Map<string, string>>(new Map());

  // 获取订单数据
  const { data, error, isLoading, mutate } = useSWR<OrdersResponse>(
    "/api/orders?pageSize=100",
    fetcher,
    { revalidateOnFocus: false }
  );

  const orders = data?.orders ?? [];

  // 同步订单 - 完整的同步→通知→刷新流程
  const handleSync = async () => {
    // 新同步触发时，如果旧Toast还在显示，立即清除
    setSyncToast(null);
    
    // 记录当前订单ID+状态快照
    const currentOrders = data?.orders || [];
    const snapshot = new Map<string, string>();
    currentOrders.forEach(o => snapshot.set(o.ozonOrderId, o.ozonStatus));
    prevOrderIdsRef.current = snapshot;

    // 显示同步中态
    setSyncToast({
      status: 'syncing',
      newOrders: 0,
      statusUpdates: 0,
      shopCount: 0,
      syncTime: ''
    });

    try {
      const res = await fetch('/api/orders/sync', { method: 'POST' });
      const result = await res.json();

      if (result.success) {
        // 优先使用API返回的diff数据 (R13-A增强)
        const apiData = result.data || {};
        let newOrders = apiData.newOrders ?? 0;
        let statusUpdates = apiData.updatedOrders ?? 0;
        let shopCount = apiData.shopCount ?? 1;

        // 降级：如果API没返回diff数据，前端对比快照计算
        if (!result.data) {
          const refreshed = await fetch('/api/orders?pageSize=100').then(r => r.json());
          const newOrdersList = refreshed.orders || [];
          let nCount = 0, uCount = 0;
          newOrdersList.forEach((o: OrderRecord) => {
            if (!snapshot.has(o.ozonOrderId)) {
              nCount++;
            } else if (snapshot.get(o.ozonOrderId) !== o.ozonStatus) {
              uCount++;
            }
          });
          newOrders = nCount;
          statusUpdates = uCount;
        }

        const syncTime = new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit'
        });

        // 延迟100ms切状态，避免闪烁
        setTimeout(() => {
          setSyncToast({
            status: 'success',
            newOrders,
            statusUpdates,
            shopCount,
            syncTime
          });
        }, 100);

        // 刷新订单列表数据
        await mutate();
        setLastSyncedAt(new Date());
      } else {
        const syncTime = new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit'
        });
        setSyncToast({
          status: 'error',
          newOrders: 0,
          statusUpdates: 0,
          shopCount: 0,
          syncTime,
          errorMessage: result.data?.errorMessage || result.message || '同步失败，请重试'
        });
      }
    } catch (err) {
      console.error('同步失败:', err);
      const syncTime = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
      setSyncToast({
        status: 'error',
        newOrders: 0,
        statusUpdates: 0,
        shopCount: 0,
        syncTime,
        errorMessage: '网络连接失败，请重试'
      });
    }
  };

  return (
    <AppLayout>
      {/* SyncToast - 固定在页面顶部居中 */}
      {syncToast && (
        <SyncToast
          status={syncToast.status}
          newOrders={syncToast.newOrders}
          statusUpdates={syncToast.statusUpdates}
          shopCount={syncToast.shopCount}
          syncTime={syncToast.syncTime}
          errorMessage={syncToast.errorMessage}
          onRetry={handleSync}
          onClose={() => setSyncToast(null)}
        />
      )}
      
      <OrderPipeline
        orders={orders}
        onSync={handleSync}
        isLoading={isLoading}
        error={error ? "数据加载失败" : null}
        onRetry={() => mutate()}
        lastSyncedAt={lastSyncedAt}
      />
    </AppLayout>
  );
}
