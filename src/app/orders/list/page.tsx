'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { useState, useMemo, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(async r => {
  if (!r.ok) throw new Error('请求失败');
  return r.json();
});

// Status label mapping - 覆盖所有 Ozon 订单状态
const statusLabels: Record<string, string> = {
  new: '新订单',
  pending: '待采购',
  pending_purchase: '待采购',
  awaiting_pack: '待打包',
  awaiting_packaging: '待打包',
  awaiting_deliver: '待发货',
  delivering: '配送中',
  in_transit: '运输中',
  verified: '验货通过',
  packed: '已打包',
  shipped: '已发货',
  delivered: '已完成',
  cancelled: '已取消',
};

// ERP采购状态映射
const erpStatusLabels: Record<string, string> = {
  pending: '待采购',
  purchasing: '采购中',
  purchased: '已采购',
  shipped_domestic: '运输中',
  received: '已到货',
  qc_passed: '验货通过',
  packing: '打包中',
  shipped: '已发货',
  settled: '已结算',
};

// ERP采购状态颜色
const erpStatusColors: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-700 border-blue-200',
  purchasing: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  purchased: 'bg-green-100 text-green-700 border-green-200',
  shipped_domestic: 'bg-orange-100 text-orange-700 border-orange-200',
  received: 'bg-green-100 text-green-700 border-green-200',
  qc_passed: 'bg-green-100 text-green-700 border-green-200',
  packing: 'bg-purple-100 text-purple-700 border-purple-200',
  shipped: 'bg-gray-100 text-gray-600 border-gray-200',
  settled: 'bg-gray-100 text-gray-500 border-gray-200',
};

// Status color mapping
const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  pending: 'bg-red-100 text-red-700 border-red-200',
  pending_purchase: 'bg-red-100 text-red-700 border-red-200',
  awaiting_pack: 'bg-orange-100 text-orange-700 border-orange-200',
  awaiting_packaging: 'bg-orange-100 text-orange-700 border-orange-200',
  awaiting_deliver: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  delivering: 'bg-blue-100 text-blue-700 border-blue-200',
  in_transit: 'bg-orange-100 text-orange-700 border-orange-200',
  verified: 'bg-green-100 text-green-700 border-green-200',
  packed: 'bg-purple-100 text-purple-700 border-purple-200',
  shipped: 'bg-blue-100 text-blue-700 border-blue-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

interface OrdersResponse {
  success: boolean;
  orders: OrderRecord[];
  stats: {
    newCount: number;
    pendingCount: number;
    shippingCount: number;
    overdueCount: number;
    unreadMessageCount: number;
  };
  total: number;
  page: number;
  pageSize: number;
}

interface OrderRecord {
  id: number;
  ozonOrderId: string;
  ozonPostingNumber: string;
  shopId: string;
  shopName?: string | null;
  status: string;
  erpStatus: string;
  buyerName: string | null;
  recipientName: string | null;
  recipientCity: string | null;
  totalPrice: number | string | null;
  orderAmount: number | string | null;
  isPurchaseBound: boolean | null;
  isInspected: boolean | null;
  isPacked: boolean | null;
  shippedAt: string | null;
  shipmentDeadline: string | null;
  createdAt: string;
  lastSyncedAt: string | null;
  unreadMessageCount?: number;
}

interface Shop {
  id: string;
  shopName: string;
}

