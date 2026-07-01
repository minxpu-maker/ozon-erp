'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { PurchaseDemand } from '@/lib/api/purchase';
import { ListRow } from '@/components/purchase/list-row';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowUp,
  ArrowDown,
  ShoppingCart,
  AlertCircle,
  Loader2,
  Keyboard,
} from 'lucide-react';

/**
 * 排序类型
 */
type SortBy = 'deadline' | 'createdAt' | 'totalPrice';
type SortOrder = 'asc' | 'desc';

/**
 * 列表容器 Props
 */
export interface EnhancedListProps {
  demands: PurchaseDemand[];
  selectedIds: Set<number>;
  onSelect: (id: number) => void;
  onSelectRange: (fromId: number, toId: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onOpenDrawer: (id: number) => void;
  activeDemandId: number | null;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  groupBy?: 'order' | 'supplier' | 'store';
  onSortChange?: (sortBy: SortBy, sortOrder: SortOrder) => void;
  currentSort?: { sortBy: SortBy; sortOrder: SortOrder };
}

/**
 * 快捷键帮助面板
 */
function KeyboardHelpPanel({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: '↑ / ↓', desc: '行间导航' },
    { key: 'Enter', desc: '打开Drawer' },
    { key: 'Space', desc: '勾选/取消当前行' },
    { key: 'Esc', desc: '关闭Drawer / 取消选择' },
    { key: 'P', desc: '批量采购' },
    { key: '/', desc: '聚焦搜索框' },
    { key: 'Ctrl+A', desc: '全选' },
    { key: '?', desc: '显示快捷键帮助' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Keyboard className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">快捷键</h3>
        </div>
        <div className="space-y-2">
          {shortcuts.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-mono">{key}</kbd>
              <span className="text-gray-500">{desc}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400 text-center">
          按 Esc 关闭
        </div>
      </div>
    </div>
  );
}

/**
 * 列头组件
 */
function ListHeader({
  sortBy,
  sortOrder,
  onSortChange,
  isAllSelected,
  onSelectAll,
}: {
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSortChange: (column: SortBy) => void;
  isAllSelected: boolean;
  onSelectAll: () => void;
}) {
  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      onSortChange(column);
    } else {
      onSortChange(column);
    }
  };

  return (
    <div className="sticky top-0 z-9 h-10 bg-slate-50 border-b border-slate-200/80 flex items-center px-3 text-xs text-gray-500 font-medium">
      {/* 选择列 - 40px */}
      <div className="w-10 flex justify-center">
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={onSelectAll}
          className="h-4 w-4"
        />
      </div>
      
      {/* 订单信息 - 25% */}
      <div className="w-[25%] pl-2">订单信息</div>
      
      {/* 商品详情 - 30% */}
      <div className="w-[30%]">商品详情</div>
      
      {/* 数量与金额 - 18% 可排序 */}
      <div 
        className="w-[18%] text-right pr-4 cursor-pointer hover:text-blue-600 flex items-center justify-end gap-1"
        onClick={() => handleSort('totalPrice')}
      >
        <span className={cn(sortBy === 'totalPrice' && 'text-blue-600 font-semibold')}>
          数量与金额
        </span>
        {sortBy === 'totalPrice' && (
          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        )}
      </div>
      
      {/* 截止时间 - 12% 可排序 */}
      <div 
        className="w-[12%] text-center cursor-pointer hover:text-blue-600 flex items-center justify-center gap-1"
        onClick={() => handleSort('deadline')}
      >
        <span className={cn(sortBy === 'deadline' && 'text-blue-600 font-semibold')}>
          截止时间
        </span>
        {sortBy === 'deadline' && (
          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        )}
      </div>
      
      {/* 货源匹配 - 8% */}
      <div className="w-[8%] text-center">货源</div>
      
      {/* 操作 - 7% */}
      <div className="w-[7%] text-center">操作</div>
    </div>
  );
}

/**
 * 列表骨架屏
 */
function ListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-[72px] flex items-center border-b border-slate-100/80 px-3">
          {/* 色条 */}
          <div className="w-1 h-12 rounded-l bg-gray-200 animate-shimmer" />
          {/* Checkbox */}
          <div className="w-10 flex justify-center">
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          {/* 订单信息 */}
          <div className="w-[25%] pl-2 space-y-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          {/* 商品详情 */}
          <div className="w-[30%] space-y-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          {/* 数量与金额 */}
          <div className="w-[18%] flex justify-end pr-4 space-y-1">
            <Skeleton className="h-4 w-24" />
          </div>
          {/* 截止时间 */}
          <div className="w-[12%] flex justify-center">
            <Skeleton className="h-4 w-16" />
          </div>
          {/* 货源 */}
          <div className="w-[8%] flex justify-center">
            <Skeleton className="h-3 w-3 rounded-full" />
          </div>
          {/* 操作 */}
          <div className="w-[7%] flex justify-center">
            <Skeleton className="h-6 w-12 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 空状态
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <ShoppingCart className="w-12 h-12 text-emerald-500/40 mb-3" />
      <p className="text-sm text-gray-500">暂无待采购需求</p>
    </div>
  );
}

/**
 * 错误状态
 */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
      <p className="text-sm text-gray-500 mb-3">加载失败</p>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onRetry}
        className="text-red-500 hover:bg-red-50"
      >
        重试
      </Button>
    </div>
  );
}

/**
 * EnhancedList 组件 - 增强列表容器
 */
