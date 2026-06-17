'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { AppLayout } from '@/components/layout/AppLayout';

import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

// 状态标签映射
const statusLabels: Record<string, string> = {
  pending: '待采购',
  purchased: '已采购',
  in_transit: '运输中',
  verified: '验货通过',
  packed: '已打包',
  shipped: '已发货',
  delivered: '已完成',
  cancelled: '已取消',
};

// 状态颜色
const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-red-100', text: 'text-red-700' },
  purchased: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  in_transit: { bg: 'bg-blue-100', text: 'text-blue-700' },
  verified: { bg: 'bg-green-100', text: 'text-green-700' },
  packed: { bg: 'bg-purple-100', text: 'text-purple-700' },
  shipped: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  delivered: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

interface Order {
  id: number;
  ozonPostingNumber: string;
  productName: string;
  sku: string;
  productImage?: string;
  quantity: number;
  orderAmount: number;
  erpStatus: string;
  shipmentDeadline?: string;
  createdAt: string;
}

interface Shop {
  id: number;
  shopName: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function OrdersListPageInner() {
  const [shopId, setShopId] = useState('all');
  const [status, setStatus] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000); // 每分钟更新一次
    return () => clearInterval(interval);
  }, []);

  // 构建查询参数
  const params = new URLSearchParams();
  if (shopId !== 'all') params.set('shopId', shopId);
  if (status !== 'all') params.set('status', status);
  if (dateRange.start) params.set('startDate', dateRange.start);
  if (dateRange.end) params.set('endDate', dateRange.end);
  if (search) params.set('search', search);
  params.set('page', page.toString());
  params.set('pageSize', '20');

  const { data: ordersData, isLoading } = useSWR(
    mounted ? `/api/orders?${params.toString()}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: shopsData } = useSWR(
    mounted ? '/api/shops' : null,
    fetcher
  );

  const orders: Order[] = ordersData?.data || [];
  const total = ordersData?.total || 0;
  const totalPages = Math.ceil(total / 20);

  // 统计数据
  const stats = {
    new: orders.filter((o) => o.erpStatus === 'pending').length,
    pending: orders.filter((o) => ['pending', 'purchased'].includes(o.erpStatus)).length,
    shipping: orders.filter((o) => ['verified', 'packed'].includes(o.erpStatus)).length,
    overdue: orders.filter((o) => {
      if (!o.shipmentDeadline) return false;
      return new Date(o.shipmentDeadline).getTime() < now;
    }).length,
  };

  const shops: Shop[] = shopsData?.data || [];

  return (
    <div className="min-h-screen bg-[#F6F8FB] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-semibold text-[#152033]">订单列表</h1>
          <p className="text-sm text-[#637089] mt-1">管理来自 Ozon 的 FBS 订单</p>
        </div>

        {/* 筛选栏 */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-[#E6EAF2]">
          <div className="flex flex-wrap items-center gap-4">
            {/* 店铺筛选 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#637089]">店铺:</label>
              <select
                value={shopId}
                onChange={(e) => {
                  setShopId(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-[#E6EAF2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20 focus:border-[#2F6BFF]"
              >
                <option value="all">全部门店</option>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.shopName}
                  </option>
                ))}
              </select>
            </div>

            {/* 状态筛选 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#637089]">状态:</label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-[#E6EAF2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20 focus:border-[#2F6BFF]"
              >
                <option value="all">全部状态</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* 日期范围 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#637089]">日期:</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => {
                  setDateRange((prev) => ({ ...prev, start: e.target.value }));
                  setPage(1);
                }}
                className="px-3 py-2 border border-[#E6EAF2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20 focus:border-[#2F6BFF]"
              />
              <span className="text-[#637089]">~</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => {
                  setDateRange((prev) => ({ ...prev, end: e.target.value }));
                  setPage(1);
                }}
                className="px-3 py-2 border border-[#E6EAF2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20 focus:border-[#2F6BFF]"
              />
            </div>

            {/* 搜索框 */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#637089]" />
                <input
                  type="text"
                  placeholder="搜索订单号/商品名称..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-[#E6EAF2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20 focus:border-[#2F6BFF]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-[#E6EAF2]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[#637089]">新订单</p>
                <p className="text-xl font-semibold text-[#152033]">{stats.new}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-[#E6EAF2]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-[#637089]">待采购</p>
                <p className="text-xl font-semibold text-[#152033]">{stats.pending}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-[#E6EAF2]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-[#637089]">待发货</p>
                <p className="text-xl font-semibold text-[#152033]">{stats.shipping}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-[#E6EAF2]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-[#637089]">超时预警</p>
                <p className="text-xl font-semibold text-red-600">{stats.overdue}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 订单表格 */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E6EAF2] overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#2F6BFF] animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#637089]">
              <Package className="w-12 h-12 mb-4 text-gray-300" />
              <p className="text-sm">暂无订单数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#E6EAF2]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">
                      订单号
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">
                      商品信息
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#637089] uppercase tracking-wider">
                      数量
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#637089] uppercase tracking-wider">
                      Ozon售价
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#637089] uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#637089] uppercase tracking-wider">
                      发货截止
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#637089] uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EAF2]">
                  {orders.map((order) => {
                    const hours = order.shipmentDeadline
                      ? (new Date(order.shipmentDeadline).getTime() - now) / 3600000
                      : null;
                    const isOverdue = hours !== null && hours < 0;
                    const isUrgent = hours !== null && hours > 0 && hours < 12;
                    const colorConfig = statusColors[order.erpStatus] || statusColors.pending;

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-mono text-[#152033]">
                          {order.ozonPostingNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {order.productImage && (
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                <img
                                  src={order.productImage}
                                  alt={order.productName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#152033] truncate max-w-[200px]">
                                {order.productName}
                              </p>
                              <p className="text-xs text-[#637089]">{order.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-[#152033]">
                          {order.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-[#152033]">
                          {order.orderAmount.toFixed(2)} ₽
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${colorConfig.bg} ${colorConfig.text}`}
                          >
                            {statusLabels[order.erpStatus] || order.erpStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {hours !== null ? (
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                isOverdue
                                  ? 'bg-red-100 text-red-700 animate-pulse'
                                  : isUrgent
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {isOverdue
                                ? '已超时'
                                : hours < 1
                                ? `${Math.round(hours * 60)}分钟`
                                : `${hours.toFixed(1)}小时`}
                            </span>
                          ) : (
                            <span className="text-xs text-[#637089]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            href={`/orders/${order.id}`}
                            className="inline-flex px-3 py-1.5 text-xs font-medium text-[#2F6BFF] hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            查看详情
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 分页 */}
        {total > 0 && (
          <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 border border-[#E6EAF2]">
            <p className="text-sm text-[#637089]">
              共 <span className="font-medium text-[#152033]">{total}</span> 条
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 text-sm border border-[#E6EAF2] rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 text-sm text-[#152033]">
                第 {page} / {totalPages} 页
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 text-sm border border-[#E6EAF2] rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrdersListPage() {
  return <AppLayout><OrdersListPageInner /></AppLayout>;
}