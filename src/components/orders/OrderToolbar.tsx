'use client';

import { useState, useEffect } from 'react';
import { Search, ChevronDown, LayoutGrid, List, X, Zap, Clock, RefreshCw, Building } from 'lucide-react';

// 筛选状态类型
export interface ToolbarFilters {
  keyword: string;
  urgency: 'all' | 'overdue' | 'urgent' | 'normal';
  timeRange: 'all' | 'today' | '3days' | '7days' | '30days';
  shops: string[]; // 多选店铺ID数组
}

export interface Shop {
  id: string;
  name: string;
}

interface OrderToolbarProps {
  filters: ToolbarFilters;
  onFiltersChange: (filters: ToolbarFilters) => void;
  availableShops: Shop[];
  viewMode: 'card' | 'list';
  onViewModeChange: (mode: 'card' | 'list') => void;
  onSync?: () => void;
  syncing?: boolean;
}

// 紧急度选项
const URGENCY_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'overdue', label: '超时' },
  { value: 'urgent', label: '紧急' },
  { value: 'normal', label: '普通' },
];

// 时间范围选项
const TIME_RANGE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今日' },
  { value: '3days', label: '3天内' },
  { value: '7days', label: '7天内' },
  { value: '30days', label: '30天内' },
];

// 紧急度颜色
const URGENCY_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  overdue: { bg: 'bg-red-50', text: 'text-red-700' },
  urgent: { bg: 'bg-amber-50', text: 'text-amber-700' },
  normal: { bg: 'bg-gray-50', text: 'text-gray-600' },
};

