/**
 * 订单管理 Hook
 * 封装订单操作逻辑
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { OzonPostingStatus } from '@/types/ozon';
import type { Order } from '@/types/ozon';
import * as ordersApi from '@/lib/api/orders';

interface UseOrderListOptions {
  initialPage?: number;
  initialLimit?: number;
  initialStatus?: OzonPostingStatus;
  autoFetch?: boolean;
}

interface UseOrderListReturn {
  orders: Order[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  selectedOrders: number[];
  filters: {
    status?: OzonPostingStatus;
    search?: string;
    startDate?: string;
    endDate?: string;
  };
  // 操作方法
  fetchOrders: () => Promise<void>;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setStatus: (status?: OzonPostingStatus) => void;
  setSearch: (search?: string) => void;
  setDateRange: (startDate?: string, endDate?: string) => void;
  selectOrder: (orderId: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  refresh: () => Promise<void>;
}

/**
 * 订单列表 Hook
 */
export function useOrderList(options: UseOrderListOptions = {}): UseOrderListReturn {
  const {
    initialPage = 1,
    initialLimit = 20,
    initialStatus,
    autoFetch = true,
  } = options;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [filters, setFilters] = useState<{
    status?: OzonPostingStatus;
    search?: string;
    startDate?: string;
    endDate?: string;
  }>({ status: initialStatus });
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await ordersApi.getOrders({
        page,
        limit,
        ...filters,
      });
      
      if (result.success && result.data) {
        setOrders(result.data);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        setError(result.error || '获取订单失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => {
    if (autoFetch) {
      fetchOrders();
    }
  }, [fetchOrders, autoFetch]);

  const handleSetPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleSetLimit = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  const setStatus = useCallback((status?: OzonPostingStatus) => {
    setFilters((prev) => ({ ...prev, status }));
    setPage(1);
  }, []);

  const setSearch = useCallback((search?: string) => {
    setFilters((prev) => ({ ...prev, search }));
    setPage(1);
  }, []);

  const setDateRange = useCallback((startDate?: string, endDate?: string) => {
    setFilters((prev) => ({ ...prev, startDate, endDate }));
    setPage(1);
  }, []);

  const selectOrder = useCallback((orderId: number) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedOrders(orders.map((o) => o.orderId));
  }, [orders]);

  const deselectAll = useCallback(() => {
    setSelectedOrders([]);
  }, []);

  return {
    orders,
    loading,
    error,
    pagination,
    selectedOrders,
    filters,
    fetchOrders,
    setPage: handleSetPage,
    setLimit: handleSetLimit,
    setStatus,
    setSearch,
    setDateRange,
    selectOrder,
    selectAll,
    deselectAll,
    refresh: fetchOrders,
  };
}

/**
 * 订单同步 Hook
 */
export function useOrderSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    total: number;
    new: number;
    updated: number;
    failed: number;
  } | null>(null);

  const sync = useCallback(async (params: {
    shopId?: string;
    fullSync?: boolean;
    status?: OzonPostingStatus;
  } = {}) => {
    setSyncing(true);
    setSyncResult(null);
    
    try {
      const result = await ordersApi.syncOrders({
        ...params,
        status: params.status || OzonPostingStatus.AWAITING_PACKAGING,
      });
      
      if (result.success && result.data) {
        setSyncResult(result.data);
        setLastSyncAt(new Date().toISOString());
      }
      
      return result;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : '同步失败',
      };
    } finally {
      setSyncing(false);
    }
  }, []);

  const getStatus = useCallback(async () => {
    const result = await ordersApi.getSyncStatus();
    if (result.success && result.data) {
      setLastSyncAt(result.data.lastSyncAt);
    }
    return result;
  }, []);

  return {
    syncing,
    lastSyncAt,
    syncResult,
    sync,
    getStatus,
  };
}

/**
 * 订单详情 Hook
 */
export function useOrderDetail(orderId: string | null) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setOrder(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await ordersApi.getOrderById(orderId);
      if (result.success && result.data) {
        setOrder(result.data);
      } else {
        setError(result.error || '获取订单详情失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  return {
    order,
    loading,
    error,
    refresh: fetchOrder,
  };
}

/**
 * 订单发货 Hook
 */
export function useOrderShip() {
  const [shipping, setShipping] = useState(false);

  const ship = useCallback(async (params: {
    postingNumber: string;
    products: Array<{ productId: number; quantity: number }>;
    shopId?: string;
  }) => {
    setShipping(true);
    try {
      return await ordersApi.shipOrder(params);
    } finally {
      setShipping(false);
    }
  }, []);

  const deliver = useCallback(async (params: {
    postingNumber: string;
    trackingNumber: string;
    shopId?: string;
  }) => {
    setShipping(true);
    try {
      return await ordersApi.deliverOrder(params);
    } finally {
      setShipping(false);
    }
  }, []);

  const batchDeliver = useCallback(async (
    orders: Array<{ postingNumber: string; trackingNumber: string }>,
    shopId?: string
  ) => {
    setShipping(true);
    try {
      return await ordersApi.batchDeliver(orders, shopId);
    } finally {
      setShipping(false);
    }
  }, []);

  const getLabel = useCallback(async (postingNumbers: string[], shopId?: string) => {
    return await ordersApi.getLabel(postingNumbers, shopId);
  }, []);

  return {
    shipping,
    ship,
    deliver,
    batchDeliver,
    getLabel,
  };
}
