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
  ChevronRight,
  ChevronDown,
  Package,
} from 'lucide-react';

/**
 * 排序类型
 */
type SortBy = 'deadline' | 'createdAt' | 'totalPrice';
type SortOrder = 'asc' | 'desc';

/**
 * 分组类型
 */
type GroupBy = 'order' | 'supplier' | 'store';

/**
 * 紧急程度类型
 */
type UrgencyLevel = 'overdue' | 'today' | 'tomorrow' | 'later';

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
  groupBy?: GroupBy;
  onSortChange?: (sortBy: SortBy, sortOrder: SortOrder) => void;
  currentSort?: { sortBy: SortBy; sortOrder: SortOrder };
  onViewToggle?: () => void;
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
    { key: 'V', desc: '切换到卡片视角' },
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
 * 获取紧急程度颜色和样式
 */
function getUrgencyColor(urgency: UrgencyLevel): { bg: string; shadow: string } {
  switch (urgency) {
    case 'overdue':
      return {
        bg: 'bg-gradient-to-b from-red-500 to-red-300',
        shadow: 'shadow-[0_0_8px_rgba(239,68,68,0.6)]',
      };
    case 'today':
      return {
        bg: 'bg-gradient-to-b from-orange-500 to-orange-300',
        shadow: 'shadow-[0_0_8px_rgba(249,115,22,0.6)]',
      };
    case 'tomorrow':
      return {
        bg: 'bg-gradient-to-b from-yellow-500 to-yellow-300',
        shadow: 'shadow-[0_0_8px_rgba(234,179,8,0.6)]',
      };
    case 'later':
      return {
        bg: 'bg-gradient-to-b from-emerald-500 to-emerald-300',
        shadow: 'shadow-[0_0_8px_rgba(16,185,129,0.6)]',
      };
  }
}

/**
 * 计算紧急程度
 */
function calcUrgencyLevel(deadline: string | null | undefined): UrgencyLevel {
  if (!deadline) return 'later';
  const diffMs = new Date(deadline).getTime() - Date.now();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffHours <= 0) return 'overdue';
  if (diffHours <= 24) return 'today';
  if (diffHours <= 48) return 'tomorrow';
  return 'later';
}

/**
 * 格式化截止时间显示
 */
function formatDeadline(deadline: string | null | undefined): string {
  if (!deadline) return '--';
  const date = new Date(deadline);
  const diffMs = date.getTime() - Date.now();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffHours <= 0) {
    const absHours = Math.abs(diffHours).toFixed(1);
    return `已超时${absHours}h`;
  }
  if (diffHours <= 24) {
    const hours = Math.floor(diffHours);
    const minutes = Math.floor((diffHours - hours) * 60);
    return `今天 ${hours}:${minutes.toString().padStart(2, '0')}`;
  }
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

/**
 * 分组头行组件（折叠态/展开态）
 */