export default function OrdersListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL param state (preserves on navigation)
  const [shopId, setShopId] = useState(searchParams.get('shopId') || 'all');
  const [erpStatus, setErpStatus] = useState(searchParams.get('status') || 'all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (mounted) setNow(Date.now()); }, [mounted]);

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (shopId !== 'all') params.set('shopId', shopId);
    if (erpStatus !== 'all') params.set('status', erpStatus);
    if (search) params.set('search', search);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [shopId, erpStatus, search, page, pathname, router]);

  // Shops list
  const { data: shopsData } = useSWR<{ shops: Shop[] }>('/api/shops', fetcher);
  const shops = shopsData?.shops ?? [];

  // Orders data
  const { data, error, isLoading } = useSWR<OrdersResponse>(
    `/api/orders?shopId=${shopId}&status=${erpStatus}&orderId=${search}&page=${page}&pageSize=20`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const orderList: OrderRecord[] = data?.orders ?? [];
  const stats = data?.stats ?? { newCount: 0, pendingCount: 0, shippingCount: 0, overdueCount: 0, unreadMessageCount: 0 };
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  // Overdue detection
  const isOverdue = (deadline: string | null) => {
    if (!deadline || now === null) return false;
    return new Date(deadline).getTime() < now;
  };

  // 按发货截止时间排序：超时订单置顶，然后按剩余时间升序
  const sortedOrders = useMemo(() => {
    return [...orderList].sort((a, b) => {
      const aOverdue = isOverdue(a.shipmentDeadline);
      const bOverdue = isOverdue(b.shipmentDeadline);
      const aTime = a.shipmentDeadline ? new Date(a.shipmentDeadline).getTime() : Infinity;
      const bTime = b.shipmentDeadline ? new Date(b.shipmentDeadline).getTime() : Infinity;

      // 超时订单置顶
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // 按截止时间升序
      return aTime - bTime;
    });
  }, [orderList, now]);

  const formatPrice = (price: number | string | null | undefined) => {
    if (price == null) return '—';
    return `¥${Number(price).toFixed(2)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getDeadlineHours = (deadline: string | null) => {
    if (!deadline || now === null) return null;
    const diff = new Date(deadline).getTime() - now;
    if (diff <= 0) return 0;
    return Math.floor(diff / (1000 * 60 * 60));
  };

  return (
    <AppLayout title="订单列表" subtitle="管理来自 Ozon 的 FBS 订单">
      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">新订单</p>
          <p className="text-3xl font-bold text-blue-600">{stats.newCount}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">待采购</p>
          <p className="text-3xl font-bold text-red-600">{stats.pendingCount}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">待发货</p>
          <p className="text-3xl font-bold text-orange-600">{stats.shippingCount}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">超时预警</p>
          <p className="text-3xl font-bold text-red-600">{stats.overdueCount}</p>
        </div>
      <div className="bg-card rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">未读消息</p>
        <p className="text-3xl font-bold text-purple-600">{stats.unreadMessageCount}</p>
      </div>
    </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Shop Filter */}
        <Select value={shopId} onValueChange={v => { setShopId(v); setPage(1); }}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="全部门店" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部门店</SelectItem>
            {shops.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.shopName}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={erpStatus} onValueChange={v => { setErpStatus(v); setPage(1); }}>
          <SelectTrigger className="w-36 bg-card">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Input
            placeholder="搜索订单号/收件人..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="bg-card pr-8"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Refresh */}
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          刷新
        </Button>
      </div>

      {/* Orders Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[160px]">订单号</TableHead>
                <TableHead>店铺</TableHead>
                <TableHead>收件人</TableHead>
                <TableHead>收货城市</TableHead>
                <TableHead className="text-right">订单金额</TableHead>
                <TableHead>订单状态</TableHead>
                <TableHead>采购状态</TableHead>
                <TableHead>发货倒计时</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>同步时间</TableHead>
                <TableHead className="text-center">消息</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-16 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-16 text-red-500">
                    数据加载失败
                  </TableCell>
                </TableRow>
              ) : sortedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-16 text-muted-foreground">
                    暂无订单数据
                  </TableCell>
                </TableRow>
              ) : (
                sortedOrders.map(order => {
                  const overdue = isOverdue(order.shipmentDeadline);
                  const hoursLeft = mounted ? getDeadlineHours(order.shipmentDeadline) : null;
                  const shop = shops.find(s => s.id === order.shopId);

                  // 计算倒计时显示
                  const getCountdownDisplay = () => {
                    if (order.shipmentDeadline) {
                      if (overdue) {
                        return <span className="text-red-700 font-bold text-sm">已超时</span>;
                      }
                      if (hoursLeft !== null) {
                        if (hoursLeft >= 48) {
                          const days = Math.floor(hoursLeft / 24);
                          const remainingHours = hoursLeft % 24;
                          return <span className="text-green-600 text-sm">{days}d {remainingHours}h</span>;
                        } else if (hoursLeft >= 12) {
                          return <span className="text-yellow-600 font-medium text-sm">{hoursLeft}h</span>;
                        } else {
                          return <span className="text-red-600 font-bold text-sm">{hoursLeft}h</span>;
                        }
                      }
                      return <span className="text-muted-foreground text-sm">{new Date(order.shipmentDeadline).toLocaleDateString('zh-CN')}</span>;
                    }
                    return <span className="text-muted-foreground text-sm">—</span>;
                  };

                  return (
                    <TableRow key={order.id} className="group">
                      <TableCell>
                        <span className="font-mono text-sm text-blue-600">
                          {order.ozonPostingNumber || order.ozonOrderId || order.id}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {shop?.shopName || order.shopName || order.shopId || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.recipientName || order.buyerName || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.recipientCity || '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(order.totalPrice)}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
                          statusColors[order.erpStatus] || 'bg-gray-100 text-gray-600 border-gray-200'
                        )}>
                          {statusLabels[order.erpStatus] || statusLabels[order.status] || order.erpStatus || '未知'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {order.erpStatus ? (
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
                            erpStatusColors[order.erpStatus] || 'bg-gray-100 text-gray-600 border-gray-200'
                          )}>
                            {erpStatusLabels[order.erpStatus] || order.erpStatus}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getCountdownDisplay()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(order.lastSyncedAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        {(order.unreadMessageCount ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                            {(order.unreadMessageCount ?? 0)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              共 {total} 条，第 {page} / {totalPages} 页
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                上一页
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) {
                  p = i + 1;
                } else if (page <= 3) {
                  p = i + 1;
                } else if (page >= totalPages - 2) {
                  p = totalPages - 4 + i;
                } else {
                  p = page - 2 + i;
                }
                return (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(p)}
                    className="w-9"
                  >
                    {p}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
