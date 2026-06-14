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
  ChevronUp,
  ChevronRight,
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
  Eye,
  Star,
  ShoppingCart,
  Calendar,
  Package2,
  BarChart3,
  Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ Types ============

type TabType = 'hot-ranking' | 'hot-words' | 'hot-tags' | 'hot-categories' | 'hot-shops' | 'hot-brands' | 'product-library';

type Platform = 'ozon' | 'wb' | 'all';

type SelectionMode = 'sales-spike' | 'potential-market' | 'unmet-demand' | 'no-stock-pressure' | 'engine-recommend' | 'custom';

interface MarketSignal {
  id: number;
  productId: string;
  title: string;
  imageUrl: string;
  imageS3Url?: string;
  sku?: string;
  brand?: string;
  category?: string;
  categoryPath?: string;
  platform: 'ozon' | 'wb';
  price: number;
  originalPrice?: number;
  salesVolume?: number;
  revenue?: number;
  rating?: number;
  reviewCount?: number;
  sellerName?: string;
  sellerType?: string;
  deliveryType?: string;
  weight?: number;
  volume?: number;
  dimensions?: { length: number; width: number; height: number };
  listedDate?: string;
  variantCount?: number;
  stock?: number;
  // API占位字段
  profitRate?: number;
  returnRate?: number;
  impressions?: number;
  cardViews?: number;
  cartRate?: number;
  adShare?: number;
  qaCount?: number;
  // 计算字段
  totalImpressions?: number;
  lostRevenue?: number;
  // 本地字段
  aiScore?: number;
  collectedAt?: string;
}

