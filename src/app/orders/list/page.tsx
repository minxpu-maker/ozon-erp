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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { cn, formatCNY, getCountdown } from '@/lib/utils';
import { ShoppingCart, Eye, ArrowUpDown, ArrowUp, ArrowDown, Check, X, ExternalLink } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OrderCard, OrderRecord } from '@/components/orders/OrderCard';
import PipelineTabs, { OrderStatus, PIPELINE_TABS, getOrderTabKey } from '@/components/orders/PipelineTabs';
import { SummaryBar } from '@/components/orders/SummaryBar';

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
  pending_purchase: '待采购',    // 已准备发运
  pending_packaging: '待打包',    // 等待打包
  purchasing: '运输中(采购)',
  purchased: '已采购',
  shipped_domestic: '运输中',
  received: '已到货',
  qc_passed: '验货通过',
  packing: '打包中',
  shipped: '已发货',
  settled: '已结算',
  // Ozon 原始状态（兼容）
  new: '待采购',
  pending: '待处理',
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
  pending_purchase: 'bg-blue-100 text-blue-700 border-blue-200', // 待采购
  pending_packaging: 'bg-orange-100 text-orange-700 border-orange-200', // 待打包
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
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
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

// 需要显示"去采购"按钮的状态 - 只有已准备发运的订单才能采购
const PENDING_STATUSES = ['pending_purchase'];
// 需要显示"查看采购"按钮的状态 - 运输中(采购)
const PURCHASING_STATUSES = ['shipped_domestic'];
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
  // Tab筛选状态 - 基于order_status(Ozon外部状态)
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('awaiting_deliver');
  // 选中订单状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // 排序方式
  const [sortBy, setSortBy] = useState<'urgency' | 'created'>('urgency');

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

  // 按紧急度或创建时间排序订单
  const sortedOrders = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const currentTime = Date.now();
    
    return [...orderList].sort((a, b) => {
      // 对于待采购/全部Tab，按紧急度排序
      if (activeTab === 'all' || activeTab === 'awaiting_deliver') {
        const aCountdown = getCountdown(a.shipmentDeadline);
        const bCountdown = getCountdown(b.shipmentDeadline);
        
        // deadline 为空的排最后
        if (!a.shipmentDeadline && b.shipmentDeadline) return 1;
        if (a.shipmentDeadline && !b.shipmentDeadline) return -1;
        
        // 按紧急度排序：overdue > urgent > warning > normal
        const levelOrder = { overdue: 0, urgent: 1, warning: 2, normal: 3 };
        const aLevel = levelOrder[aCountdown.level];
        const bLevel = levelOrder[bCountdown.level];
        
        if (aLevel !== bLevel) {
          return aLevel - bLevel;
        }
        
        // 同紧急度内按 deadline 升序（越近越前）
        const aTime = new Date(a.shipmentDeadline!).getTime();
        const bTime = new Date(b.shipmentDeadline!).getTime();
        if (aTime !== bTime) return aTime - bTime;
        
        // 同deadline内按创建时间倒序（新单优先）
        const aCreateTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreateTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bCreateTime - aCreateTime;
      }
      
      // 对于已完成Tab（采购中/已采购/待发货/已发货），按创建时间倒序
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [orderList, activeTab]);

  // Tab状态计数 - 基于order.status(Ozon外部状态)
  const tabCounts = useMemo(() => {
    const counts = { 
      all: orderList.length, 
      awaiting_packaging: 0, 
      awaiting_deliver: 0, 
      delivering: 0, 
      disputed: 0, 
      delivered: 0, 
      cancelled: 0 
    };
    orderList.forEach(order => {
      const status = order.status || '';
      if (status === 'awaiting_packaging' || status === 'awaiting-packaging') counts.awaiting_packaging++;
      else if (status === 'awaiting_deliver' || status === 'awaiting-deliver') counts.awaiting_deliver++;
      else if (status === 'delivering') counts.delivering++;
      else if (status === 'delivered') counts.delivered++;
      else if (status === 'cancelled') counts.cancelled++;
    });
    return counts;
  }, [orderList]);

  // 按Tab筛选订单 - 基于order.status(Ozon外部状态)
  const filteredOrders = useMemo(() => {
    if (activeTab === 'all') return sortedOrders;
    return sortedOrders.filter(order => {
      const status = order.status || '';
      switch (activeTab) {
        case 'awaiting_packaging': return status === 'awaiting_packaging' || status === 'awaiting-packaging';
        case 'awaiting_deliver': return status === 'awaiting_deliver' || status === 'awaiting-deliver';
        case 'delivering': return status === 'delivering';
        case 'delivered': return status === 'delivered';
        case 'cancelled': return status === 'cancelled';
        default: return true;
      }
    });
  }, [sortedOrders, activeTab]);

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => String(o.id))));
    }
  };

  // 切换单个订单选中
  const toggleSelect = (id: string | number) => {
    const idStr = String(id);
    const newSet = new Set(selectedIds);
    if (newSet.has(idStr)) {
      newSet.delete(idStr);
    } else {
      newSet.add(idStr);
    }
    setSelectedIds(newSet);
  };

  // 批量去采购
  const handleBatchPurchase = () => {
    const pendingOrders = filteredOrders.filter(o => selectedIds.has(String(o.id)) && PENDING_STATUSES.includes(o.erpStatus || ''));
    if (pendingOrders.length > 0) {
      const ids = pendingOrders.map(o => o.id).join(',');
      router.push(`/purchase?orderIds=${ids}&action=batch`);
    }
  };

  // 批量查看运输中
  const handleBatchView = () => {
    const transitOrders = filteredOrders.filter(o => selectedIds.has(String(o.id)) && o.erpStatus === 'shipped_domestic');
    if (transitOrders.length > 0) {
      const ids = transitOrders.map(o => o.id).join(',');
      router.push(`/purchase?orderIds=${ids}&action=batch-view`);
    }
  };

  // 清空选择
  const clearSelection = () => setSelectedIds(new Set());

  const formatPrice = (price: number | string | null | undefined) => {
    if (price == null) return '—';
    return formatCNY(Number(price));
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

      {/* Tab状态筛选栏 - 基于order.status(Ozon外部状态) */}
      <PipelineTabs
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setSelectedIds(new Set()); }}
        counts={tabCounts}
      />

      {/* 摘要行 - 逾期/紧急/总数 */}
      <SummaryBar
        orders={filteredOrders}
        currentTab={activeTab}
        totalCount={filteredOrders.length}
      />

      {/* 全选控件 + 排序 */}
      <div className="flex items-center justify-between py-2 px-1">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={filteredOrders.length > 0 && selectedIds.size === filteredOrders.length}
            onCheckedChange={toggleSelectAll}
            disabled={filteredOrders.length === 0}
          />
          <span className="text-sm text-gray-500">
            已选 <span className="font-medium text-gray-700">{selectedIds.size}</span> / 共 <span className="font-medium text-gray-700">{filteredOrders.length}</span> 单
          </span>
        </div>
        <Select value={sortBy} onValueChange={v => setSortBy(v as 'urgency' | 'created')}>
          <SelectTrigger className="w-36 bg-card text-sm h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgency">按紧急度排序</SelectItem>
            <SelectItem value="created">按创建时间排序</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 批量操作浮动栏 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-white border border-gray-200 rounded-xl shadow-lg px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              已选 <span className="font-bold text-blue-600">{selectedIds.size}</span> 单
            </span>
            {selectedIds.size > 20 && (
              <span className="text-xs text-red-500">单次最多处理20单</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* 批量去采购按钮 */}
            {(() => {
              const pendingCount = filteredOrders.filter(o => selectedIds.has(String(o.id)) && PENDING_STATUSES.includes(o.erpStatus || '')).length;
              const transitCount = filteredOrders.filter(o => selectedIds.has(String(o.id)) && o.erpStatus === 'shipped_domestic').length;
              
              return (
                <>
                  {pendingCount > 0 && (
                    <Button
                      size="sm"
                      className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        if (selectedIds.size > 20) {
                          alert('单次最多处理20单，请减少选择');
                          return;
                        }
                        const ids = filteredOrders.filter(o => selectedIds.has(String(o.id)) && PENDING_STATUSES.includes(o.erpStatus || '')).map(o => o.id).join(',');
                        router.push(`/purchase?orderIds=${ids}&action=batch`);
                      }}
                    >
                      <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                      批量去采购
                      {pendingCount < selectedIds.size && (
                        <span className="ml-1 text-xs opacity-80">({pendingCount}单待采购)</span>
                      )}
                    </Button>
                  )}
                  
                  {/* 批量查看运输中按钮 */}
                  {transitCount > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                      onClick={() => {
                        if (selectedIds.size > 20) {
                          alert('单次最多处理20单，请减少选择');
                          return;
                        }
                        const ids = filteredOrders.filter(o => selectedIds.has(String(o.id)) && o.erpStatus === 'shipped_domestic').map(o => o.id).join(',');
                        router.push(`/purchase?orderIds=${ids}&action=batch-view`);
                      }}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      批量查看运输
                    </Button>
                  )}
                </>
              );
            })()}
          </div>
          
          <div className="w-px h-6 bg-gray-200" />
          
          <button
            onClick={clearSelection}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
            取消选择
          </button>
        </div>
      )}

      {/* Orders Cards */}
      <div className="space-y-3">
        {isLoading ? (
          <OrderSkeleton />
        ) : error ? (
          <div className="text-center py-16 text-red-500">
            数据加载失败
          </div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState tab={erpStatus} onRefresh={() => ordersMutate()} />
        ) : (
          filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              selected={selectedIds.has(String(order.id))}
              onSelect={toggleSelect}
            />
          ))
        )}
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
    </AppLayout>
  );
}

