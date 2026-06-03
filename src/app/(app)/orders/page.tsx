'use client';

import { useState } from 'react';
import { useOrderList, useOrderSync } from '@/hooks/use-orders';
import { OzonPostingStatus, Order } from '@/types/ozon';
import { ORDER_STATUS_CONFIG } from '@/lib/constants/order-status';
import { ordersApi } from '@/lib/api/orders';

export default function OrdersPage() {
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<OzonPostingStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 使用订单列表 Hook
  const {
    orders,
    loading,
    error,
    pagination,
    fetchOrders,
    setPage,
    setStatus,
  } = useOrderList();

  // 使用订单同步 Hook
  const {
    syncing,
    lastSyncAt,
    sync,
    getStatus,
  } = useOrderSync();

  // 获取状态徽标
  const getStatusBadge = (status: OzonPostingStatus) => {
    const config = ORDER_STATUS_CONFIG[status];
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: config.bgColor, color: config.color }}
      >
        {config.label}
      </span>
    );
  };

  // 处理同步
  const handleSync = async () => {
    await sync();
    if (statusFilter !== 'all') {
      setStatus(statusFilter);
    }
    await fetchOrders();
  };

  // 处理批量发货
  const handleBatchShip = async () => {
    if (selectedOrders.length === 0) return;
    try {
      await ordersApi.batchShip({ orderIds: selectedOrders });
      setSelectedOrders([]);
      await fetchOrders();
    } catch (err) {
      console.error('批量发货失败:', err);
    }
  };

  // 处理导出
  const handleExport = async () => {
    if (selectedOrders.length === 0) return;
    try {
      const result = await ordersApi.exportOrders({ orderIds: selectedOrders });
      if (result.success && result.data?.downloadUrl) {
        window.open(result.data.downloadUrl, '_blank');
      }
    } catch (err) {
      console.error('导出失败:', err);
    }
  };

  // 过滤订单
  const filteredOrders = orders.filter((order: Order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesSearch = !searchQuery || 
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.postingNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // 选择订单
  const toggleSelect = (orderId: number) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.orderId));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">订单管理</h1>
          <p className="text-muted-foreground mt-1">管理 Ozon 订单，支持订单同步、状态筛选、批量操作</p>
        </div>

        {/* 同步状态和操作 */}
        <div className="mb-6 bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">最近同步：</span>
                <span className="text-foreground font-medium">
                  {lastSyncAt ? new Date(lastSyncAt).toLocaleString('zh-CN') : '暂无'}
                </span>
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  同步中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.356-2A8.001 8.001 0 0015.356 9m0 0H9" />
                  </svg>
                  同步订单
                </>
              )}
            </button>
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="搜索订单号..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OzonPostingStatus | 'all')}
            className="px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">全部状态</option>
            {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        {/* 批量操作 */}
        {selectedOrders.length > 0 && (
          <div className="mb-4 bg-muted/50 border border-border rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              已选择 {selectedOrders.length} 个订单
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchShip}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
              >
                批量发货
              </button>
              <button
                onClick={handleExport}
                className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-sm hover:bg-secondary/80"
              >
                导出
              </button>
              <button
                onClick={() => setSelectedOrders([])}
                className="px-3 py-1.5 text-muted-foreground hover:text-foreground text-sm"
              >
                取消选择
              </button>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
            {error}
          </div>
        )}

        {/* 订单列表 */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <svg className="animate-spin mx-auto h-8 w-8 text-primary mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              加载中...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              暂无订单数据
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">订单号</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">商品</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">买家</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">金额</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">下单时间</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map((order: Order) => (
                  <tr key={order.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.orderId)}
                        onChange={() => toggleSelect(order.orderId)}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-foreground">{order.orderNumber}</div>
                      <div className="text-xs text-muted-foreground">{order.postingNumber}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground">
                        {order.products.length} 件商品
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {order.products.map(p => p.name).join(', ')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground">{order.customerName || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-foreground">
                        {order.currency} {order.totalAmount.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString('zh-CN')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          // TODO: 打开订单详情
                          console.log('查看订单详情:', order.orderId);
                        }}
                        className="text-primary hover:text-primary/80 text-sm font-medium"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 分页 */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              共 {pagination.total} 条记录
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 border border-border rounded-md text-sm disabled:opacity-50"
              >
                上一页
              </button>
              <span className="text-sm text-muted-foreground">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 border border-border rounded-md text-sm disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