function GroupHeaderRow({
  groupKey,
  groupLabel,
  groupItems,
  isExpanded,
  onToggle,
  isSelected,
  onSelect,
  onOpenDrawer,
  style,
}: {
  groupKey: string;
  groupLabel: string;
  groupItems: PurchaseDemand[];
  isExpanded: boolean;
  onToggle: () => void;
  isSelected: boolean;
  onSelect: () => void;
  onOpenDrawer: (id: number) => void;
  style?: React.CSSProperties;
}) {
  // 计算组内最紧急的截止时间
  const mostUrgent = groupItems.reduce<{ urgency: UrgencyLevel; deadline: string | null }>((min, item) => {
    const urgency = calcUrgencyLevel(item.deadline);
    const priority: Record<UrgencyLevel, number> = { overdue: 0, today: 1, tomorrow: 2, later: 3 };
    return priority[urgency] < priority[min.urgency] 
      ? { urgency, deadline: item.deadline ?? null }
      : min;
  }, { urgency: 'later', deadline: null });
  
  const urgencyColor = getUrgencyColor(mostUrgent.urgency);
  
  // 计算组汇总数据
  const totalQty = groupItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const totalPrice = groupItems.reduce((sum, item) => {
    const price = parseFloat(item.order?.totalPrice || '0') || 0;
    return sum + price;
  }, 0);
  
  const deadlineText = formatDeadline(mostUrgent.deadline);
  const isOverdue = mostUrgent.urgency === 'overdue';
  
  return (
    <div
      style={style}
      className={cn(
        'h-16 flex items-center border-b border-slate-100/80 relative',
        'bg-white transition-all duration-200',
        isSelected && 'bg-blue-50/60',
        isOverdue && 'bg-red-50/20',
        !isExpanded && 'hover:bg-blue-50/30 hover:-translate-y-px'
      )}
    >
      {/* 紧急程度色条 */}
      <div 
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 rounded-l-xl',
          urgencyColor.bg,
          urgencyColor.shadow,
          isOverdue && 'animate-pulse-glow'
        )}
      />
      
      {/* Checkbox */}
      <div className="w-10 pl-1 flex justify-center">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className={cn(
            'h-[18px] w-[18px] rounded',
            isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'
          )}
        />
      </div>
      
      {/* 展开箭头 + 分组名称 */}
      <div className="flex-1 pl-2 flex items-center gap-2">
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </button>
        <span className="text-sm font-semibold text-gray-900 truncate">{groupLabel}</span>
        <span className="text-xs text-gray-400 ml-2">包含 {groupItems.length} 件商品</span>
      </div>
      
      {/* 截止时间（右对齐） */}
      <div className="w-[12%] text-center">
        <span className={cn(
          'text-sm font-medium',
          isOverdue ? 'text-red-600 font-semibold' : 
          mostUrgent.urgency === 'today' ? 'text-orange-600' : 'text-gray-500'
        )}>
          {deadlineText}
        </span>
      </div>
      
      {/* 去采购按钮 */}
      <div className="w-[7%] flex justify-center">
        <Button
          size="sm"
          onClick={() => {
            // 打开第一个item的Drawer
            const firstItem = groupItems[0];
            if (firstItem?.id) {
              onOpenDrawer(firstItem.id);
            }
          }}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:shadow-lg active:scale-[0.97] transition-all"
        >
          去采购
        </Button>
      </div>
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
 * 虚拟行类型
 */
type VirtualRowItem = 
  | { type: 'group-header'; groupKey: string; groupLabel: string; items: PurchaseDemand[]; index: number }
  | { type: 'item'; demand: PurchaseDemand; groupIndex: number; itemIndex: number; globalIndex: number };

