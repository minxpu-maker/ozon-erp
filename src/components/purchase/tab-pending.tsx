'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Filter, Package, ShoppingCart, AlertCircle, Check, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PendingCard, PendingOrder } from './pending-card';
import { getPurchaseDemandList, PurchaseDemand, PurchaseDemandsResponse } from '@/lib/api/purchase';
import { ViewToggle } from './view-toggle';
import { EnhancedList } from './enhanced-list';
import { cn } from '@/lib/utils';

// SKU聚合组类型（导出给父组件使用）
export interface DemandGroup {
  sku: string | null;
  productName: string;
  productImage: string | null;
  orders: PendingOrder[];
}

export interface TabPendingProps {
  onCardClick: (group: DemandGroup, cardIndex: number) => void;
  selectedSku: string | null;
  onListUpdate?: (groups: DemandGroup[]) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  /** 当前激活的demandId（Drawer对应的行） */
  activeDemandId?: number | null;
  /** Drawer关闭回调 */
  onDrawerClose?: () => void;
  /** 列表视角打开Drawer回调 */
  onOpenDrawer?: (demandId: number) => void;
  /** 视角模式（由父组件管理） */
  viewMode?: ViewMode;
  /** 视角切换过渡状态 */
  viewTransitioning?: boolean;
  /** 视角切换回调 */
  onViewModeChange?: (mode: ViewMode) => void;
}

// 视角模式类型
type ViewMode = 'card' | 'list';