export function EnhancedList({
  demands,
  selectedIds,
  onSelect,
  onSelectRange,
  onSelectAll,
  onClearSelection,
  onOpenDrawer,
  activeDemandId,
  isLoading,
  hasMore,
  onLoadMore,
  groupBy,
  onSortChange,
  currentSort = { sortBy: 'deadline', sortOrder: 'asc' },
}: EnhancedListProps) {
  // 排序状态
  const [sortBy, setSortBy] = useState<SortBy>(currentSort.sortBy);
  const [sortOrder, setSortOrder] = useState<SortOrder>(currentSort.sortOrder);
  
  // 键盘导航状态
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  
  // 容器引用
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const lastSelectedIndexRef = useRef<number>(-1);
  
  // 错误状态（用于重试）
  const [error, setError] = useState<boolean>(false);

  // 处理排序列点击
  const handleSortClick = useCallback((column: SortBy) => {
    if (sortBy === column) {
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(newOrder);
      onSortChange?.(column, newOrder);
    } else {
      setSortBy(column);
      setSortOrder('asc');
      onSortChange?.(column, 'asc');
    }
  }, [sortBy, sortOrder, onSortChange]);

  // 是否全选
  const isAllSelected = useMemo(() => {
    return demands.length > 0 && demands.every(d => selectedIds.has(d.id ?? 0));
  }, [demands, selectedIds]);

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      onClearSelection();
    } else {
      onSelectAll();
    }
  }, [isAllSelected, onSelectAll, onClearSelection]);

  // 虚拟滚动配置
  const virtualizer = useVirtualizer({
    count: demands.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 72, // 每行固定72px
    overscan: 5,
    measureElement: (element) => {
      return element?.getBoundingClientRect().height ?? 72;
    },
  });

  // 无限加载：IntersectionObserver 监听底部哨兵
  useEffect(() => {
    if (!hasMore || isLoading) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '100px' }
    );
    
    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }
    
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  // 键盘导航
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查焦点是否在输入框
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      
      // / 键聚焦搜索框（即使不在列表容器焦点）
      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="搜索"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
        return;
      }
      
      // 如果焦点不在容器或输入框，跳过其他快捷键
      if (document.activeElement !== container && !container.contains(document.activeElement)) {
        return;
      }
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (focusedIndex > 0) {
            setFocusedIndex(focusedIndex - 1);
          } else if (focusedIndex === -1 && demands.length > 0) {
            setFocusedIndex(0);
          }
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          if (focusedIndex < demands.length - 1) {
            setFocusedIndex(focusedIndex + 1);
          } else if (focusedIndex === -1 && demands.length > 0) {
            setFocusedIndex(0);
          }
          break;
          
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < demands.length) {
            const demand = demands[focusedIndex];
            if (demand.id) {
              onOpenDrawer(demand.id);
            }
          }
          break;
          
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < demands.length) {
            const demand = demands[focusedIndex];
            if (demand.id) {
              // Shift+Space 范围选择
              if (e.shiftKey && lastSelectedIndexRef.current >= 0) {
                onSelectRange(
                  demands[lastSelectedIndexRef.current].id ?? 0,
                  demand.id
                );
              } else {
                onSelect(demand.id);
                lastSelectedIndexRef.current = focusedIndex;
              }
            }
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          if (showKeyboardHelp) {
            setShowKeyboardHelp(false);
          } else if (activeDemandId !== null) {
            onOpenDrawer(0); // 关闭Drawer的信号
          } else if (selectedIds.size > 0) {
            onClearSelection();
          }
          break;
          
        case 'p':
        case 'P':
          e.preventDefault();
          // 批量采购接口预留
          console.log('批量采购触发');
          break;
          
        case 'a':
        case 'A':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSelectAll();
          }
          break;
          
        case '?':
          e.preventDefault();
          setShowKeyboardHelp(true);
          break;
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [
    focusedIndex,
    demands,
    selectedIds,
    activeDemandId,
    showKeyboardHelp,
    onSelect,
    onSelectRange,
    onOpenDrawer,
    onClearSelection,
    handleSelectAll,
  ]);

  // 点击容器聚焦
  const handleContainerClick = useCallback(() => {
    containerRef.current?.focus();
  }, []);

  // 渲染空状态
  if (!isLoading && demands.length === 0 && !error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState />
      </div>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <ErrorState onRetry={() => setError(false)} />
      </div>
    );
  }

  // 渲染骨架屏（初始加载）
  if (isLoading && demands.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <ListHeader
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortClick}
          isAllSelected={false}
          onSelectAll={handleSelectAll}
        />
        <ListSkeleton />
      </div>
    );
  }

  // 获取虚拟行的样式
  const getVirtualRowStyle = useCallback((virtualRow: { start: number; size: number }) => {
    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: `${virtualRow.size}px`,
      transform: `translateY(${virtualRow.start}px)`,
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      onClick={handleContainerClick}
      className="bg-white rounded-xl border border-gray-200 overflow-auto focus:outline-none relative"
      style={{ maxHeight: 'calc(100vh - 180px)' }}
    >
      {/* 列头 */}
      <ListHeader
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortClick}
        isAllSelected={isAllSelected}
        onSelectAll={handleSelectAll}
      />
      
      {/* 虚拟滚动区域 */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const demand = demands[virtualRow.index];
          const isSelected = demand?.id ? selectedIds.has(demand.id) : false;
          const isActive = demand?.id === activeDemandId;
          const isFocused = virtualRow.index === focusedIndex;
          
          return (
            <Fragment key={virtualRow.key}>
              <div
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={getVirtualRowStyle(virtualRow)}
                className={cn(
                  isFocused && 'border-l-2 border-blue-500'
                )}
              >
                {demand && (
                  <ListRow
                    demand={demand}
                    isSelected={isSelected}
                    isActive={isActive}
                    onSelect={onSelect}
                    onOpenDrawer={onOpenDrawer}
                    style={getVirtualRowStyle(virtualRow)}
                  />
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
      
      {/* 无限加载哨兵 */}
      {hasMore && (
        <div ref={sentinelRef} className="h-4 flex items-center justify-center">
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>加载中...</span>
            </div>
          )}
        </div>
      )}
      
      {/* 快捷键帮助面板 */}
      {showKeyboardHelp && (
        <KeyboardHelpPanel onClose={() => setShowKeyboardHelp(false)} />
      )}
    </div>
  );
}

export default EnhancedList;