interface FilterConfig {
  category?: string;
  priceMin?: number;
  priceMax?: number;
  salesMin?: number;
  salesMax?: number;
  reviewMin?: number;
  ratingMin?: number;
  // 进阶筛选
  listedDateFrom?: string;
  listedDateTo?: string;
  weightMin?: number;
  weightMax?: number;
  volumeMin?: number;
  volumeMax?: number;
  sellerType?: string;
  deliveryType?: string;
  hasVariants?: boolean;
  inStock?: boolean;
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

// 29列表格配置
const COLUMN_CONFIG = [
  { key: 'rank', label: '排名', width: 'w-12' },
  { key: 'image', label: '图片', width: 'w-16' },
  { key: 'title', label: '商品标题', width: 'flex-1 min-w-[200px]' },
  { key: 'sku', label: 'SKU', width: 'w-24' },
  { key: 'brand', label: '品牌', width: 'w-24' },
  { key: 'category', label: '类目', width: 'w-28' },
  { key: 'price', label: '售价', width: 'w-20' },
  { key: 'originalPrice', label: '原价', width: 'w-20' },
  { key: 'salesVolume', label: '销量', width: 'w-20' },
  { key: 'revenue', label: '销售额', width: 'w-24' },
  { key: 'profitRate', label: '利润率', width: 'w-20', placeholder: true },
  { key: 'totalImpressions', label: '曝光量', width: 'w-20', placeholder: true },
  { key: 'impressions', label: '展示次数', width: 'w-20', placeholder: true },
  { key: 'cardViews', label: '卡片浏览', width: 'w-20', placeholder: true },
  { key: 'cartRate', label: '加购率', width: 'w-20', placeholder: true },
  { key: 'adShare', label: '广告占比', width: 'w-20', placeholder: true },
  { key: 'returnRate', label: '退货率', width: 'w-20', placeholder: true },
  { key: 'lostRevenue', label: '流失销售额', width: 'w-24', placeholder: true },
  { key: 'variantCount', label: '变体数', width: 'w-16' },
  { key: 'reviewCount', label: '评价数', width: 'w-16' },
  { key: 'rating', label: '评分', width: 'w-16' },
  { key: 'listedDate', label: '上架时间', width: 'w-24' },
  { key: 'weight', label: '重量(g)', width: 'w-20' },
  { key: 'volume', label: '体积(L)', width: 'w-20' },
  { key: 'sellerName', label: '卖家', width: 'w-28' },
  { key: 'sellerType', label: '卖家类型', width: 'w-20' },
  { key: 'deliveryType', label: '配送', width: 'w-16' },
  { key: 'qaCount', label: '问答数', width: 'w-16', placeholder: true },
  { key: 'aiScore', label: '引擎评分', width: 'w-20', engine: true },
  { key: 'actions', label: '操作', width: 'w-32' },
];

// ============ Mock Data ============

function generateMockData(count: number): MarketSignal[] {
  const categories = ['电子产品', '家居用品', '服装鞋包', '美妆护肤', '母婴用品', '运动户外', '食品饮料'];
  const brands = ['品牌A', '品牌B', '品牌C', '品牌D', '品牌E'];
  const sellers = ['官方旗舰店', '专营店A', '跨境专营', '品牌直销'];
  
  return Array.from({ length: count }, (_, i) => {
    const price = Math.floor(Math.random() * 5000) + 299;
    const salesVolume = Math.floor(Math.random() * 50000) + 100;
    const platform = Math.random() > 0.5 ? 'ozon' : 'wb';
    const hasApiData = Math.random() > 0.7; // 30%有API数据
    
    return {
      id: i + 1,
      productId: `${platform.toUpperCase()}-${String(10000000 + i).padStart(9, '0')}`,
      title: `${platform === 'ozon' ? 'Ozon' : 'WB'} 热销商品 ${i + 1} - 爆款精选 限时特惠`,
      imageUrl: `https://picsum.photos/seed/${i + 100}/200/200`,
      sku: `SKU${String(100000 + i).padStart(7, '0')}`,
      brand: brands[Math.floor(Math.random() * brands.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      categoryPath: `根类目 / ${categories[Math.floor(Math.random() * categories.length)]}`,
      platform,
      price,
      originalPrice: Math.floor(price * (1 + Math.random() * 0.5)),
      salesVolume,
      revenue: price * salesVolume,
      rating: Number((Math.random() * 2 + 3).toFixed(1)),
      reviewCount: Math.floor(Math.random() * 5000),
      sellerName: sellers[Math.floor(Math.random() * sellers.length)],
      sellerType: Math.random() > 0.7 ? 'cross_border' : 'local',
      deliveryType: ['FBO', 'FBS', 'RFBS'][Math.floor(Math.random() * 3)],
      weight: Math.floor(Math.random() * 5000) + 50,
      volume: Number((Math.random() * 10).toFixed(2)),
      listedDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      variantCount: Math.floor(Math.random() * 20),
      // API占位
      profitRate: hasApiData ? Number((Math.random() * 50 + 5).toFixed(1)) : undefined,
      returnRate: hasApiData ? Number((Math.random() * 15).toFixed(1)) : undefined,
      impressions: hasApiData ? Math.floor(Math.random() * 100000) : undefined,
      cardViews: hasApiData ? Math.floor(Math.random() * 50000) : undefined,
      cartRate: hasApiData ? Number((Math.random() * 10).toFixed(1)) : undefined,
      adShare: hasApiData ? Number((Math.random() * 50).toFixed(1)) : undefined,
      qaCount: Math.floor(Math.random() * 100),
      totalImpressions: hasApiData ? Math.floor(Math.random() * 500000) : undefined,
      lostRevenue: hasApiData ? Math.floor(Math.random() * 100000) : undefined,
      aiScore: undefined, // 引擎预留
    };
  });
}

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
            {tab.separator && <div className="w-px h-6 bg-[#E6EAF2] mx-2" />}
            <button
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-colors',
                activeTab === tab.id
                  ? 'bg-[#1677FF]/10 text-[#1677FF] border-b-2 border-[#1677FF]'
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
          value === 'all' ? 'bg-white text-[#1F2937] shadow-sm' : 'text-[#637089] hover:text-[#1F2937]'
        )}
      >
        全部
      </button>
      <button
        onClick={() => onChange('ozon')}
        className={cn(
          'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
          value === 'ozon' ? 'bg-white text-[#005BFF] shadow-sm' : 'text-[#637089] hover:text-[#005BFF]'
        )}
      >
        <div className="w-3 h-3 rounded-full bg-[#005BFF]" />
        Ozon
      </button>
      <button
        onClick={() => onChange('wb')}
        className={cn(
          'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
          value === 'wb' ? 'bg-white text-[#E31E24] shadow-sm' : 'text-[#637089] hover:text-[#E31E24]'
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
  onSearch,
}: {
  filters: FilterConfig;
  onChange: (f: FilterConfig) => void;
  onReset: () => void;
  onSearch: () => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-[#E6EAF2] p-4">
      {/* 基础筛选 - 单行 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-[#637089] whitespace-nowrap">类目</Label>
          <Select value={filters.category || 'all'} onValueChange={(v) => onChange({ ...filters, category: v === 'all' ? undefined : v })}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="全部分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              <SelectItem value="electronics">电子产品</SelectItem>
              <SelectItem value="home">家居用品</SelectItem>
              <SelectItem value="clothing">服装鞋包</SelectItem>
              <SelectItem value="beauty">美妆护肤</SelectItem>
              <SelectItem value="baby">母婴用品</SelectItem>
              <SelectItem value="sports">运动户外</SelectItem>
              <SelectItem value="food">食品饮料</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-[#637089] whitespace-nowrap">售价</Label>
          <Input
            type="number"
            placeholder="最低价"
            value={filters.priceMin || ''}
            onChange={(e) => onChange({ ...filters, priceMin: e.target.value ? Number(e.target.value) : undefined })}
            className="w-24"
          />
          <span className="text-[#9CA3AF]">-</span>
          <Input
            type="number"
            placeholder="最高价"
            value={filters.priceMax || ''}
            onChange={(e) => onChange({ ...filters, priceMax: e.target.value ? Number(e.target.value) : undefined })}
            className="w-24"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-[#637089] whitespace-nowrap">销量</Label>
          <Input
            type="number"
            placeholder="最低"
            value={filters.salesMin || ''}
            onChange={(e) => onChange({ ...filters, salesMin: e.target.value ? Number(e.target.value) : undefined })}
            className="w-24"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-[#637089] whitespace-nowrap">评价数</Label>
          <Input
            type="number"
            placeholder="最少"
            value={filters.reviewMin || ''}
            onChange={(e) => onChange({ ...filters, reviewMin: e.target.value ? Number(e.target.value) : undefined })}
            className="w-24"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-[#637089] whitespace-nowrap">评分</Label>
          <Select value={filters.ratingMin?.toString() || 'all'} onValueChange={(v) => onChange({ ...filters, ratingMin: v === 'all' ? undefined : Number(v) })}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="4.5">4.5+</SelectItem>
              <SelectItem value="4">4.0+</SelectItem>
              <SelectItem value="3.5">3.5+</SelectItem>
              <SelectItem value="3">3.0+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="gap-1">
          <Filter className="w-4 h-4" />
          进阶筛选
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* 进阶筛选 - 展开 */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-[#E6EAF2] grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-[#637089] whitespace-nowrap w-20">上架时间</Label>
            <Input
              type="date"
              value={filters.listedDateFrom || ''}
              onChange={(e) => onChange({ ...filters, listedDateFrom: e.target.value || undefined })}
              className="flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-[#637089] whitespace-nowrap w-20">重量(g)</Label>
            <Input
              type="number"
              placeholder="最小"
              value={filters.weightMin || ''}
              onChange={(e) => onChange({ ...filters, weightMin: e.target.value ? Number(e.target.value) : undefined })}
              className="flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-[#637089] whitespace-nowrap w-20">体积(L)</Label>
            <Input
              type="number"
              placeholder="最小"
              value={filters.volumeMin || ''}
              onChange={(e) => onChange({ ...filters, volumeMin: e.target.value ? Number(e.target.value) : undefined })}
              className="flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-[#637089] whitespace-nowrap w-20">卖家类型</Label>
            <Select value={filters.sellerType || 'all'} onValueChange={(v) => onChange({ ...filters, sellerType: v === 'all' ? undefined : v })}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="local">本土卖家</SelectItem>
                <SelectItem value="cross_border">跨境卖家</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-[#637089] whitespace-nowrap w-20">配送方式</Label>
            <Select value={filters.deliveryType || 'all'} onValueChange={(v) => onChange({ ...filters, deliveryType: v === 'all' ? undefined : v })}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="FBO">FBO</SelectItem>
                <SelectItem value="FBS">FBS</SelectItem>
                <SelectItem value="RFBS">RFBS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <Checkbox
              id="hasVariants"
              checked={filters.hasVariants || false}
              onCheckedChange={(v) => onChange({ ...filters, hasVariants: v as boolean })}
            />
            <Label htmlFor="hasVariants" className="text-sm">有多属性变体</Label>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="mt-4 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onReset}>
          重置
        </Button>
        <Button size="sm" onClick={onSearch} className="bg-[#1677FF] hover:bg-[#1565C0]">
          <Search className="w-4 h-4 mr-1" />
          查询
        </Button>
      </div>
    </div>
  );
}

function TrendIndicator({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value > 0) {
    return (
      <span className="flex items-center gap-0.5 text-[#10B981]">
        <TrendingUp className="w-3 h-3" />
        {value}{suffix}
      </span>
    );
  } else if (value < 0) {
    return (
      <span className="flex items-center gap-0.5 text-[#EF4444]">
        <TrendingDown className="w-3 h-3" />
        {Math.abs(value)}{suffix}
      </span>
    );
  }
  return <span className="text-[#9CA3AF]">—</span>;
}

function ProfitRateBadge({ rate }: { rate?: number }) {
  if (rate === undefined) return <span className="text-[#9CA3AF]">—</span>;
  
  const color = rate >= 20 ? 'text-[#10B981]' : rate >= 10 ? 'text-[#F59E0B]' : 'text-[#EF4444]';
  return <span className={color}>{rate}%</span>;
}

function PlatformBadge({ platform }: { platform: 'ozon' | 'wb' }) {
  return platform === 'ozon' ? (
    <Badge className="bg-[#005BFF] text-white text-xs">OZON</Badge>
  ) : (
    <Badge className="bg-[#E31E24] text-white text-xs">WB</Badge>
  );
}

function StatusBadge({ status }: { status: 'hot' | 'new' | 'none' }) {
  if (status === 'hot') {
    return <Badge className="bg-[#FF4757] text-white text-xs">HOT</Badge>;
  } else if (status === 'new') {
    return <Badge className="bg-[#1677FF] text-white text-xs">NEW</Badge>;
  }
  return null;
}

function DataTable({
  data,
  selectedIds,
  onSelectionChange,
  onViewDetail,
}: {
  data: MarketSignal[];
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  onViewDetail: (id: number) => void;
}) {
  const allSelected = data.length > 0 && data.every((item) => selectedIds.has(item.id));

  return (
    <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1600px]">
          <thead className="bg-[#F9FAFB]">
            <tr>
              <th className="w-12 px-4 py-3 text-left">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => {
                    if (v) {
                      onSelectionChange(new Set(data.map((item) => item.id)));
                    } else {
                      onSelectionChange(new Set());
                    }
                  }}
                />
              </th>
              {COLUMN_CONFIG.map((col) => (
                <th
                  key={col.key}
                  className={cn('px-3 py-3 text-xs font-medium text-[#637089] whitespace-nowrap', col.width)}
                >
                  {col.label}
                  {col.engine && <Bot className="inline-block w-3 h-3 ml-1 text-[#9CA3AF]" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={item.id}
                className={cn(
                  'border-t border-[#F0F7FF] hover:bg-[#FAFBFF] transition-colors',
                  index % 2 === 1 && 'bg-[#FAFBFC]'
                )}
              >
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={(v) => {
                      const newIds = new Set(selectedIds);
                      if (v) {
                        newIds.add(item.id);
                      } else {
                        newIds.delete(item.id);
                      }
                      onSelectionChange(newIds);
                    }}
                  />
                </td>
                <td className="px-3 py-3 text-sm text-[#637089]">{index + 1}</td>
                <td className="px-3 py-3">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-12 h-12 rounded-lg object-cover"
                    referrerPolicy="no-referrer"
                  />
                </td>
                <td className="px-3 py-3 max-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#1F2937] line-clamp-2">{item.title}</span>
                    <StatusBadge status={index < 5 ? 'hot' : index >= 15 && index < 18 ? 'new' : 'none'} />
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-[#637089] font-mono">{item.sku}</td>
                <td className="px-3 py-3 text-sm text-[#637089]">{item.brand || '—'}</td>
                <td className="px-3 py-3 text-sm text-[#637089]">{item.category || '—'}</td>
                <td className="px-3 py-3 text-sm font-medium text-[#1F2937]">₽{item.price.toLocaleString()}</td>
                <td className="px-3 py-3 text-sm text-[#9CA3AF]">
                  {item.originalPrice ? `₽${item.originalPrice.toLocaleString()}` : '—'}
                </td>
                <td className="px-3 py-3 text-sm text-[#1F2937]">
                  {item.salesVolume?.toLocaleString() || '—'}
                </td>
                <td className="px-3 py-3 text-sm text-[#1F2937]">
                  {item.revenue ? `₽${(item.revenue / 10000).toFixed(1)}万` : '—'}
                </td>
                <td className="px-3 py-3"><ProfitRateBadge rate={item.profitRate} /></td>
                <td className="px-3 py-3 text-sm text-[#9CA3AF]">{item.totalImpressions ? item.totalImpressions.toLocaleString() : '—'}</td>
                <td className="px-3 py-3 text-sm text-[#9CA3AF]">{item.impressions ? item.impressions.toLocaleString() : '—'}</td>
                <td className="px-3 py-3 text-sm text-[#9CA3AF]">{item.cardViews ? item.cardViews.toLocaleString() : '—'}</td>
                <td className="px-3 py-3 text-sm text-[#9CA3AF]">{item.cartRate ? `${item.cartRate}%` : '—'}</td>
                <td className="px-3 py-3 text-sm text-[#9CA3AF]">{item.adShare ? `${item.adShare}%` : '—'}</td>
                <td className="px-3 py-3 text-sm text-[#9CA3AF]">{item.returnRate ? `${item.returnRate}%` : '—'}</td>
                <td className="px-3 py-3 text-sm text-[#9CA3AF]">{item.lostRevenue ? `₽${(item.lostRevenue / 10000).toFixed(1)}万` : '—'}</td>
                <td className="px-3 py-3 text-sm text-[#637089]">{item.variantCount ?? '—'}</td>
                <td className="px-3 py-3 text-sm text-[#637089]">{item.reviewCount?.toLocaleString() || '—'}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />
                    <span className="text-sm">{item.rating}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-[#637089]">{item.listedDate || '—'}</td>
                <td className="px-3 py-3 text-sm text-[#637089]">{item.weight ? `${item.weight}g` : '—'}</td>
                <td className="px-3 py-3 text-sm text-[#637089]">{item.volume ? `${item.volume}L` : '—'}</td>
                <td className="px-3 py-3 text-sm text-[#637089]">{item.sellerName || '—'}</td>
                <td className="px-3 py-3">
                  {item.sellerType ? (
                    <Badge variant="outline" className="text-xs">
                      {item.sellerType === 'cross_border' ? '跨境' : '本土'}
                    </Badge>
                  ) : '—'}
                </td>
                <td className="px-3 py-3">
                  {item.deliveryType ? (
                    <Badge className="bg-[#F3F4F6] text-[#4B5563] text-xs">{item.deliveryType}</Badge>
                  ) : '—'}
                </td>
                <td className="px-3 py-3 text-sm text-[#9CA3AF]">{item.qaCount ?? '—'}</td>
                <td className="px-3 py-3">
                  <span className="text-[#9CA3AF] text-sm cursor-help" title="引擎评分即将上线">—</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-[#1677FF]"
                      onClick={() => onViewDetail(item.id)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-[#1677FF]">
                      <ShoppingCart className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: TabType }) {
  const messages: Record<TabType, { title: string; description: string }> = {
    'hot-ranking': {
      title: '暂无热销榜单数据',
      description: '使用 Chrome 插件采集商品，数据将自动出现在这里',
    },
    'hot-words': { title: '暂无市场热词数据', description: '热词数据采集中...' },
    'hot-tags': { title: '暂无热销标签数据', description: '标签数据采集中...' },
    'hot-categories': { title: '暂无热销类目数据', description: '类目数据采集中...' },
    'hot-shops': { title: '暂无热销店铺数据', description: '店铺数据采集中...' },
    'hot-brands': { title: '暂无热销品牌数据', description: '品牌数据采集中...' },
    'product-library': {
      title: '产品库为空',
      description: '从热销榜单添加商品到产品库',
    },
  };

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Package2 className="w-16 h-16 text-[#D1D5DB] mb-4" />
      <h3 className="text-lg font-medium text-[#1F2937] mb-2">{messages[tab].title}</h3>
      <p className="text-sm text-[#637089]">{messages[tab].description}</p>
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number, pageSize: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="text-sm text-[#637089]">
        共 <span className="font-medium text-[#1F2937]">{total}</span> 条
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={pageSize.toString()}
          onValueChange={(v) => onChange(1, Number(v))}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20条/页</SelectItem>
            <SelectItem value="50">50条/页</SelectItem>
            <SelectItem value="100">100条/页</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onChange(page - 1, pageSize)}
          >
            上一页
          </Button>
          <span className="px-3 text-sm text-[#637089]">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1, pageSize)}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ Main Page ============

export default function SelectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState<TabType>('hot-ranking');
  const [platform, setPlatform] = useState<Platform>('all');
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('sales-spike');
  const [filters, setFilters] = useState<FilterConfig>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<MarketSignal[]>([]);
  const [total, setTotal] = useState(0);

  // 同步URL参数
  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && TABS.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    setSelectedIds(new Set());
    // 更新URL
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`/selection?${params.toString()}`);
  }, [router, searchParams]);

  // 加载数据
  const loadData = useCallback(() => {
    setIsLoading(true);
    // 模拟API请求
    setTimeout(() => {
      const mockData = generateMockData(100);
      setData(mockData);
      setTotal(100);
      setIsLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    if (activeTab === 'hot-ranking') {
      loadData();
    }
  }, [activeTab, loadData]);

  // 筛选数据
  const filteredData = useMemo(() => {
    let result = data;

    if (platform !== 'all') {
      result = result.filter((item) => item.platform === platform);
    }

    if (filters.category) {
      result = result.filter((item) => item.category?.toLowerCase().includes(filters.category!.toLowerCase()));
    }

    if (filters.priceMin) {
      result = result.filter((item) => item.price >= filters.priceMin!);
    }

    if (filters.priceMax) {
      result = result.filter((item) => item.price <= filters.priceMax!);
    }

    if (filters.salesMin) {
      result = result.filter((item) => (item.salesVolume || 0) >= filters.salesMin!);
    }

    if (filters.reviewMin) {
      result = result.filter((item) => (item.reviewCount || 0) >= filters.reviewMin!);
    }

    if (filters.ratingMin) {
      result = result.filter((item) => (item.rating || 0) >= filters.ratingMin!);
    }

    return result;
  }, [data, platform, filters]);

  const handleViewDetail = useCallback((id: number) => {
    router.push(`/selection/${id}`);
  }, [router]);

  const handleResetFilters = useCallback(() => {
    setFilters({});
  }, []);

  const handleSearch = useCallback(() => {
    setPage(1);
    loadData();
  }, [loadData]);

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
          <SelectionModeSelector value={selectionMode} onChange={setSelectionMode} />

          {/* 筛选区 */}
          <FilterSection
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
            onSearch={handleSearch}
          />

          {/* 数据表格 */}
          {activeTab === 'hot-ranking' && (
            <>
              {/* 操作栏 */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-[#637089]">
                  结果 <span className="font-medium text-[#1F2937]">{filteredData.length}</span> 条
                  {selectedIds.size > 0 && (
                    <span className="ml-2 text-[#1677FF]">已选 {selectedIds.size} 件</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={selectedIds.size === 0}>
                    <ShoppingCart className="w-4 h-4 mr-1" />
                    批量采集
                  </Button>
                  <Button size="sm" variant="outline" disabled={selectedIds.size === 0}>
                    <Database className="w-4 h-4 mr-1" />
                    加入产品库
                  </Button>
                  <Button size="sm" variant="outline">
                    <Download className="w-4 h-4 mr-1" />
                    导出
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Settings2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* 表格 */}
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-[#1677FF] animate-spin" />
                </div>
              ) : filteredData.length > 0 ? (
                <>
                  <DataTable
                    data={filteredData.slice((page - 1) * pageSize, page * pageSize)}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    onViewDetail={handleViewDetail}
                  />
                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    total={filteredData.length}
                    onChange={(p, ps) => {
                      setPage(p);
                      setPageSize(ps);
                    }}
                  />
                </>
              ) : (
                <EmptyState tab={activeTab} />
              )}
            </>
          )}

          {/* 其他Tab - 暂未实现 */}
          {activeTab !== 'hot-ranking' && <EmptyState tab={activeTab} />}
        </div>
      </div>
    </AppLayout>
  );
}