/**
 * EnhancedList 组件 - 增强列表容器（支持分组折叠）
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
  groupBy = 'order',
  onViewToggle,
  onSortChange,
  currentSort = { sortBy: 'deadline', sortOrder: 'asc' },
}: EnhancedListProps) {
  // 排序状态
  const [sortBy, setSortBy] = useState<SortBy>(currentSort.sortBy);
  const [sortOrder, setSortOrder] = useState<SortOrder>(currentSort.sortOrder);
  
  // 分组展开状态
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // 键盘导航状态
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  
  // 容器引用
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const lastSelectedIndexRef = useRef<number>(-1);
  
  // 错误状态（用于重试）
  const [error, setError] = useState<boolean>(false);

  // 切换分组模式时清空展开状态
  useEffect(() => {
    setExpandedGroups(new Set());
  }, [groupBy]);

  // 分组逻辑
  const groupedDemands = useMemo(() => {
    const groups: Map<string, { label: string; items: PurchaseDemand[] }> = new Map();
    
    demands.forEach((demand) => {
      let groupKey: string;
      let groupLabel: string;
      
      switch (groupBy) {
        case 'order':
          // 按订单号分组
          groupKey = demand.order?.postingNumber || `order-${demand.orderId}`;
          groupLabel = demand.order?.postingNumber || `订单 #${demand.orderId}`;
          break;
        case 'supplier':
          // 按货源匹配状态分组（占位）
          groupKey = demand.sourceMatchStatus || 'unmatched';
          groupLabel = demand.sourceMatchStatus === 'matched' ? '已匹配货源' : 
                       demand.sourceMatchStatus === 'partial' ? '部分匹配' : '待匹配货源';
          break;
        case 'store':
          // 按店铺分组
          groupKey = demand.order?.shopName || 'unknown-store';
          groupLabel = demand.order?.shopName || '未知店铺';
          break;
        default:
          groupKey = demand.order?.postingNumber || `order-${demand.orderId}`;
          groupLabel = demand.order?.postingNumber || `订单 #${demand.orderId}`;
      }
      
      const existing = groups.get(groupKey);
      if (existing) {
        existing.items.push(demand);
      } else {
        groups.set(groupKey, { label: groupLabel, items: [demand] });
      }
    });
    
    return groups;
  }, [demands, groupBy]);

  // 构建虚拟行列表（包含分组头和子项）
  const virtualRows: VirtualRowItem[] = useMemo(() => {
    const rows: VirtualRowItem[] = [];
    let globalIndex = 0;
    
    groupedDemands.forEach((group, groupKey) => {
      // 如果组内只有1项，直接平铺为普通行（不折叠）
      if (group.items.length === 1) {
        rows.push({
          type: 'item',
          demand: group.items[0],
          groupIndex: rows.length,
          itemIndex: 0,
          globalIndex: globalIndex++,
        });
      } else {
        // 多项组：添加分组头
        rows.push({
          type: 'group-header',
          groupKey,
          groupLabel: group.label,
          items: group.items,
          index: globalIndex++,
        });
        
        // 如果展开，添加子项
        if (expandedGroups.has(groupKey)) {
          group.items.forEach((item, itemIndex) => {
            rows.push({
              type: 'item',
              demand: item,
              groupIndex: rows.length,
              itemIndex,
              globalIndex: globalIndex++,
            });
          });
        }
      }
    });
    
    return rows;
  }, [groupedDemands, expandedGroups]);

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

  // 切换分组展开
  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

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

  // 获取行的预估高度
  const estimateRowHeight = useCallback((index: number): number => {
    const row = virtualRows[index];
    if (row?.type === 'group-header') {
      return 64; // 分组头高度
    }
    return 72; // 普通行高度
  }, [virtualRows]);

  // 虚拟滚动配置
  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: estimateRowHeight,
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
          } else if (focusedIndex === -1 && virtualRows.length > 0) {
            setFocusedIndex(0);
          }
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          if (focusedIndex < virtualRows.length - 1) {
            setFocusedIndex(focusedIndex + 1);
          } else if (focusedIndex === -1 && virtualRows.length > 0) {
            setFocusedIndex(0);
          }
          break;
          
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < virtualRows.length) {
            const row = virtualRows[focusedIndex];
            if (row?.type === 'group-header') {
              toggleGroup(row.groupKey);
            } else if (row?.type === 'item' && row.demand.id) {
              onOpenDrawer(row.demand.id);
            }
          }
          break;
          
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < virtualRows.length) {
            const row = virtualRows[focusedIndex];
            if (row?.type === 'item' && row.demand.id) {
              // Shift+Space 范围选择
              if (e.shiftKey && lastSelectedIndexRef.current >= 0) {
                onSelectRange(
                  demands[lastSelectedIndexRef.current].id ?? 0,
                  row.demand.id
                );
              } else {
                onSelect(row.demand.id);
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

        case 'v':
        case 'V':
          e.preventDefault();
          if (onViewToggle) {
            onViewToggle();
          }
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
    virtualRows,
    demands,
    selectedIds,
    activeDemandId,
    showKeyboardHelp,
    onSelect,
    onSelectRange,
    onOpenDrawer,
    onClearSelection,
    handleSelectAll,
    toggleGroup,
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
          const rowItem = virtualRows[virtualRow.index];
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
                {rowItem?.type === 'group-header' && (
                  <GroupHeaderRow
                    groupKey={rowItem.groupKey}
                    groupLabel={rowItem.groupLabel}
                    groupItems={rowItem.items}
                    isExpanded={expandedGroups.has(rowItem.groupKey)}
                    onToggle={() => toggleGroup(rowItem.groupKey)}
                    isSelected={rowItem.items.every(item => item.id && selectedIds.has(item.id))}
                    onSelect={() => {
                      // 选中/取消选中整个组
                      const allIds = rowItem.items.map(item => item.id ?? 0);
                      const allSelected = allIds.every(id => selectedIds.has(id));
                      if (allSelected) {
                        // 取消选中全组
                        allIds.forEach(id => {
                          if (selectedIds.has(id)) onSelect(id);
                        });
                      } else {
                        // 选中全组
                        allIds.forEach(id => {
                          if (!selectedIds.has(id)) onSelect(id);
                        });
                      }
                    }}
                    onOpenDrawer={onOpenDrawer}
                  />
                )}
                {rowItem?.type === 'item' && (
                  <div className={cn(
                    // 如果是展开的子项，添加缩进
                    expandedGroups.has(
                      // 找到这个item所属的groupKey
                      Array.from(groupedDemands.keys()).find(key => 
                        groupedDemands.get(key)?.items.includes(rowItem.demand)
                      ) || ''
                    ) && 'pl-6'
                  )}>
                    <ListRow
                      demand={rowItem.demand}
                      isSelected={rowItem.demand.id ? selectedIds.has(rowItem.demand.id) : false}
                      isActive={rowItem.demand.id === activeDemandId}
                      onSelect={onSelect}
                      onOpenDrawer={onOpenDrawer}
                    />
                  </div>
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