// 骨架屏组件
function OrderSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="bg-white rounded-xl shadow-sm p-4 flex gap-4"
        >
          {/* 色条占位 */}
          <div className="w-1 bg-gray-200 rounded-full" />
          {/* 倒计时占位 */}
          <Skeleton className="w-16 h-6 rounded" />
          {/* 复选框占位 */}
          <Skeleton className="w-5 h-5 rounded" />
          {/* 商品信息占位 */}
          <div className="flex-1 space-y-2">
            <div className="flex gap-3">
              <Skeleton className="w-12 h-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-3 w-1/4" />
          </div>
          {/* 金额占位 */}
          <div className="w-24 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-20 rounded" />
          </div>
          {/* 按钮占位 */}
          <Skeleton className="w-20 h-8 rounded" />
        </div>
      ))}
    </>
  );
}

// 空状态组件
function EmptyState({ tab, onRefresh }: { tab: string; onRefresh: () => void }) {
  const messages: Record<string, { title: string; desc: string }> = {
    all: { title: '暂无订单', desc: 'Ozon出单后会自动同步到这里' },
    pending: { title: '没有待采购订单', desc: '去喝杯茶' },
    purchasing: { title: '没有进行中的采购', desc: '休息一下' },
    purchased: { title: '暂无已采购订单', desc: '继续努力' },
    'to-ship': { title: '暂无待发货订单', desc: '打包发货效率很高' },
    shipped: { title: '暂无已发货订单', desc: '等待买家收货中' },
  };

  const content = messages[tab] || messages.all;

  return (
    <div className="flex flex-col items-center justify-center py-16">
      {/* 空箱子插画 */}
      <svg
        className="w-32 h-32 text-gray-200 mb-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{content.title}</h3>
      <p className="text-sm text-gray-400 mb-6">{content.desc}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        className="text-gray-500"
      >
        手动同步
      </Button>
    </div>
  );
}
