'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Plus, ChevronDown } from 'lucide-react';

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
  selectedOrderIds: string[];
  onNewPurchase: () => void;
}

// 紧急度选项
const URGENCY_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'overdue', label: '逾期' },
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
const URGENCY_COLORS: Record<string, string> = {
  overdue: 'text-red-600',
  urgent: 'text-amber-600',
  normal: 'text-gray-600',
};

// 下拉选择组件
function DropdownSelect({
  value,
  options,
  onChange,
  placeholder,
  colorClass,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder: string;
  colorClass?: string;
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm hover:border-gray-300 transition-colors ${colorClass || 'text-gray-700'}`}
      >
        <span>{selectedLabel}</span>
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]">
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

// 店铺多选组件
function ShopMultiSelect({
  shops,
  selectedShops,
  onChange,
  availableShops,
}: {
  shops: string[];
  selectedShops: string[];
  onChange: (shops: string[]) => void;
  availableShops: Shop[];
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = selectedShops.length === 0 || selectedShops.includes('all')
    ? '全部'
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 transition-colors"
      >
        <span>{selectedLabel}</span>
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
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

export default function OrderToolbar({
  filters,
  onFiltersChange,
  selectedOrderIds,
  onNewPurchase,
}: OrderToolbarProps) {
  const [localKeyword, setLocalKeyword] = useState(filters.keyword);
  const [availableShops] = useState<Shop[]>([
    { id: 'shop1', name: '店铺A' },
    { id: 'shop2', name: '店铺B' },
  ]);

  // Debounce搜索输入
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localKeyword !== filters.keyword) {
        onFiltersChange({ ...filters, keyword: localKeyword });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localKeyword]);

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-100">
      {/* 搜索框 */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={localKeyword}
          onChange={e => setLocalKeyword(e.target.value)}
          placeholder="搜索订单号、SKU、商品名…"
          className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 transition-colors"
        />
      </div>

      {/* 筛选下拉 */}
      <DropdownSelect
        value={filters.urgency}
        options={URGENCY_OPTIONS}
        onChange={value => onFiltersChange({ ...filters, urgency: value as ToolbarFilters['urgency'] })}
        placeholder="紧急度"
        colorClass={filters.urgency !== 'all' ? URGENCY_COLORS[filters.urgency] : undefined}
      />

      <DropdownSelect
        value={filters.timeRange}
        options={TIME_RANGE_OPTIONS}
        onChange={value => onFiltersChange({ ...filters, timeRange: value as ToolbarFilters['timeRange'] })}
        placeholder="时间范围"
      />

      <ShopMultiSelect
        shops={filters.shops}
        selectedShops={filters.shops}
        onChange={shops => onFiltersChange({ ...filters, shops })}
        availableShops={availableShops}
      />

      {/* 右侧按钮组 */}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onNewPurchase}
          disabled={selectedOrderIds.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>新建采购</span>
        </button>
      </div>
    </div>
  );
}
