'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Filter,
  Download,
  Star,
  MoreVertical,
  ShoppingCart,
  Database,
  Package,
  Lock,
  X,
  ChevronDown,
  Plus,
  BarChart3,
  Tag,
  Store,
  Award,
} from 'lucide-react';

// ============================================================================
// 类型定义
// ============================================================================

type TabId = 'hot-ranking' | 'hot-keywords' | 'hot-tags' | 'hot-categories' | 'hot-shops' | 'hot-brands' | 'products';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  separator?: boolean;
}

interface FilterConfig {
  id: string;
  label: string;
  type: 'select' | 'range' | 'text' | 'switch';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface ColumnConfig {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface BatchAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant?: 'default' | 'outline';
}

// ============================================================================
// 常量定义
// ============================================================================

const TABS: Tab[] = [
  { id: 'hot-ranking', label: '热销榜单', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'hot-keywords', label: '市场热词', icon: <Search className="w-4 h-4" /> },
  { id: 'hot-tags', label: '热销标签', icon: <Tag className="w-4 h-4" /> },
  { id: 'hot-categories', label: '热销类目', icon: <Package className="w-4 h-4" /> },
  { id: 'hot-shops', label: '热销店铺', icon: <Store className="w-4 h-4" /> },
  { id: 'hot-brands', label: '热销品牌', icon: <Award className="w-4 h-4" />, separator: true },
  { id: 'products', label: '产品库', icon: <Database className="w-4 h-4" /> },
];

// 热销榜单筛选
const HOT_RANKING_FILTERS: FilterConfig[] = [
  { id: 'category', label: '类目', type: 'select', options: [
    { value: '', label: '全部分目' },
    { value: 'electronics', label: '电子产品' },
    { value: 'clothing', label: '服装' },
    { value: 'home', label: '家居' },
  ]},
  { id: 'price', label: '售价', type: 'range' },
  { id: 'sales', label: '销量', type: 'range' },
  { id: 'reviews', label: '评论数', type: 'range' },
  { id: 'rating', label: '评分', type: 'range' },
];

// 市场热词筛选
const HOT_KEYWORDS_FILTERS: FilterConfig[] = [
  { id: 'searchVolume', label: '月搜热度', type: 'range' },
  { id: 'growth', label: '月搜增长', type: 'range' },
  { id: 'competitors', label: '竞对数', type: 'range' },
  { id: 'products', label: '竞品数', type: 'range' },
  { id: 'visibility', label: '商品可见度', type: 'range' },
  { id: 'marketSpace', label: '市场空间', type: 'select', options: [
    { value: '', label: '全部' },
    { value: 'large', label: '大' },
    { value: 'medium', label: '中' },
    { value: 'small', label: '小' },
  ]},
];

// 热销标签筛选
const HOT_TAGS_FILTERS: FilterConfig[] = [
  { id: 'matchType', label: '标签匹配', type: 'select', options: [
    { value: '', label: '全部' },
    { value: 'exact', label: '精准匹配' },
    { value: 'fuzzy', label: '模糊匹配' },
  ]},
  { id: 'category', label: '类目', type: 'select', options: [
    { value: '', label: '全部分目' },
    { value: 'electronics', label: '电子产品' },
    { value: 'clothing', label: '服装' },
  ]},
];

// 热销类目筛选
const HOT_CATEGORIES_FILTERS: FilterConfig[] = [
  { id: 'level', label: '类目层级', type: 'select', options: [
    { value: '', label: '全部' },
    { value: '1', label: '一级类目' },
    { value: '2', label: '二级类目' },
    { value: '3', label: '三级类目' },
  ]},
  { id: 'salesGrowth', label: '销售额增长率', type: 'range' },
  { id: 'avgSales', label: '平均销售额', type: 'range' },
];

// 热销店铺筛选
const HOT_SHOPS_FILTERS: FilterConfig[] = [
  { id: 'rating', label: '店铺评分', type: 'range' },
  { id: 'openDays', label: '开店时长', type: 'select', options: [
    { value: '', label: '全部' },
    { value: '30', label: '30天内' },
    { value: '180', label: '半年内' },
    { value: '365', label: '一年内' },
  ]},
  { id: 'crossBorder', label: '仅看跨境', type: 'switch' },
];

// 热销品牌筛选
const HOT_BRANDS_FILTERS: FilterConfig[] = [
  { id: 'category', label: '品牌类目', type: 'select', options: [
    { value: '', label: '全部分目' },
    { value: 'electronics', label: '电子产品' },
    { value: 'clothing', label: '服装' },
  ]},
  { id: 'brandRating', label: '品牌评分', type: 'range' },
];

// 热销榜单列
const HOT_RANKING_COLUMNS: ColumnConfig[] = [
  { key: 'rank', label: '#', width: '60px', align: 'center' },
  { key: 'image', label: '图片', width: '80px', align: 'center' },
  { key: 'title', label: '商品标题' },
  { key: 'sku', label: 'SKU', width: '120px' },
  { key: 'price', label: '售价', width: '100px', align: 'right' },
  { key: 'salesVolume', label: '销量', width: '100px', align: 'right' },
  { key: 'rating', label: '评分', width: '80px', align: 'center' },
  { key: 'engineScore', label: '引擎评分', width: '100px', align: 'center' },
  { key: 'actions', label: '操作', width: '80px', align: 'center' },
];

// 市场热词列
const HOT_KEYWORDS_COLUMNS: ColumnConfig[] = [
  { key: 'keyword', label: '关键词' },
  { key: 'monthlySearches', label: '月搜热度', width: '100px', align: 'right' },
  { key: 'searchGrowth', label: '月搜增长', width: '100px', align: 'right' },
  { key: 'competitorCount', label: '竞对数', width: '100px', align: 'right' },
  { key: 'productCount', label: '竞品数', width: '100px', align: 'right' },
  { key: 'visibility', label: '商品可见度', width: '120px', align: 'right' },
  { key: 'marketSpace', label: '市场空间', width: '100px', align: 'center' },
  { key: 'actions', label: '操作', width: '120px', align: 'center' },
];

// 热销标签列
const HOT_TAGS_COLUMNS: ColumnConfig[] = [
  { key: 'tag', label: '标签' },
  { key: 'productCount', label: '关联商品数', width: '120px', align: 'right' },
  { key: 'avgPrice', label: '平均售价', width: '100px', align: 'right' },
  { key: 'avgSales', label: '平均销量', width: '100px', align: 'right' },
  { key: 'avgRating', label: '平均评分', width: '100px', align: 'right' },
];

// 热销类目列
const HOT_CATEGORIES_COLUMNS: ColumnConfig[] = [
  { key: 'category', label: '类目' },
  { key: 'salesVolume', label: '销量', width: '100px', align: 'right' },
  { key: 'avgPrice', label: '平均价格', width: '100px', align: 'right' },
  { key: 'revenue', label: '销售额', width: '120px', align: 'right' },
  { key: 'growth', label: '增长率', width: '100px', align: 'right' },
  { key: 'sellerCount', label: '商家数', width: '100px', align: 'right' },
];

// 热销店铺列
const HOT_SHOPS_COLUMNS: ColumnConfig[] = [
  { key: 'shopName', label: '店铺名' },
  { key: 'salesVolume', label: '销量', width: '100px', align: 'right' },
  { key: 'revenue', label: '销售额', width: '120px', align: 'right' },
  { key: 'growth', label: '增长率', width: '100px', align: 'right' },
  { key: 'rating', label: '评分', width: '80px', align: 'right' },
  { key: 'productCount', label: '商品数', width: '100px', align: 'right' },
  { key: 'openDays', label: '开店时长', width: '100px', align: 'center' },
];

// 热销品牌列
const HOT_BRANDS_COLUMNS: ColumnConfig[] = [
  { key: 'brand', label: '品牌' },
  { key: 'category', label: '类目', width: '120px' },
  { key: 'productCount', label: '商品数', width: '100px', align: 'right' },
  { key: 'totalSales', label: '总销量', width: '100px', align: 'right' },
  { key: 'totalRevenue', label: '总销售额', width: '120px', align: 'right' },
  { key: 'avgRating', label: '平均评分', width: '100px', align: 'right' },
];

// Tab配置映射
const TAB_CONFIGS: Record<TabId, {
  filters: FilterConfig[];
  columns: ColumnConfig[];
  batchActions: BatchAction[];
  defaultMode?: string;
}> = {
  'hot-ranking': {
    filters: HOT_RANKING_FILTERS,
    columns: HOT_RANKING_COLUMNS,
    batchActions: [
      { id: 'collect', label: '批量采集', icon: <ShoppingCart className="w-4 h-4" /> },
      { id: 'add', label: '加入产品库', icon: <Database className="w-4 h-4" /> },
      { id: 'export', label: '导出', icon: <Download className="w-4 h-4" />, variant: 'outline' as const },
    ],
    defaultMode: 'surge',
  },
  'hot-keywords': {
    filters: HOT_KEYWORDS_FILTERS,
    columns: HOT_KEYWORDS_COLUMNS,
    batchActions: [
      { id: 'add-to-library', label: '添加到词库', icon: <Plus className="w-4 h-4" /> },
      { id: 'export', label: '导出', icon: <Download className="w-4 h-4" />, variant: 'outline' as const },
    ],
    defaultMode: 'search-volume',
  },
  'hot-tags': {
    filters: HOT_TAGS_FILTERS,
    columns: HOT_TAGS_COLUMNS,
    batchActions: [
      { id: 'export', label: '导出', icon: <Download className="w-4 h-4" />, variant: 'outline' as const },
    ],
  },
  'hot-categories': {
    filters: HOT_CATEGORIES_FILTERS,
    columns: HOT_CATEGORIES_COLUMNS,
    batchActions: [
      { id: 'customize', label: '自定义类目', icon: <Plus className="w-4 h-4" /> },
      { id: 'export', label: '导出', icon: <Download className="w-4 h-4" />, variant: 'outline' as const },
    ],
  },
  'hot-shops': {
    filters: HOT_SHOPS_FILTERS,
    columns: HOT_SHOPS_COLUMNS,
    batchActions: [
      { id: 'export', label: '导出', icon: <Download className="w-4 h-4" />, variant: 'outline' as const },
    ],
    defaultMode: 'potential',
  },
  'hot-brands': {
    filters: HOT_BRANDS_FILTERS,
    columns: HOT_BRANDS_COLUMNS,
    batchActions: [
      { id: 'export', label: '导出', icon: <Download className="w-4 h-4" />, variant: 'outline' as const },
    ],
  },
  'products': {
    filters: [
      { id: 'group', label: '收藏分组', type: 'select', options: [
        { value: '', label: '全部' },
        { value: 'favorites', label: '我的收藏' },
        { value: 'watching', label: '我关注的' },
      ]},
      { id: 'status', label: '认领状态', type: 'select', options: [
        { value: '', label: '全部' },
        { value: 'pending', label: '待认领' },
        { value: 'claimed', label: '已认领' },
      ]},
      { id: 'platform', label: '平台', type: 'select', options: [
        { value: '', label: '全部' },
        { value: 'ozon', label: 'Ozon' },
        { value: 'wb', label: 'Wildberries' },
      ]},
    ],
    columns: HOT_RANKING_COLUMNS,
    batchActions: [
      { id: 'group', label: '分组管理', icon: <Package className="w-4 h-4" /> },
      { id: 'compare', label: '批量对比', icon: <BarChart3 className="w-4 h-4" /> },
      { id: 'publish', label: '批量发布', icon: <Database className="w-4 h-4" /> },
    ],
  },
};

// ============================================================================
// Tab栏组件
// ============================================================================

function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <div className="bg-white border-b border-[#E6EAF2] sticky top-0 z-10">
      <div className="px-6">
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as TabId)}>
          <TabsList className="h-12 bg-transparent gap-0">
            {TABS.map((tab, index) => (
              <div key={tab.id} className="flex items-center">
                {index > 0 && !TABS[index - 1].separator && tab.separator && (
                  <div className="w-px h-6 bg-[#E6EAF2] mx-2" />
                )}
                <TabsTrigger
                  value={tab.id}
                  className={`h-12 px-4 data-[state=active]:text-[#1677FF] data-[state=active]:border-b-2 data-[state=active]:border-[#1677FF] data-[state=active]:shadow-none rounded-none bg-transparent ${tab.separator ? 'ml-2' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    {tab.icon}
                    {tab.label}
                  </span>
                </TabsTrigger>
              </div>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================================
// 平台切换组件
// ============================================================================

function PlatformSwitch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const platforms = [
    { value: 'all', label: '全部平台' },
    { value: 'ozon', label: 'Ozon' },
    { value: 'wb', label: 'Wildberries' },
  ];

  return (
    <div className="flex items-center gap-2">
      {platforms.map((p) => (
        <Button
          key={p.value}
          variant={value === p.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(p.value)}
          className={value === p.value ? 'bg-[#1677FF] hover:bg-[#1668E0]' : ''}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}

// ============================================================================
// 推荐模式选择器
// ============================================================================

function SelectionModeSelector({
  value,
  onChange,
  tabId,
}: {
  value: string;
  onChange: (value: string) => void;
  tabId: TabId;
}) {
  const modes = [
    { id: 'surge', label: '销量飙升榜', emoji: '📈' },
    { id: 'potential', label: '潜力市场', emoji: '🎯' },
    { id: 'unsatisfied', label: '未被满足', emoji: '💡' },
    { id: 'low-stock', label: '不压库存', emoji: '📦' },
    { id: 'engine', label: '引擎推荐', emoji: '🤖', locked: true },
  ];

  // 产品库Tab不显示推荐模式
  if (tabId === 'products') return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[#637089]">推荐模式：</span>
      <div className="flex flex-wrap gap-2">
        {modes.map((mode) => (
          <Button
            key={mode.id}
            variant={value === mode.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => !mode.locked && onChange(mode.id)}
            disabled={mode.locked}
            className={`${value === mode.id ? 'bg-[#1677FF] hover:bg-[#1668E0]' : ''} ${mode.locked ? 'opacity-60 cursor-not-allowed' : ''}`}
            title={mode.locked ? '即将上线' : mode.label}
          >
            {mode.emoji} {mode.label}
            {mode.locked && <Lock className="w-3 h-3 ml-1" />}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 筛选区组件
// ============================================================================

function FilterSection({
  filters,
  onChange,
  onReset,
  onSearch,
}: {
  filters: Record<string, unknown>;
  onChange: (filters: Record<string, unknown>) => void;
  onReset: () => void;
  onSearch: () => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const tabConfig = TAB_CONFIGS[filters._tab as TabId] || TAB_CONFIGS['hot-ranking'];
  const tabFilters = tabConfig.filters;

  return (
    <Card>
      <CardContent className="p-4">
        {/* 基础筛选 */}
        <div className="grid grid-cols-5 gap-4">
          {tabFilters.slice(0, 5).map((filter) => (
            <div key={filter.id} className="space-y-1">
              <Label className="text-xs text-[#637089]">{filter.label}</Label>
              {filter.type === 'select' ? (
                <Select
                  value={filters[filter.id] as string}
                  onValueChange={(v) => onChange({ ...filters, [filter.id]: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={filter.placeholder || '请选择'} />
                  </SelectTrigger>
                  <SelectContent>
                    {filter.options?.filter(opt => opt.value).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : filter.type === 'range' ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="最小"
                    className="h-9 w-24"
                    value={(filters[`${filter.id}Min`] as string) || ''}
                    onChange={(e) => onChange({ ...filters, [`${filter.id}Min`]: e.target.value })}
                  />
                  <span className="text-[#9CA3AF]">-</span>
                  <Input
                    type="number"
                    placeholder="最大"
                    className="h-9 w-24"
                    value={(filters[`${filter.id}Max`] as string) || ''}
                    onChange={(e) => onChange({ ...filters, [`${filter.id}Max`]: e.target.value })}
                  />
                </div>
              ) : filter.type === 'text' ? (
                <Input
                  placeholder={filter.placeholder || '请输入'}
                  className="h-9"
                  value={(filters[filter.id] as string) || ''}
                  onChange={(e) => onChange({ ...filters, [filter.id]: e.target.value })}
                />
              ) : filter.type === 'switch' ? (
                <div className="flex items-center h-9">
                  <Checkbox
                    checked={filters[filter.id] as boolean}
                    onCheckedChange={(v) => onChange({ ...filters, [filter.id]: v })}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* 进阶筛选 */}
        {tabFilters.length > 5 && (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[#1677FF] hover:text-[#1668E0] p-0"
            >
              进阶筛选
              <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </Button>

            {showAdvanced && (
              <div className="mt-3 pt-3 border-t border-[#E6EAF2] grid grid-cols-5 gap-4">
                {tabFilters.slice(5).map((filter) => (
                  <div key={filter.id} className="space-y-1">
                    <Label className="text-xs text-[#637089]">{filter.label}</Label>
                    {filter.type === 'select' ? (
                      <Select
                        value={(filters[filter.id] as string) || ''}
                        onValueChange={(v) => onChange({ ...filters, [filter.id]: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={filter.placeholder || '请选择'} />
                        </SelectTrigger>
                        <SelectContent>
                          {filter.options?.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : filter.type === 'range' ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="最小"
                          className="h-9 w-24"
                          value={(filters[`${filter.id}Min`] as string) || ''}
                          onChange={(e) => onChange({ ...filters, [`${filter.id}Min`]: e.target.value })}
                        />
                        <span className="text-[#9CA3AF]">-</span>
                        <Input
                          type="number"
                          placeholder="最大"
                          className="h-9 w-24"
                          value={(filters[`${filter.id}Max`] as string) || ''}
                          onChange={(e) => onChange({ ...filters, [`${filter.id}Max`]: e.target.value })}
                        />
                      </div>
                    ) : filter.type === 'text' ? (
                      <Input
                        placeholder={filter.placeholder || '请输入'}
                        className="h-9"
                        value={(filters[filter.id] as string) || ''}
                        onChange={(e) => onChange({ ...filters, [filter.id]: e.target.value })}
                      />
                    ) : filter.type === 'switch' ? (
                      <div className="flex items-center h-9">
                        <Checkbox
                          checked={filters[filter.id] as boolean}
                          onCheckedChange={(v) => onChange({ ...filters, [filter.id]: v })}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onReset}>
            重置
          </Button>
          <Button size="sm" onClick={onSearch} className="bg-[#1677FF] hover:bg-[#1668E0]">
            <Search className="w-4 h-4 mr-1" />
            查询
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 引擎评分预留列
// ============================================================================

function EngineScoreCell() {
  return (
    <div className="group relative">
      <span className="text-[#9CA3AF]">—</span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#1F2937] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        引擎评分即将上线
      </div>
    </div>
  );
}

// ============================================================================
// 主页面组件
// ============================================================================

export default function SelectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState<TabId>(
    (searchParams.get('tab') as TabId) || 'hot-ranking'
  );
  const [platform, setPlatform] = useState('all');
  const [selectionMode, setSelectionMode] = useState('surge');
  const [filters, setFilters] = useState<Record<string, unknown>>({ _tab: activeTab });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // 批量操作处理
  const handleBatchAction = async (actionId: string) => {
    if (selectedIds.size === 0) {
      alert('请先选择商品');
      return;
    }

    const selectedItems = filteredData.filter(item => selectedIds.has((item as { id: number }).id));
    
    switch (actionId) {
      case 'collect':
        // 批量采集
        alert(`已发起采集 ${selectedItems.length} 件商品`);
        setSelectedIds(new Set());
        break;
      case 'addToLibrary':
        // 加入产品库
        alert(`已添加 ${selectedItems.length} 件商品到产品库`);
        setSelectedIds(new Set());
        break;
      case 'export':
        // 导出
        alert('正在导出数据...');
        break;
      case 'delete':
        // 删除
        if (confirm(`确定删除选中的 ${selectedItems.length} 件商品？`)) {
          alert(`已删除 ${selectedItems.length} 件商品`);
          setSelectedIds(new Set());
        }
        break;
      default:
        break;
    }
  };

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setFilters({ _tab: tab });
    setPage(1);
    setSelectedIds(new Set());
    // 更新URL
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
  }, []);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 热销榜单Tab调用推荐API
      if (activeTab === 'hot-ranking' && selectionMode) {
        const params = new URLSearchParams({
          mode: selectionMode,
          platform: platform,
          page: String(page),
          pageSize: String(pageSize),
        });
        const res = await fetch(`/api/selection/recommend?${params}`);
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data) {
            // 转换API数据格式为前端格式
            const apiData = result.data.items.map((item: {
              id: number;
              product_title?: string;
              sales_volume?: number;
              price?: number;
              rating?: number;
              growth_score?: number;
              growth_rate?: number;
              seller_count?: number;
              potential_score?: number;
              supply_demand_ratio?: number;
            }, idx: number) => ({
              id: item.id,
              rank: (page - 1) * pageSize + idx + 1,
              title: item.product_title || `商品 ${item.id}`,
              salesVolume: item.sales_volume || 0,
              price: item.price || 0,
              rating: item.rating || 0,
              // 模式特有字段
              growthScore: item.growth_score,
              growthRate: item.growth_rate,
              sellerCount: item.seller_count,
              potentialScore: item.potential_score,
              supplyDemandRatio: item.supply_demand_ratio,
            }));
            setData(apiData);
            // 更新总数
            setTotal(result.data.total || apiData.length);
            setLoading(false);
            return;
          }
        }
      }
      // 其他Tab使用模拟数据
      const mockData = generateMockData(activeTab);
      setData(mockData);
    } catch (error) {
      console.error('加载数据失败:', error);
      // 失败时降级到模拟数据
      const mockData = generateMockData(activeTab);
      setData(mockData);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectionMode, platform, page, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 生成模拟数据
  const generateMockData = (tab: TabId): Record<string, unknown>[] => {
    const count = 10;
    const result: Record<string, unknown>[] = [];

    for (let i = 0; i < count; i++) {
      const base = {
        id: i + 1,
        rank: i + 1,
      };

      switch (tab) {
        case 'hot-ranking':
          result.push({
            ...base,
            image: `https://picsum.photos/80/80?random=${i}`,
            title: `商品标题 ${i + 1}`,
            sku: `SKU${String(i + 1).padStart(6, '0')}`,
            price: Math.floor(Math.random() * 10000) + 1000,
            salesVolume: Math.floor(Math.random() * 1000) + 100,
            rating: (Math.random() * 2 + 3).toFixed(1),
          });
          break;
        case 'hot-keywords':
          result.push({
            ...base,
            keyword: `关键词${i + 1}`,
            monthlySearches: Math.floor(Math.random() * 100000),
            searchGrowth: (Math.random() * 200 - 50).toFixed(1),
            competitorCount: Math.floor(Math.random() * 100),
            productCount: Math.floor(Math.random() * 1000),
            visibility: (Math.random() * 100).toFixed(1),
            marketSpace: ['大', '中', '小'][Math.floor(Math.random() * 3)],
          });
          break;
        case 'hot-tags':
          result.push({
            ...base,
            tag: `#标签${i + 1}`,
            productCount: Math.floor(Math.random() * 10000),
            avgPrice: Math.floor(Math.random() * 5000) + 500,
            avgSales: Math.floor(Math.random() * 500),
            avgRating: (Math.random() * 2 + 3).toFixed(1),
          });
          break;
        case 'hot-categories':
          result.push({
            ...base,
            category: `类目${i + 1}`,
            salesVolume: Math.floor(Math.random() * 100000),
            avgPrice: Math.floor(Math.random() * 2000) + 200,
            revenue: Math.floor(Math.random() * 100000000),
            growth: (Math.random() * 100 - 20).toFixed(1),
            sellerCount: Math.floor(Math.random() * 5000),
          });
          break;
        case 'hot-shops':
          result.push({
            ...base,
            shopName: `店铺${i + 1}`,
            salesVolume: Math.floor(Math.random() * 100000),
            revenue: Math.floor(Math.random() * 100000000),
            growth: (Math.random() * 100 - 20).toFixed(1),
            rating: (Math.random() * 2 + 3).toFixed(1),
            productCount: Math.floor(Math.random() * 500),
            openDays: Math.floor(Math.random() * 1000) + 30,
          });
          break;
        case 'hot-brands':
          result.push({
            ...base,
            brand: `品牌${i + 1}`,
            category: `类目${i + 1}`,
            productCount: Math.floor(Math.random() * 5000),
            totalSales: Math.floor(Math.random() * 1000000),
            totalRevenue: Math.floor(Math.random() * 1000000000),
            avgRating: (Math.random() * 2 + 3).toFixed(1),
          });
          break;
        case 'products':
          result.push({
            ...base,
            image: `https://picsum.photos/80/80?random=${i + 100}`,
            title: `产品库商品 ${i + 1}`,
            sku: `PROD${String(i + 1).padStart(6, '0')}`,
            price: Math.floor(Math.random() * 10000) + 1000,
            salesVolume: Math.floor(Math.random() * 1000) + 100,
            rating: (Math.random() * 2 + 3).toFixed(1),
          });
          break;
        default:
          break;
      }
    }

    return result;
  };

  // 筛选数据
  const filteredData = useMemo(() => {
    return data;
  }, [data]);

  const handleViewDetail = useCallback((id: number) => {
    router.push(`/selection/${id}`);
  }, [router]);

  const handleResetFilters = useCallback(() => {
    setFilters({ _tab: activeTab });
  }, [activeTab]);

  const handleSearch = useCallback(() => {
    setPage(1);
    loadData();
  }, [loadData]);

  const tabConfig = TAB_CONFIGS[activeTab];
  const columns = tabConfig.columns;

  return (
    <AppLayout title="选品">
      <div className="min-h-screen bg-[#F5F7FA]">
        {/* 面包屑 */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#637089]">选品</span>
            <ChevronRight className="w-4 h-4 text-[#D1D5DB]" />
            <span className="text-[#1F2937] font-medium">
              {TABS.find((t) => t.id === activeTab)?.label}
            </span>
          </div>
        </div>

        {/* Tab栏 */}
        <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="p-6 space-y-4">
          {/* 平台切换 */}
          <PlatformSwitch value={platform} onChange={setPlatform} />

          {/* 推荐模式 */}
          <SelectionModeSelector value={selectionMode} onChange={setSelectionMode} tabId={activeTab} />

          {/* 筛选区 */}
          <FilterSection
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
            onSearch={handleSearch}
          />

          {/* 操作栏 */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-[#637089]">
              结果 <span className="font-medium text-[#1F2937]">{filteredData.length}</span> 条
              {selectedIds.size > 0 && (
                <span className="ml-2 text-[#1677FF]">已选 {selectedIds.size} 件</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {tabConfig.batchActions.map((action) => (
                <Button
                  key={action.id}
                  size="sm"
                  variant={action.variant || 'outline'}
                  disabled={selectedIds.size === 0 && action.id !== 'export'}
                  onClick={() => handleBatchAction(action.id)}
                  className={action.variant !== 'outline' ? 'bg-[#1677FF] hover:bg-[#1668E0]' : ''}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
              <Button size="sm" variant="outline">
                <Filter className="w-4 h-4 mr-1" />
                列设置
              </Button>
            </div>
          </div>

          {/* 数据表格 */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === filteredData.length && filteredData.length > 0}
                      onCheckedChange={(v) => {
                        if (v) {
                          setSelectedIds(new Set(filteredData.map((d) => d.id as number)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={col.align ? `text-${col.align}` : ''}
                      style={{ width: col.width }}
                    >
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="text-center py-8 text-[#637089]">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="w-12 h-12 text-[#D1D5DB]" />
                        <p className="text-[#637089]">暂无数据</p>
                        <p className="text-sm text-[#9CA3AF]">
                          {activeTab === 'products'
                            ? '使用Chrome插件采集商品，数据将自动出现在这里'
                            : '暂无相关数据，请尝试调整筛选条件'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((row) => (
                    <TableRow
                      key={row.id as number}
                      className="hover:bg-[#F0F7FF] cursor-pointer"
                      onClick={() => activeTab === 'hot-ranking' || activeTab === 'products' ? handleViewDetail(row.id as number) : null}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(row.id as number)}
                          onCheckedChange={(v) => {
                            const newSelected = new Set(selectedIds);
                            if (v) {
                              newSelected.add(row.id as number);
                            } else {
                              newSelected.delete(row.id as number);
                            }
                            setSelectedIds(newSelected);
                          }}
                        />
                      </TableCell>
                      {columns.map((col) => (
                        <TableCell
                          key={col.key}
                          className={col.align ? `text-${col.align}` : ''}
                        >
                          {col.key === 'image' ? (
                            <img
                              src={row.image as string}
                              alt=""
                              className="w-12 h-12 object-cover rounded"
                            />
                          ) : col.key === 'actions' ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetail(row.id as number)}>
                                  查看详情
                                </DropdownMenuItem>
                                <DropdownMenuItem>收藏</DropdownMenuItem>
                                <DropdownMenuItem className="text-[#EF4444]">删除</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : col.key === 'engineScore' ? (
                            <EngineScoreCell />
                          ) : col.key === 'title' ? (
                            <div className="max-w-xs truncate" title={row.title as string}>
                              {row.title as string}
                            </div>
                          ) : col.key === 'keyword' || col.key === 'tag' || col.key === 'brand' ? (
                            <span className="font-medium text-[#1677FF]">{row[col.key] as string}</span>
                          ) : col.key === 'growth' || col.key === 'searchGrowth' ? (
                            <span className={Number(row[col.key]) > 0 ? 'text-[#10B981]' : Number(row[col.key]) < 0 ? 'text-[#EF4444]' : 'text-[#9CA3AF]'}>
                              {Number(row[col.key]) > 0 ? <TrendingUp className="w-4 h-4 inline" /> : Number(row[col.key]) < 0 ? <TrendingDown className="w-4 h-4 inline" /> : <Minus className="w-4 h-4 inline" />}
                              {`${Number(row[col.key]) > 0 ? '+' : ''}${Number(row[col.key]).toFixed(1)}%`}
                            </span>
                          ) : (
                            String(row[col.key] ?? '—')
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* 分页 */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-[#637089]">
              共 {filteredData.length} 条
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1}>
                上一页
              </Button>
              <span className="text-sm text-[#637089]">
                第 {page} 页
              </span>
              <Button variant="outline" size="sm" disabled={filteredData.length < pageSize}>
                下一页
              </Button>
              <Select value={String(pageSize)} onValueChange={(v) => console.log(v)}>
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">每页 20</SelectItem>
                  <SelectItem value="50">每页 50</SelectItem>
                  <SelectItem value="100">每页 100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
