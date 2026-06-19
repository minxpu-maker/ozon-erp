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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn, formatCNY } from '@/lib/utils';
import { ShoppingCart, Eye, ArrowUpDown, ArrowUp, ArrowDown, Check, X, ExternalLink } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

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

// ERP采购状态映射 - 覆盖所有可能的 erpStatus 值
const erpStatusLabels: Record<string, string> = {
  // ERP 自定义状态
  pending: '待采购',
  purchasing: '采购中',
  purchased: '已采购',
  shipped_domestic: '运输中',
  received: '已到货',
  qc_passed: '验货通过',
  packing: '打包中',
  shipped: '已发货',
  settled: '已结算',
  // Ozon 原始状态（数据库实际存储值）
  new: '待采购',
  pending_purchase: '待采购',
  awaiting_pack: '待打包',
  awaiting_packaging: '待打包',
  awaiting_deliver: '待发货',
  delivering: '配送中',
  in_transit: '运输中',
  verified: '验货通过',
  packed: '已打包',
  delivered: '已完成',
  cancelled: '已取消',
};

// ERP采购状态颜色
const erpStatusColors: Record<string, string> = {
  // ERP 自定义状态
  pending: 'bg-blue-100 text-blue-700 border-blue-200',
  purchasing: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  purchased: 'bg-green-100 text-green-700 border-green-200',
  shipped_domestic: 'bg-orange-100 text-orange-700 border-orange-200',
  received: 'bg-green-100 text-green-700 border-green-200',
  qc_passed: 'bg-green-100 text-green-700 border-green-200',
  packing: 'bg-purple-100 text-purple-700 border-purple-200',
  shipped: 'bg-gray-100 text-gray-600 border-gray-200',
  settled: 'bg-gray-100 text-gray-500 border-gray-200',
  // Ozon 原始状态
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  pending_purchase: 'bg-blue-100 text-blue-700 border-blue-200',
  awaiting_pack: 'bg-orange-100 text-orange-700 border-orange-200',
  awaiting_packaging: 'bg-orange-100 text-orange-700 border-orange-200',
  awaiting_deliver: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  delivering: 'bg-blue-100 text-blue-700 border-blue-200',
  in_transit: 'bg-orange-100 text-orange-700 border-orange-200',
  verified: 'bg-green-100 text-green-700 border-green-200',
  packed: 'bg-purple-100 text-purple-700 border-purple-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

// 需要显示"去采购"按钮的状态
const PENDING_STATUSES = ['pending', 'pending_purchase', 'new', ''];
// 需要显示"查看采购"按钮的状态
const PURCHASING_STATUSES = ['purchasing'];
// 已处理状态（不显示按钮）
const PROCESSED_STATUSES = ['purchased', 'shipped_domestic', 'received', 'qc_passed', 'packing', 'shipped', 'settled', 'delivered', 'cancelled'];

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

interface PurchaseInfo {
  platform: string;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
  url?: string;
  trackingNumber?: string;
  note?: string;
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
  purchaseInfo?: PurchaseInfo | null;
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
  const [currentNow, setNow] = useState<number | null>(null);
  // 排序状态：deadline_asc=截止时间升序(默认), deadline_desc=截止时间降序, created_desc=创建时间降序
  const [sortMode, setSortMode] = useState<'deadline_asc' | 'deadline_desc' | 'created_desc'>('deadline_asc');
  // Tab筛选状态
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'purchasing' | 'purchased' | 'pending_ship' | 'shipped'>('all');
  // 选中订单状态
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (mounted) setNow(Date.now()); }, [mounted]);

  // 监听页面切换，检测采购工作台的数据变化 - 移到 useSWR 之后
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
  const { data, error, isLoading, mutate: ordersMutate } = useSWR<OrdersResponse>(
    `/api/orders?shopId=${shopId}&status=${erpStatus}&orderId=${search}&page=${page}&pageSize=20`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // 统一使用 ordersMutate
  const mutate = ordersMutate;

  // 监听页面切换，检测采购工作台的数据变化
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const actionData = localStorage.getItem('erp_purchase_action');
        if (actionData) {
          try {
            const { action, timestamp } = JSON.parse(actionData);
            // 5分钟内的新操作才触发刷新
            if (action === 'purchase_confirmed' && Date.now() - timestamp < 5 * 60 * 1000) {
              mutate();
              localStorage.removeItem('erp_purchase_action');
            }
          } catch {
            localStorage.removeItem('erp_purchase_action');
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    // 首次加载也检查一次
    handleVisibilityChange();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mutate]);

  const orderList: OrderRecord[] = data?.orders ?? [];
  const stats = data?.stats ?? { newCount: 0, pendingCount: 0, shippingCount: 0, overdueCount: 0, unreadMessageCount: 0 };
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  // Overdue detection - now 作为参数传入避免纯度问题
  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    // eslint-disable-next-line react-hooks/purity
    return new Date(deadline).getTime() < Date.now();
  };

  // 按排序模式排序订单
  const sortedOrders = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const currentTime = new Date().getTime();
    return [...orderList].sort((a, b) => {
      if (sortMode === 'deadline_asc') {
        // 超时订单置顶，然后按截止时间升序
        const aTime = a.shipmentDeadline ? new Date(a.shipmentDeadline).getTime() : Infinity;
        const bTime = b.shipmentDeadline ? new Date(b.shipmentDeadline).getTime() : Infinity;
        const aOverdue = a.shipmentDeadline ? aTime < currentTime : false;
        const bOverdue = b.shipmentDeadline ? bTime < currentTime : false;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return aTime - bTime;
      } else if (sortMode === 'deadline_desc') {
        // 按截止时间降序（最晚的排最前）
        const aTime = a.shipmentDeadline ? new Date(a.shipmentDeadline).getTime() : 0;
        const bTime = b.shipmentDeadline ? new Date(b.shipmentDeadline).getTime() : 0;
        return bTime - aTime;
      } else {
        // created_desc: 按创建时间降序（最新的排最前）
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      }
    });
  }, [orderList, sortMode]);

  // Tab状态计数
  const tabCounts = useMemo(() => {
    const counts = { all: orderList.length, pending: 0, purchasing: 0, purchased: 0, pending_ship: 0, shipped: 0 };
    orderList.forEach(order => {
      const status = order.erpStatus || '';
      if (PENDING_STATUSES.includes(status)) counts.pending++;
      else if (status === 'purchasing') counts.purchasing++;
      else if (status === 'purchased') counts.purchased++;
      else if (status === 'qc_passed' || status === 'packing') counts.pending_ship++;
      else if (status === 'shipped') counts.shipped++;
    });
    return counts;
  }, [orderList]);

  // 按Tab筛选订单
  const filteredOrders = useMemo(() => {
    if (activeTab === 'all') return sortedOrders;
    return sortedOrders.filter(order => {
      const status = order.erpStatus || '';
      switch (activeTab) {
        case 'pending': return PENDING_STATUSES.includes(status);
        case 'purchasing': return status === 'purchasing';
        case 'purchased': return status === 'purchased';
        case 'pending_ship': return status === 'qc_passed' || status === 'packing';
        case 'shipped': return status === 'shipped';
        default: return true;
      }
    });
  }, [sortedOrders, activeTab]);

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  // 切换单个订单选中
  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // 批量去采购
  const handleBatchPurchase = () => {
    const pendingOrders = filteredOrders.filter(o => selectedIds.has(o.id) && PENDING_STATUSES.includes(o.erpStatus || ''));
    if (pendingOrders.length > 0) {
      const ids = pendingOrders.map(o => o.id).join(',');
      router.push(`/purchase?orderIds=${ids}&action=batch`);
    }
  };

  // 批量查看采购
  const handleBatchView = () => {
    const purchasingOrders = filteredOrders.filter(o => selectedIds.has(o.id) && o.erpStatus === 'purchasing');
    if (purchasingOrders.length > 0) {
      const ids = purchasingOrders.map(o => o.id).join(',');
      router.push(`/purchase?orderIds=${ids}&action=batch-view`);
    }
  };

  // 清空选择
  const clearSelection = () => setSelectedIds(new Set());

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
    if (!deadline || currentNow === null) return null;
    const diff = new Date(deadline).getTime() - currentNow;
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

      {/* Tab状态筛选栏 */}
      <div className="flex items-center gap-1 border-b border-border">
        {[
          { key: 'all' as const, label: '全部', count: tabCounts.all },
          { key: 'pending' as const, label: '待采购', count: tabCounts.pending },
          { key: 'purchasing' as const, label: '采购中', count: tabCounts.purchasing },
          { key: 'purchased' as const, label: '已采购', count: tabCounts.purchased },
          { key: 'pending_ship' as const, label: '待发货', count: tabCounts.pending_ship },
          { key: 'shipped' as const, label: '已发货', count: tabCounts.shipped },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedIds(new Set()); }}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            )}
          >
            {tab.label}
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full',
              activeTab === tab.key
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-700">
              已选 <span className="font-bold">{selectedIds.size}</span> 单
            </span>
            {filteredOrders.some(o => selectedIds.has(o.id) && PENDING_STATUSES.includes(o.erpStatus || '')) && (
              <Button
                size="sm"
                className="h-7 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleBatchPurchase}
              >
                <ShoppingCart className="w-3 h-3 mr-1" />
                批量去采购
              </Button>
            )}
            {filteredOrders.some(o => selectedIds.has(o.id) && o.erpStatus === 'purchasing') && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                onClick={handleBatchView}
              >
                <Eye className="w-3 h-3 mr-1" />
                批量查看采购
              </Button>
            )}
          </div>
          <button
            onClick={clearSelection}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            取消选择
          </button>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={filteredOrders.length > 0 && selectedIds.size === filteredOrders.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[160px]">订单号</TableHead>
                <TableHead>店铺</TableHead>
                <TableHead>收件人</TableHead>
                <TableHead>收货城市</TableHead>
                <TableHead className="text-right">订单金额</TableHead>
                <TableHead>订单状态</TableHead>
                <TableHead>采购状态</TableHead>
                <TableHead>
                  <button
                    onClick={() => setSortMode(sortMode === 'deadline_asc' ? 'deadline_desc' : 'deadline_asc')}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    发货倒计时
                    {sortMode === 'deadline_asc' ? (
                      <ArrowUp className="w-3 h-3 text-blue-600" />
                    ) : sortMode === 'deadline_desc' ? (
                      <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => setSortMode('created_desc')}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    创建时间
                    {sortMode === 'created_desc' ? (
                      <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead>同步时间</TableHead>
                <TableHead className="text-center">消息</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-16 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-16 text-red-500">
                    数据加载失败
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-16 text-muted-foreground">
                    暂无订单数据
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map(order => {
                  const overdue = isOverdue(order.shipmentDeadline);
                  const hoursLeft = mounted ? getDeadlineHours(order.shipmentDeadline) : null;
                  const shop = shops.find(s => s.id === order.shopId);

                  // 计算倒计时显示
                  const getCountdownDisplay = () => {
                    // 已取消/已完成的订单不显示倒计时
                    if (order.erpStatus === 'cancelled' || order.erpStatus === 'delivered') {
                      return <span className="text-muted-foreground text-sm">—</span>;
                    }
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
                    <TableRow key={order.id} className={cn("group", selectedIds.has(order.id) && "bg-blue-50/50")}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(order.id)}
                          onCheckedChange={() => toggleSelect(order.id)}
                        />
                      </TableCell>
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
                        {order.purchaseInfo ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity',
                                erpStatusColors[order.erpStatus] || 'bg-gray-100 text-gray-600 border-gray-200'
                              )}>
                                {erpStatusLabels[order.erpStatus] || order.erpStatus}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0" align="start">
                              <div className="px-3 py-2 border-b bg-muted/50">
                                <p className="font-medium text-sm">采购详情</p>
                                <p className="text-xs text-muted-foreground">{order.ozonPostingNumber}</p>
                              </div>
                              <ScrollArea className="max-h-64">
                                <div className="p-3 space-y-2">
                                  {/* 平台 */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">采购平台</span>
                                    <span className="text-sm font-medium">
                                      {order.purchaseInfo.platform === '1688' ? '1688' : order.purchaseInfo.platform === 'pdd' ? '拼多多' : order.purchaseInfo.platform || '—'}
                                    </span>
                                  </div>
                                  {/* 单价 */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">采购单价</span>
                                    <span className="text-sm font-medium">
                                      {order.purchaseInfo.unitPrice ? formatCNY(order.purchaseInfo.unitPrice) : '—'}
                                    </span>
                                  </div>
                                  {/* 数量 */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">采购数量</span>
                                    <span className="text-sm font-medium">{order.purchaseInfo.quantity ?? '—'}</span>
                                  </div>
                                  {/* 总金额 */}
                                  <div className="flex items-center justify-between border-t pt-2 mt-2">
                                    <span className="text-xs text-muted-foreground">采购总额</span>
                                    <span className="text-sm font-bold text-green-600">
                                      {order.purchaseInfo.totalAmount ? formatCNY(order.purchaseInfo.totalAmount) : '—'}
                                    </span>
                                  </div>
                                  {/* 1688链接 */}
                                  {order.purchaseInfo.url && (
                                    <div className="border-t pt-2 mt-2">
                                      <span className="text-xs text-muted-foreground block mb-1">采购链接</span>
                                      <a
                                        href={order.purchaseInfo.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 break-all"
                                      >
                                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                        {order.purchaseInfo.url.length > 40 
                                          ? order.purchaseInfo.url.substring(0, 40) + '...' 
                                          : order.purchaseInfo.url}
                                      </a>
                                    </div>
                                  )}
                                  {/* 快递单号 */}
                                  {order.purchaseInfo.trackingNumber && (
                                    <div className="flex items-center justify-between border-t pt-2 mt-2">
                                      <span className="text-xs text-muted-foreground">快递单号</span>
                                      <span className="text-sm font-medium">{order.purchaseInfo.trackingNumber}</span>
                                    </div>
                                  )}
                                  {/* 供应商备注 */}
                                  {order.purchaseInfo.note && (
                                    <div className="border-t pt-2 mt-2">
                                      <span className="text-xs text-muted-foreground block mb-1">供应商备注</span>
                                      <p className="text-xs">{order.purchaseInfo.note}</p>
                                    </div>
                                  )}
                                </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        ) : order.erpStatus && order.erpStatus !== 'pending_purchase' && order.erpStatus !== 'new' ? (
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
                      <TableCell>
                        {/* 操作按钮 */}
                        {PENDING_STATUSES.includes(order.erpStatus || '') ? (
                          <Button
                            size="sm"
                            className="h-7 bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => router.push(`/purchase?orderId=${order.id}&action=create`)}
                          >
                            <ShoppingCart className="w-3 h-3 mr-1" />
                            去采购
                          </Button>
                        ) : PURCHASING_STATUSES.includes(order.erpStatus) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                            onClick={() => router.push(`/purchase?orderId=${order.id}&action=view`)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            查看
                          </Button>
                        ) : (
                          <span className="text-gray-400 text-xs">已处理</span>
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
