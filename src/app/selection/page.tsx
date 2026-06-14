'use client';

import { useState, useCallback, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Filter,
  ChevronDown,
  RefreshCw,
  Download,
  Settings2,
  TrendingUp,
  TrendingDown,
  Minus,
  Lock,
  Sparkles,
  Grid3X3,
  Tag,
  Store,
  Building2,
  Package,
  Database,
  Bot,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ Types ============

type TabType = 'hot-ranking' | 'hot-words' | 'hot-tags' | 'hot-categories' | 'hot-shops' | 'hot-brands' | 'product-library';

type Platform = 'ozon' | 'wb' | 'all';

type SelectionMode = 'sales-spike' | 'potential-market' | 'unmet-demand' | 'no-stock-pressure' | 'engine-recommend' | 'custom';

interface FilterConfig {
  category?: string;
  priceMin?: number;
  priceMax?: number;
  salesMin?: number;
  salesMax?: number;
  reviewMin?: number;
  ratingMin?: number;
}

// ============ Constants ============

const TABS: { id: TabType; label: string; icon: React.ReactNode; separator?: boolean }[] = [
  { id: 'hot-ranking', label: '热销榜单', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'hot-words', label: '市场热词', icon: <Search className="w-4 h-4" /> },
  { id: 'hot-tags', label: '热销标签', icon: <Tag className="w-4 h-4" /> },
  { id: 'hot-categories', label: '热销类目', icon: <Grid3X3 className="w-4 h-4" /> },
  { id: 'hot-shops', label: '热销店铺', icon: <Store className="w-4 h-4" /> },
  { id: 'hot-brands', label: '热销品牌', icon: <Building2 className="w-4 h-4" /> },
  { id: 'product-library', label: '产品库', icon: <Database className="w-4 h-4" />, separator: true },
];

const SELECTION_MODES: { id: SelectionMode; label: string; locked?: boolean }[] = [
  { id: 'sales-spike', label: '销量飙升榜' },
  { id: 'potential-market', label: '潜力市场' },
  { id: 'unmet-demand', label: '未被满足' },
  { id: 'no-stock-pressure', label: '不压库存' },
  { id: 'engine-recommend', label: '引擎推荐', locked: true },
  { id: 'custom', label: '自定义' },
];

const MOCK_DATA = Array.from({ length: 20 }, (_, i) => ({
  id: `item-${i}`,
  title: `商品标题 ${i + 1} - 热销爆款优质商品`,
  image: `https://picsum.photos/seed/${i + 100}/200/200`,
  sku: `SKU${String(100000 + i).padStart(7, '0')}`,
  price: Math.floor(Math.random() * 5000) + 500,
  originalPrice: Math.floor(Math.random() * 8000) + 1000,
  sales: Math.floor(Math.random() * 10000),
  rating: (Math.random() * 2 + 3).toFixed(1),
  reviews: Math.floor(Math.random() * 5000),
  seller: i % 2 === 0 ? 'Ozon官方店' : '第三方卖家',
  platform: i % 3 === 0 ? 'wb' : 'ozon',
  isHot: i < 5,
  isNew: i >= 15 && i < 18,
  aiScore: null as number | null,
}));

// ============ Components ============

function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}) {
  return (
    <div className="bg-white border-b border-[#E6EAF2] sticky top-0 z-10">
      <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto">
        {TABS.map((tab) => (
          <div key={tab.id} className="flex items-center">
            {tab.separator && (
              <div className="w-px h-6 bg-[#E6EAF2] mx-2" />
            )}
            <button
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-colors',
                activeTab === tab.id
                  ? 'bg-[#1677FF]/10 text-[#1677FF]'
                  : 'text-[#637089] hover:bg-[#F3F4F6] hover:text-[#1F2937]'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformSwitch({
  value,
  onChange,
}: {
  value: Platform;
  onChange: (v: Platform) => void;
}) {
  return (
    <div className="flex items-center gap-2 p-1 bg-[#F3F4F6] rounded-lg w-fit">
      <button
        onClick={() => onChange('all')}
        className={cn(
          'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
          value === 'all'
            ? 'bg-white text-[#1F2937] shadow-sm'
            : 'text-[#637089] hover:text-[#1F2937]'
        )}
      >
        全部
      </button>
      <button
        onClick={() => onChange('ozon')}
        className={cn(
          'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
          value === 'ozon'
            ? 'bg-white text-[#005BFF] shadow-sm'
            : 'text-[#637089] hover:text-[#005BFF]'
        )}
      >
        <div className="w-3 h-3 rounded-full bg-[#005BFF]" />
        Ozon
      </button>
      <button
        onClick={() => onChange('wb')}
        className={cn(
          'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
          value === 'wb'
            ? 'bg-white text-[#E31E24] shadow-sm'
            : 'text-[#637089] hover:text-[#E31E24]'
        )}
      >
        <div className="w-3 h-3 rounded-full bg-[#E31E24]" />
        Wildberries
      </button>
    </div>
  );
}

function SelectionModeSelector({
  value,
  onChange,
}: {
  value: SelectionMode;
  onChange: (v: SelectionMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-[#637089]">推荐模式：</span>
      {SELECTION_MODES.map((mode) => (
        <button
          key={mode.id}
          onClick={() => !mode.locked && onChange(mode.id)}
          disabled={mode.locked}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
            mode.locked
              ? 'bg-[#F9FAFB] text-[#9CA3AF] border-[#E5E7EB] cursor-not-allowed'
              : value === mode.id
                ? 'bg-[#1677FF] text-white border-[#1677FF]'
                : 'bg-white text-[#4B5563] border-[#E5E7EB] hover:border-[#1677FF] hover:text-[#1677FF]'
          )}
        >
          {mode.id === 'engine-recommend' && <Bot className="w-3 h-3" />}
          {mode.label}
          {mode.locked && <Lock className="w-3 h-3" />}
        </button>
      ))}
    </div>
  );
}

function FilterSection({
  filters,
  onChange,
  onReset,
}: {
  filters: FilterConfig;
  onChange: (f: FilterConfig) => void;
  onReset: () => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-[#E6EAF2] p-4">
      {/* 基础筛选 - 单行 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-[#637089] whitespace-nowrap">类目</Label>
          <Select
            value={filters.category}
            onValueChange={(v) => onChange({ ...filters, category: v })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="全部分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              <SelectItem value="electronics">电子产品</SelectItem>
              <SelectItem value="clothing">服装</SelectItem>
              <SelectItem value="home">家居用品</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-[#637089] whitespace-nowrap">售价</Label>
          <Input
            type="number"
            placeholder="最低"
            value={filters.priceMin || ''}
            onChange={(e) => onChange({ ...filters, priceMin: Number(e.target.value) })}
            className="w-24"
          />
          <span className="text-[#9CA3AF]">-</span>
          <Input
            type="number"
            placeholder="最高"
            value={filters.priceMax || ''}
            onChange={(e) => onChange({ ...filters, priceMax: Number(e.target.value) })}
            className="w-24"
          />
          <span className="text-sm text-[#637089]">₽</span>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-[#637089] whitespace-nowrap">销量</Label>
          <Input
            type="number"
            placeholder="最低"
            value={filters.salesMin || ''}
            onChange={(e) => onChange({ ...filters, salesMin: Number(e.target.value) })}
            className="w-24"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-[#637089] whitespace-nowrap">评论数</Label>
          <Input
            type="number"
            placeholder="最低"
            value={filters.reviewMin || ''}
            onChange={(e) => onChange({ ...filters, reviewMin: Number(e.target.value) })}
            className="w-24"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-[#637089] whitespace-nowrap">评分</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="5"
            placeholder="最低"
            value={filters.ratingMin || ''}
            onChange={(e) => onChange({ ...filters, ratingMin: Number(e.target.value) })}
            className="w-20"
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[#637089]"
        >
          进阶筛选
          <ChevronDown className={cn('w-4 h-4 ml-1 transition-transform', showAdvanced && 'rotate-180')} />
        </Button>
      </div>

      {/* 进阶筛选 */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-[#E6EAF2] grid grid-cols-3 gap-4">
          <div>
            <Label className="text-sm text-[#637089] block mb-2">利润率筛选</Label>
            <Slider defaultValue={[0, 50]} max={100} step={1} className="w-full" />
            <div className="flex justify-between text-xs text-[#9CA3AF] mt-1">
              <span>0%</span>
              <span>50%</span>
            </div>
          </div>
          <div>
            <Label className="text-sm text-[#637089] block mb-2">配送方式</Label>
            <Select defaultValue="all">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="fbo">FBO</SelectItem>
                <SelectItem value="fbs">FBS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm text-[#637089] block mb-2">卖家类型</Label>
            <Select defaultValue="all">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="local">本土卖家</SelectItem>
                <SelectItem value="cross">跨境卖家</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#E6EAF2]">
        <Button variant="ghost" size="sm" onClick={onReset} className="text-[#637089]">
          重置
        </Button>
        <Button size="sm" className="bg-[#1677FF] hover:bg-[#1668E0]">
          <Search className="w-4 h-4 mr-1" />
          查询
        </Button>
      </div>
    </div>
  );
}

function DataTable({
  data,
  selectedIds,
  onSelectionChange,
  onCollect,
}: {
  data: typeof MOCK_DATA;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onCollect: (id: string) => void;
}) {
  const allSelected = data.length > 0 && data.every((item) => selectedIds.has(item.id));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map((item) => item.id)));
    }
  };

  const toggleOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange(newSet);
  };

  return (
    <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-[#E6EAF2]">
              <th className="w-10 px-4 py-3">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">商品</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">SKU</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[#637089] uppercase tracking-wider">售价</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[#637089] uppercase tracking-wider">销量</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[#637089] uppercase tracking-wider">评分</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[#637089] uppercase tracking-wider">评论数</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">卖家</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[#637089] uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1">
                  <Bot className="w-3 h-3" />
                  引擎评分
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[#637089] uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {data.map((item, index) => (
              <tr key={item.id} className="hover:bg-[#FAFBFC] transition-colors">
                <td className="px-4 py-3">
                  <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleOne(item.id)} />
                </td>
                <td className="px-4 py-3 text-sm text-[#9CA3AF]">{index + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-12 h-12 rounded-lg object-cover bg-[#F3F4F6]"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1F2937] truncate max-w-[200px]">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {item.platform === 'ozon' ? (
                          <span className="px-1.5 py-0.5 bg-[#005BFF]/10 text-[#005BFF] text-xs rounded">Ozon</span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-[#E31E24]/10 text-[#E31E24] text-xs rounded">WB</span>
                        )}
                        {item.isHot && (
                          <span className="px-1.5 py-0.5 bg-[#F43F5E]/10 text-[#F43F5E] text-xs rounded">HOT</span>
                        )}
                        {item.isNew && (
                          <span className="px-1.5 py-0.5 bg-[#1677FF]/10 text-[#1677FF] text-xs rounded">NEW</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[#637089] font-mono">{item.sku}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-semibold text-[#1F2937]">{item.price.toLocaleString()}₽</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-sm font-medium text-[#1F2937]">{item.sales.toLocaleString()}</span>
                    {index % 3 === 0 ? (
                      <TrendingUp className="w-3 h-3 text-[#10B981]" />
                    ) : index % 3 === 1 ? (
                      <TrendingDown className="w-3 h-3 text-[#EF4444]" />
                    ) : (
                      <Minus className="w-3 h-3 text-[#9CA3AF]" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-sm font-medium text-[#1F2937]">{item.rating}</span>
                    <span className="text-[#F59E0B]">★</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm text-[#637089]">{item.reviews.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-[#637089]">{item.seller}</td>
                <td className="px-4 py-3 text-center">
                  <div className="group relative inline-flex items-center justify-center">
                    <span className="text-sm text-[#9CA3AF] cursor-help">—</span>
                    <div className="absolute bottom-full mb-2 px-2 py-1 bg-[#152033] text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      引擎评分即将上线
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[#1677FF] border-[#1677FF]/30 hover:bg-[#1677FF]/10"
                    onClick={() => onCollect(item.id)}
                  >
                    采集
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pagination({
  current,
  total,
  pageSize,
  onChange,
}: {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (current <= 3) return i + 1;
    if (current >= totalPages - 2) return totalPages - 4 + i;
    return current - 2 + i;
  });

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-[#E6EAF2]">
      <div className="text-sm text-[#637089]">
        共 <span className="font-medium text-[#1F2937]">{total.toLocaleString()}</span> 条结果
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={current === 1}
          onClick={() => onChange(current - 1)}
          className="border-[#E5E7EB]"
        >
          上一页
        </Button>
        {pages.map((page) => (
          <Button
            key={page}
            variant={current === page ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(page)}
            className={cn(
              'w-9',
              current === page ? 'bg-[#1677FF] hover:bg-[#1668E0]' : 'border-[#E5E7EB]'
            )}
          >
            {page}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={current === totalPages}
          onClick={() => onChange(current + 1)}
          className="border-[#E5E7EB]"
        >
          下一页
        </Button>
      </div>
      <div className="flex items-center gap-2 text-sm text-[#637089]">
        每页
        <Select value={String(pageSize)} onValueChange={(v) => onChange(1)}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
        条
      </div>
    </div>
  );
}

function BatchActionBar({
  selectedCount,
  onCollect,
  onAddToLibrary,
  onExport,
  onClear,
}: {
  selectedCount: number;
  onCollect: () => void;
  onAddToLibrary: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-[#152033] rounded-xl shadow-lg z-50">
      <span className="text-white text-sm">
        已选择 <span className="font-semibold">{selectedCount}</span> 件商品
      </span>
      <div className="w-px h-5 bg-white/20" />
      <Button
        size="sm"
        className="bg-[#1677FF] hover:bg-[#1668E0] text-white"
        onClick={onCollect}
      >
        <Download className="w-4 h-4 mr-1" />
        批量采集
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-white/30 text-white hover:bg-white/10"
        onClick={onAddToLibrary}
      >
        <Package className="w-4 h-4 mr-1" />
        加入产品库
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-white/30 text-white hover:bg-white/10"
        onClick={onExport}
      >
        <Download className="w-4 h-4 mr-1" />
        导出
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-white/70 hover:text-white hover:bg-white/10"
        onClick={onClear}
      >
        取消
      </Button>
    </div>
  );
}

function EmptyState({ tab }: { tab: TabType }) {
  const messages: Record<TabType, { title: string; description: string }> = {
    'hot-ranking': { title: '暂无热销榜单数据', description: '系统正在采集热门商品数据，请稍后再试' },
    'hot-words': { title: '暂无市场热词数据', description: '系统正在分析热搜关键词，请稍后再试' },
    'hot-tags': { title: '暂无热销标签数据', description: '系统正在统计热门标签，请稍后再试' },
    'hot-categories': { title: '暂无热销类目数据', description: '系统正在分析类目趋势，请稍后再试' },
    'hot-shops': { title: '暂无热销店铺数据', description: '系统正在追踪热门店铺，请稍后再试' },
    'hot-brands': { title: '暂无热销品牌数据', description: '系统正在分析品牌热度，请稍后再试' },
    'product-library': { title: '产品库为空', description: '从选品列表中添加商品到产品库，开始构建您的商品集合' },
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-[#E6EAF2]">
      <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-4">
        <Package className="w-8 h-8 text-[#9CA3AF]" />
      </div>
      <h3 className="text-lg font-medium text-[#1F2937] mb-2">{messages[tab].title}</h3>
      <p className="text-sm text-[#637089] mb-6">{messages[tab].description}</p>
      {tab === 'product-library' && (
        <Button className="bg-[#1677FF] hover:bg-[#1668E0]">
          <Sparkles className="w-4 h-4 mr-2" />
          去选品
        </Button>
      )}
    </div>
  );
}

// ============ Main Component ============

export default function SelectionPage() {
  const [activeTab, setActiveTab] = useState<TabType>('hot-ranking');
  const [platform, setPlatform] = useState<Platform>('all');
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('sales-spike');
  const [filters, setFilters] = useState<FilterConfig>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = useCallback(() => {
    setFilters({});
  }, []);

  const handleCollect = useCallback((id: string) => {
    console.log('Collecting item:', id);
    // 实现采集逻辑
  }, []);

  const handleBatchCollect = useCallback(() => {
    console.log('Batch collecting:', Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds]);

  const tabLabel = TABS.find((t) => t.id === activeTab)?.label || '选品';

  return (
    <AppLayout
      title="选品"
      subtitle={`${tabLabel} - 发现市场机会`}
    >
      <div className="space-y-4">
        {/* Tab切换 */}
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* 平台切换 */}
        <div className="flex items-center justify-between">
          <PlatformSwitch value={platform} onChange={setPlatform} />
          <Button variant="outline" size="sm" className="border-[#E5E7EB]">
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新数据
          </Button>
        </div>

        {/* 推荐模式 */}
        <SelectionModeSelector value={selectionMode} onChange={setSelectionMode} />

        {/* 筛选区 */}
        <FilterSection filters={filters} onChange={setFilters} onReset={handleReset} />

        {/* 数据表格 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-[#E6EAF2]">
            <Loader2 className="w-8 h-8 text-[#1677FF] animate-spin" />
          </div>
        ) : MOCK_DATA.length > 0 ? (
          <>
            <DataTable
              data={MOCK_DATA}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onCollect={handleCollect}
            />
            <Pagination
              current={currentPage}
              total={1000}
              pageSize={20}
              onChange={setCurrentPage}
            />
          </>
        ) : (
          <EmptyState tab={activeTab} />
        )}

        {/* 批量操作栏 */}
        <BatchActionBar
          selectedCount={selectedIds.size}
          onCollect={handleBatchCollect}
          onAddToLibrary={() => {}}
          onExport={() => {}}
          onClear={() => setSelectedIds(new Set())}
        />
      </div>
    </AppLayout>
  );
}