export function TabPending({ 
  onCardClick, 
  selectedSku, 
  onListUpdate, 
  searchInputRef,
  activeDemandId,
  onDrawerClose,
  onOpenDrawer,
  viewMode: externalViewMode,
  viewTransitioning: externalTransitioning,
  onViewModeChange
}: TabPendingProps) {
  const [demands, setDemands] = useState<PurchaseDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 搜索和筛选
  const [searchKeyword, setSearchKeyword] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'expired' | 'urgent'>('all');

  // 视角切换状态 - 支持外部控制或内部管理
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('card');
  const viewMode = externalViewMode ?? internalViewMode;
  // 使用外部传入的过渡状态，或内部默认false
  const isTransitioning = externalTransitioning ?? false;

  // 选中状态（跨视角共享）
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 过渡动画类名
  const transitionClass = isTransitioning ? 'animate-view-exit' : '';

  // 卡片分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const [showLargeListHint, setShowLargeListHint] = useState(true);

  // 列表视角分页状态
  const [listPage, setListPage] = useState(1);
  const [paginationInfo, setPaginationInfo] = useState<{ total: number; totalPages: number } | null>(null);
  const [listLoadingMore, setListLoadingMore] = useState(false);

  // 获取数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await getPurchaseDemandList({ status: 'pending', page: 1, pageSize: 100 });
        setDemands(response.data);
        setPaginationInfo(response.pagination ? { total: response.pagination.total, totalPages: response.pagination.totalPages } : null);
        setListPage(1);
        setError(null);
      } catch (err) {
        console.error('获取待采购数据失败:', err);
        setError('获取数据失败');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 列表视角加载更多
  const handleListLoadMore = useCallback(async () => {
    if (listLoadingMore || !paginationInfo) return;
    if (listPage >= paginationInfo.totalPages) return;

    try {
      setListLoadingMore(true);
      const nextPage = listPage + 1;
      const response = await getPurchaseDemandList({ status: 'pending', page: nextPage, pageSize: 100 });
      setDemands(prev => [...prev, ...response.data]);
      setListPage(nextPage);
    } catch (err) {
      console.error('加载更多失败:', err);
    } finally {
      setListLoadingMore(false);
    }
  }, [listLoadingMore, listPage, paginationInfo]);

  // 列表视角是否还有更多数据
  const listHasMore = paginationInfo ? listPage < paginationInfo.totalPages : false;

  // 初始化viewMode（仅在没有外部传入时使用）
  useEffect(() => {
    // 如果外部传入viewMode，跳过初始化
    if (externalViewMode) return;
    
    const urlView = new URLSearchParams(window.location.search).get('view');
    const storedView = localStorage.getItem('purchase_view_mode');
    
    if (urlView === 'card' || urlView === 'list') {
      setInternalViewMode(urlView);
    } else if (storedView === 'card' || storedView === 'list') {
      setInternalViewMode(storedView);
    } else {
      setInternalViewMode('card');
    }
  }, [externalViewMode]);

  // SKU聚合
  const groupedData = useMemo(() => {
    const groups: Map<string, DemandGroup> = new Map();

    demands.forEach((d) => {
      if (!d.order) return;

      // 使用 SKU 作为聚合键，如果没有 SKU 则用 orderId（单独显示）
      const groupKey = d.sku || `no-sku-${d.orderId}`;

      const existingGroup = groups.get(groupKey);
      if (existingGroup) {
        // 添加到已有组
        existingGroup.orders.push({
          demandId: d.id!,
          orderId: d.orderId,
          ozonOrderId: d.order.postingNumber || d.order.id,
          shopName: d.order.shopName || '未知店铺',
          quantity: d.quantity,
          orderAmount: d.order.totalPrice || '0',
          shipmentDeadline: d.order.shipmentDeadline,
          erpStatus: d.order.erpStatus || 'pending_purchase',
        });
      } else {
        // 创建新组
        groups.set(groupKey, {
          sku: d.sku,
          productName: d.productName,
          productImage: d.productImage,
          orders: [
            {
              demandId: d.id!,
              orderId: d.orderId,
              ozonOrderId: d.order.postingNumber || d.order.id,
              shopName: d.order.shopName || '未知店铺',
              quantity: d.quantity,
              orderAmount: d.order.totalPrice || '0',
              shipmentDeadline: d.order.shipmentDeadline,
              erpStatus: d.order.erpStatus || 'pending_purchase',
            },
          ],
        });
      }
    });

    return Array.from(groups.values());
  }, [demands]);

  // 通知父组件数据更新
  useEffect(() => {
    if (onListUpdate && groupedData.length > 0) {
      onListUpdate(groupedData);
    }
  }, [groupedData, onListUpdate]);

  // 计算倒计时小时数
  const calcHoursLeft = (deadline: string | null): number => {
    if (!deadline) return Infinity;
    const diffMs = new Date(deadline).getTime() - Date.now();
    return diffMs / (1000 * 60 * 60);
  };

  // 筛选和排序
  const filteredAndSorted = useMemo(() => {
    let result = groupedData;

    // 关键词搜索：SKU精确匹配，商品名模糊匹配
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      result = result.filter(
        (g) =>
          (g.sku && g.sku.toLowerCase() === kw) ||
          g.productName.toLowerCase().includes(kw)
      );
    }

    // 时间筛选
    if (timeFilter !== 'all') {
      result = result.filter((g) => {
        const earliestHours = g.orders.reduce((min, o) => {
          const hours = calcHoursLeft(o.shipmentDeadline);
          return Math.min(min, hours);
        }, Infinity);

        if (timeFilter === 'expired') return earliestHours <= 0;
        if (timeFilter === 'urgent') return earliestHours > 0 && earliestHours < 12;
        return true;
      });
    }

    // 排序：已超时最前 → 按截止时间升序
    result.sort((a, b) => {
      const aEarliest = a.orders.reduce((min, o) => Math.min(min, calcHoursLeft(o.shipmentDeadline)), Infinity);
      const bEarliest = b.orders.reduce((min, o) => Math.min(min, calcHoursLeft(o.shipmentDeadline)), Infinity);

      if (aEarliest <= 0 && bEarliest > 0) return -1;
      if (bEarliest <= 0 && aEarliest > 0) return 1;

      return aEarliest - bEarliest;
    });

    return result;
  }, [groupedData, searchKeyword, timeFilter]);

  // 卡片分页数据
  const paginatedGroups = useMemo(() => {
    const start = 0;
    const end = currentPage * pageSize;
    return filteredAndSorted.slice(start, end);
  }, [filteredAndSorted, currentPage]);

  const hasMoreCards = paginatedGroups.length < filteredAndSorted.length;
  const totalCount = filteredAndSorted.length;

  // 选中处理（卡片视角）- 根据SKU找到对应的demand id
  const handleCardSelect = useCallback((sku: string) => {
    // 找到该SKU对应的demand id
    const matchingDemand = demands.find(d => d.sku === sku);
    if (matchingDemand && matchingDemand.id !== null) {
      const demandId = matchingDemand.id; // 类型收窄为number
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(demandId)) {
          newSet.delete(demandId);
        } else {
          newSet.add(demandId);
        }
        return newSet;
      });
    }
  }, [demands]);

  // 选中处理（列表视角）
  const handleListSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    const allIds = demands.filter(d => d.id !== null).map(d => d.id!);
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [selectedIds, demands]);

  // 清空选择
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // 列表视角打开Drawer
  const handleListOpenDrawer = useCallback((demandId: number) => {
    if (onOpenDrawer) {
      onOpenDrawer(demandId);
    }
  }, [onOpenDrawer]);

  // 加载更多卡片
  const handleLoadMore = useCallback(() => {
    setCurrentPage(prev => prev + 1);
  }, []);

  // 加载态
  if (loading) {
    return (
      <div className="p-4">
        <div className="flex gap-3 mb-4">
          <Skeleton className="h-9 w-[200px]" />
          <Skeleton className="h-9 w-[120px]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // 错误态
  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-[400px] text-gray-400">
        <AlertCircle className="w-10 h-10 mb-3" />
        <p>{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setLoading(true)}>
          重试
        </Button>
      </div>
    );
  }

  // 空状态
  if (filteredAndSorted.length === 0) {
    return (
      <div className="p-4">
        {/* 搜索筛选栏 */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              placeholder="搜索 SKU / 商品名"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="时间筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="expired">已超时</SelectItem>
              <SelectItem value="urgent">即将超时</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
          <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-8 h-8 text-emerald-300" />
          </div>
          <p className="text-sm">
            {searchKeyword || timeFilter !== 'all'
              ? '未找到匹配的待采购订单'
              : '暂无待采购订单'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("p-4 transition-opacity duration-200", transitionClass)}>
      {/* 搜索筛选栏 */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            ref={searchInputRef}
            placeholder="搜索 SKU / 商品名"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)}>
          <SelectTrigger className="w-[120px] h-9">
            <Filter className="w-3.5 h-3.5 mr-1" />
            <SelectValue placeholder="时间筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="expired">已超时</SelectItem>
            <SelectItem value="urgent">即将超时</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 大量数据提示条 */}
      {totalCount >= 200 && showLargeListHint && viewMode === 'card' && (
        <div className="bg-blue-50/50 text-blue-600 text-xs px-4 py-1.5 text-center mb-4 rounded-lg flex items-center justify-center gap-2">
          <span>数据量较大，建议切换到列表视角获得更好体验</span>
          <Button
            variant="link"
            size="sm"
            className="text-blue-600 h-auto p-0 text-xs"
            onClick={() => onViewModeChange?.('list')}
          >
            切换列表视角
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 h-auto p-0 text-xs hover:text-gray-600"
            onClick={() => setShowLargeListHint(false)}
          >
            关闭
          </Button>
        </div>
      )}

      {/* 卡片视角 */}
      {viewMode === 'card' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
            {paginatedGroups.map((group, idx) => {
              // 判断该组是否选中：组内所有demandId都在selectedIds中
              const groupDemandIds = group.orders.map(o => o.demandId).filter((id): id is number => id !== null);
              const isSelected = groupDemandIds.length > 0 && groupDemandIds.every(id => selectedIds.has(id));
              const isActive = group.orders.some(o => activeDemandId === o.demandId);
              
              return (
                <div
                  key={group.sku || `group-${idx}`}
                  className={cn(
                    "relative",
                    isSelected && "ring-2 ring-blue-400/60 rounded-xl"
                  )}
                  onClick={() => handleCardSelect(group.sku || '')}
                >
                  {/* 选中勾选标记 */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-blue-500 rounded-full w-5 h-5 flex items-center justify-center z-10">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  
                  <PendingCard
                    sku={group.sku}
                    productName={group.productName}
                    productImage={group.productImage}
                    orders={group.orders}
                    isSelected={selectedSku === group.sku || isActive}
                    onClick={() => onCardClick(group, idx)}
                  />
                </div>
              );
            })}
          </div>

          {/* 加载更多 */}
          {hasMoreCards && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                className="text-sm"
              >
                加载更多（还有 {totalCount - paginatedGroups.length} 条）
              </Button>
            </div>
          )}

          {/* 数量统计 */}
          <div className="mt-4 text-xs text-gray-400 text-center">
            共 {totalCount} 个 SKU · {demands.length} 笔订单
            {selectedIds.size > 0 && ` · 已选中 ${selectedIds.size} 个`}
          </div>
        </>
      )}

      {/* 列表视角 */}
      {viewMode === 'list' && (
        <EnhancedList
          demands={demands}
          selectedIds={selectedIds}
          onSelect={handleListSelect}
          onSelectRange={(fromId, toId) => {
            // 范围选择逻辑
            const fromIdx = demands.findIndex(d => d.id === fromId);
            const toIdx = demands.findIndex(d => d.id === toId);
            if (fromIdx !== -1 && toIdx !== -1) {
              const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
              const newIds = new Set(selectedIds);
              for (let i = start; i <= end; i++) {
                newIds.add(demands[i].id!);
              }
              setSelectedIds(newIds);
            }
          }}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onOpenDrawer={handleListOpenDrawer}
          activeDemandId={activeDemandId ?? null}
          isLoading={listLoadingMore}
          hasMore={listHasMore}
          onLoadMore={handleListLoadMore}
          groupBy="order"
        />
      )}
    </div>
  );
}