// 下拉选择组件 - 带图标
function DropdownSelect({
  value,
  options,
  onChange,
  placeholder,
  colorClass,
  icon,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder: string;
  colorClass?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;
  const displayLabel = value === 'all' ? placeholder : selectedLabel;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 border border-gray-200 text-sm hover:border-gray-300 transition-colors focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100 ${colorClass || 'text-gray-700'}`}
      >
        {icon}
        <span>{displayLabel}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px] animate-fade-in">
            {options.map(option => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${option.value === value ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// 店铺多选组件 - 带图标
function ShopMultiSelect({
  selectedShops,
  onChange,
  availableShops,
}: {
  selectedShops: string[];
  onChange: (shops: string[]) => void;
  availableShops: Shop[];
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = selectedShops.includes('all')
    ? '店铺'
    : selectedShops.length === 0
      ? '店铺'
      : `已选${selectedShops.length}`;

  const toggleShop = (shopId: string) => {
    if (shopId === 'all') {
      onChange(['all']);
      return;
    }
    const newShops = selectedShops.includes(shopId)
      ? selectedShops.filter(s => s !== shopId)
      : [...selectedShops.filter(s => s !== 'all'), shopId];
    onChange(newShops.length === 0 ? ['all'] : newShops);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 border border-gray-200 text-sm hover:border-gray-300 transition-colors focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100 ${selectedShops.includes('all') ? 'text-gray-700' : 'text-blue-600'}`}
      >
        <Building className="w-4 h-4 text-gray-400" />
        <span>{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px] animate-fade-in">
            <button
              onClick={() => { onChange(['all']); setOpen(false); }}
              className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${selectedShops.includes('all') ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}`}
            >
              <input
                type="checkbox"
                checked={selectedShops.includes('all')}
                onChange={() => {}}
                className="w-4 h-4 rounded"
              />
              全部
            </button>
            {availableShops.map(shop => (
              <button
                key={shop.id}
                onClick={() => toggleShop(shop.id)}
                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${selectedShops.includes(shop.id) ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}`}
              >
                <input
                  type="checkbox"
                  checked={selectedShops.includes(shop.id)}
                  onChange={() => {}}
                  className="w-4 h-4 rounded"
                />
                {shop.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// 已选条件Tag组件
function ActiveFiltersTag({
  filters,
  availableShops,
  onClear,
}: {
  filters: ToolbarFilters;
  availableShops: Shop[];
  onClear: (key: keyof ToolbarFilters) => void;
}) {
  const tags: { key: keyof ToolbarFilters; label: string; color: string }[] = [];

  // 紧急度Tag
  if (filters.urgency !== 'all') {
    const color = URGENCY_TAG_COLORS[filters.urgency];
    tags.push({
      key: 'urgency',
      label: `紧急度: ${filters.urgency === 'overdue' ? '超时' : filters.urgency === 'urgent' ? '紧急' : '普通'}`,
      color: `${color.bg} ${color.text}`,
    });
  }

  // 时间范围Tag
  if (filters.timeRange !== 'all') {
    const label = filters.timeRange === 'today' ? '今日' :
                  filters.timeRange === '3days' ? '3天内' :
                  filters.timeRange === '7days' ? '7天内' : '30天内';
    tags.push({
      key: 'timeRange',
      label: `时间: ${label}`,
      color: 'bg-blue-50 text-blue-700',
    });
  }

  // 店铺Tag
  if (!filters.shops.includes('all') && filters.shops.length > 0) {
    const shopNames = filters.shops.map(id => availableShops.find(s => s.id === id)?.name || id);
    tags.push({
      key: 'shops',
      label: `店铺: ${shopNames.join(', ')}`,
      color: 'bg-blue-50 text-blue-700',
    });
  }

  if (tags.length === 0) return null;

  const handleClearAll = () => {
    onClear('urgency');
    onClear('timeRange');
    onClear('shops');
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-t border-gray-100 mt-2">
      <div className="flex items-center gap-2 flex-wrap">
        {tags.map(tag => (
          <span
            key={tag.key}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${tag.color}`}
          >
            {tag.label}
            <button
              onClick={() => onClear(tag.key)}
              className="ml-0.5 hover:opacity-70 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <button
        onClick={handleClearAll}
        className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        清除全部
      </button>
    </div>
  );
}

export default function OrderToolbar({
  filters,
  onFiltersChange,
  availableShops,
  viewMode,
  onViewModeChange,
  onSync,
  syncing,
}: OrderToolbarProps) {
  const [localKeyword, setLocalKeyword] = useState(filters.keyword);

  // Debounce搜索输入
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localKeyword !== filters.keyword) {
        onFiltersChange({ ...filters, keyword: localKeyword });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localKeyword]);

  // 清除单个筛选条件
  const handleClearFilter = (key: keyof ToolbarFilters) => {
    if (key === 'urgency') {
      onFiltersChange({ ...filters, urgency: 'all' });
    } else if (key === 'timeRange') {
      onFiltersChange({ ...filters, timeRange: 'all' });
    } else if (key === 'shops') {
      onFiltersChange({ ...filters, shops: ['all'] });
    }
  };

  // 清除全部筛选
  const handleClearAll = () => {
    onFiltersChange({
      keyword: '',
      urgency: 'all',
      timeRange: 'all',
      shops: ['all'],
    });
    setLocalKeyword('');
  };

  // 计算是否有活跃筛选
  const hasActiveFilters = filters.urgency !== 'all' || filters.timeRange !== 'all' || !filters.shops.includes('all');

  return (
    <div className="sticky top-0 z-[var(--z-sticky,20)] bg-slate-50">
      {/* 圆角白色容器包裹搜索筛选栏 */}
      <div className="mx-4 my-3 rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
        {/* 第一行：搜索框 + 筛选下拉 + 同步按钮 + 视图切换 */}
        <div className="flex items-center gap-3">
          {/* 搜索框 */}
          <div className="relative w-80 flex-shrink-0 flex items-center">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
            <input
              type="text"
              value={localKeyword}
              onChange={e => setLocalKeyword(e.target.value)}
              placeholder="搜索订单号、SKU、商品名…"
              className="w-full pl-9 pr-20 py-2.5 rounded-lg bg-slate-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:border-blue-400 transition-all"
            />
            {onSync && (
              <button
                onClick={onSync}
                disabled={syncing}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-medium px-4 py-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? '同步中' : '同步'}</span>
              </button>
            )}
            {localKeyword && !syncing && (
              <button
                onClick={() => { setLocalKeyword(''); onFiltersChange({ ...filters, keyword: '' }); }}
                className="absolute right-24 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 筛选下拉 - 带图标 */}
          <DropdownSelect
            value={filters.urgency}
            options={URGENCY_OPTIONS}
            onChange={value => onFiltersChange({ ...filters, urgency: value as ToolbarFilters['urgency'] })}
            placeholder="紧急度"
            colorClass={filters.urgency !== 'all' ? URGENCY_TAG_COLORS[filters.urgency]?.text : undefined}
            icon={<Zap className="w-4 h-4 text-gray-400 mr-1.5" />}
          />

          <DropdownSelect
            value={filters.timeRange}
            options={TIME_RANGE_OPTIONS}
            onChange={value => onFiltersChange({ ...filters, timeRange: value as ToolbarFilters['timeRange'] })}
            placeholder="时间范围"
            colorClass={filters.timeRange !== 'all' ? 'text-blue-600' : undefined}
            icon={<Clock className="w-4 h-4 text-gray-400 mr-1.5" />}
          />

          <ShopMultiSelect
            selectedShops={filters.shops}
            onChange={shops => onFiltersChange({ ...filters, shops })}
            availableShops={availableShops}
          />

          {/* 视图切换 */}
          <div className="ml-auto flex items-center gap-1 bg-slate-50 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('card')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="卡片视图"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="列表视图"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 第二行：已选条件Tag区 */}
        <ActiveFiltersTag
          filters={filters}
          availableShops={availableShops}
          onClear={handleClearFilter}
        />
      </div>
    </div>
  );
}
