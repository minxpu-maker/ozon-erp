/**
 * 订单管理 API 客户端
 * 前端调用订单相关接口
 */

import type { Order, OrderSyncResult, OzonPostingStatus } from '@/types/ozon';

// API响应类型
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 订单查询参数
interface OrderQueryParams {
  page?: number;
  limit?: number;
  status?: OzonPostingStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
  shopId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 同步参数
interface SyncParams {
  shopId?: string;
  since?: string;
  to?: string;
  status?: OzonPostingStatus;
  fullSync?: boolean;
}

// 发货参数
interface ShipParams {
  postingNumber: string;
  products: Array<{ productId: number; quantity: number }>;
  shopId?: string;
}

interface DeliverParams {
  postingNumber: string;
  trackingNumber: string;
  shopId?: string;
}

/**
 * 获取订单列表
 */
export async function getOrders(params: OrderQueryParams = {}): Promise<ApiResponse<Order[]>> {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  if (params.startDate) searchParams.set('startDate', params.startDate);
  if (params.endDate) searchParams.set('endDate', params.endDate);
  if (params.shopId) searchParams.set('shopId', params.shopId);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const response = await fetch(`/api/orders?${searchParams.toString()}`);
  return response.json();
}

/**
 * 同步订单
 */
export async function syncOrders(params: SyncParams = {}): Promise<ApiResponse<OrderSyncResult>> {
  const response = await fetch('/api/orders/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return response.json();
}

/**
 * 获取同步状态
 */
export async function getSyncStatus(): Promise<ApiResponse<{
  lastSyncAt: string | null;
  status: string;
  message: string;
}>> {
  const response = await fetch('/api/orders/sync');
  return response.json();
}

/**
 * 获取订单详情
 */
export async function getOrderById(
  orderId: string,
  shopId?: string
): Promise<ApiResponse<Order>> {
  const searchParams = shopId ? `?shopId=${shopId}` : '';
  const response = await fetch(`/api/orders/${orderId}${searchParams}`);
  return response.json();
}

/**
 * 订单打包
 */
export async function shipOrder(params: ShipParams): Promise<ApiResponse<{ packageNumber: string }>> {
  const response = await fetch('/api/orders/ship', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'ship', ...params }),
  });
  return response.json();
}

/**
 * 设置物流单号并发货
 */
export async function deliverOrder(params: DeliverParams): Promise<ApiResponse<null>> {
  const response = await fetch('/api/orders/ship', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'deliver', ...params }),
  });
  return response.json();
}

/**
 * 批量发货
 */
export async function batchDeliver(
  orders: Array<{ postingNumber: string; trackingNumber: string }>,
  shopId?: string
): Promise<ApiResponse<{
  results: Array<{ postingNumber: string; success: boolean; error?: string }>;
  successCount: number;
  failedCount: number;
}>> {
  const response = await fetch('/api/orders/ship', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'batchDeliver', orders, shopId }),
  });
  return response.json();
}

/**
 * 获取面单
 */
export async function getLabel(
  postingNumbers: string[],
  shopId?: string
): Promise<ApiResponse<{ file: string }>> {
  const response = await fetch('/api/orders/ship', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getLabel', postingNumbers, shopId }),
  });
  return response.json();
}

/**
 * 导出订单
 */
export async function exportOrders(params: OrderQueryParams & { format?: 'xlsx' | 'csv' }): Promise<Blob> {
  const searchParams = new URLSearchParams();
  
  if (params.status) searchParams.set('status', params.status);
  if (params.startDate) searchParams.set('startDate', params.startDate);
  if (params.endDate) searchParams.set('endDate', params.endDate);
  if (params.shopId) searchParams.set('shopId', params.shopId);
  searchParams.set('format', params.format || 'xlsx');

  const response = await fetch(`/api/orders/export?${searchParams.toString()}`);
  return response.blob();
}

/**
 * React Hook: 使用订单列表
 */
export function useOrders(params: OrderQueryParams = {}) {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pagination, setPagination] = React.useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);

  const fetchOrders = React.useCallback(async (newParams?: OrderQueryParams) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getOrders({ ...params, ...newParams });
      if (result.success && result.data) {
        setOrders(result.data);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        setError(result.error || 'Failed to fetch orders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [params]);

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    pagination,
    refetch: fetchOrders,
    setPage: (page: number) => fetchOrders({ page }),
  };
}

/**
 * React Hook: 使用订单同步
 */
export function useOrderSync() {
  const [syncing, setSyncing] = React.useState(false);
  const [lastSyncAt, setLastSyncAt] = React.useState<string | null>(null);

  const sync = React.useCallback(async (params: SyncParams = {}) => {
    setSyncing(true);
    
    try {
      const result = await syncOrders(params);
      if (result.success) {
        setLastSyncAt(new Date().toISOString());
      }
      return result;
    } finally {
      setSyncing(false);
    }
  }, []);

  const getStatus = React.useCallback(async () => {
    const result = await getSyncStatus();
    if (result.success && result.data) {
      setLastSyncAt(result.data.lastSyncAt);
    }
    return result;
  }, []);

  return {
    syncing,
    lastSyncAt,
    sync,
    getStatus,
  };
}

// 需要React导入
import React from 'react';
