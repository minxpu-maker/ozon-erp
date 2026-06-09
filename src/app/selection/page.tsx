'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ScatterChart,
  Scatter,
  ZAxis,
  Tooltip,
  Cell,
} from 'recharts';
import {
  Search,
  LayoutGrid,
  List,
  Grid3X3,
  Filter,
  Sparkles,
  Lightbulb,
  Eye,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  ChevronLeft,
  Package,
  Loader2,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProxiedImage, getProxiedImageUrl } from '@/components/ui/proxied-image';

// Types
interface Opportunity {
  id: string;
  shopId: string;
  source: string;
  selectionMode: 'copy' | 'refine' | 'system_recommend';
  targetType: string;
  targetCategoryId: number | null;
  targetCategoryName: string | null;
  targetProductId: number | null;
  targetName: string;
  targetImage: string | null;
  marketAnalysis: {
    priceRange: { min: number; max: number };
    sellerCount: number;
    reviewCount: number;
    trend: 'up' | 'down' | 'stable';
  } | null;
  scores: {
    profit: number;
    competition: number;
    demand: number;
    differentiation: number;
    supply: number;
  } | null;
  status: 'discovered' | 'confirmed' | 'abandoned';
  createdAt: string;
  updatedAt: string;
}

interface Shop {
  id: string;
  name: string;
}

interface Category {
  id: number;
  name: string;
}

// Grade helpers
const getGrade = (scores: Opportunity['scores']): 'A' | 'B' | 'C' | 'D' => {
  if (!scores) return 'D';
  const avg = (scores.profit + (100 - scores.competition) + scores.demand + scores.differentiation + scores.supply) / 5;
  if (avg >= 70) return 'A';
  if (avg >= 55) return 'B';
  if (avg >= 40) return 'C';
  return 'D';
};

const gradeColors: Record<string, string> = {
  A: 'bg-green-500',
  B: 'bg-blue-500',
  C: 'bg-orange-500',
  D: 'bg-red-500',
};

const gradeTextColors: Record<string, string> = {
  A: 'text-green-600',
  B: 'text-blue-600',
  C: 'text-orange-600',
  D: 'text-red-600',
};

const gradeScatterColors: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f97316',
  D: '#ef4444',
};

export default function SelectionPage() {
  const router = useRouter();
  
  // State
  const [shopId, setShopId] = useState('');
  const [mode, setMode] = useState<'copy' | 'refine'>('copy');
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'matrix'>('card');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAIDigDialog, setShowAIDigDialog] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(true);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState({
    categoryId: 'all',
    priceMin: 0,
    priceMax: 100000,
    grades: [] as string[],
    sources: [] as string[],
  });

  // AI Dig dialog state
  const [aiDigKeyword, setAiDigKeyword] = useState('');
  const [aiDigCategoryId, setAiDigCategoryId] = useState('');

  // Fetch initial data
  useEffect(() => {
    fetchShops();
    fetchCategories();
  }, []);

  // Fetch opportunities when shop/mode/filters change
  useEffect(() => {
    if (shopId) {
      fetchOpportunities();
    }
  }, [shopId, mode, filters]);

  const fetchShops = async () => {
    try {
      const res = await fetch('/api/shops');
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        setShops(data.data);
        // Auto-select TIANTAN or first shop
        const tantanShop = data.data.find((s: Shop) => s.name === 'TIANTAN');
        setShopId(tantanShop?.id || data.data[0].id);
      } else {
        // Fallback
        setShops([{ id: '1', name: 'TIANTAN' }]);
        setShopId('1');
      }
    } catch (error) {
      console.error('Failed to fetch shops:', error);
      setShops([{ id: '1', name: 'TIANTAN' }]);
      setShopId('1');
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/selection/categories/tree');
      const data = await res.json();
      if (data.success && data.data) {
        // Flatten categories for filter
        const flat: Category[] = [];
        const flatten = (cats: any[], prefix = '') => {
          cats.forEach(cat => {
            flat.push({ id: cat.category_id, name: prefix + cat.category_name });
            if (cat.children) flatten(cat.children, prefix + '  ');
          });
        };
        flatten(data.data);
        setCategories(flat);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        shopId,
        mode,
        status: 'discovered',
      });
      if (filters.categoryId && filters.categoryId !== 'all') params.append('categoryId', filters.categoryId);
      
      const res = await fetch(`/api/selection/opportunities?${params}`);
      const data = await res.json();
      if (data.success && data.data?.items) {
        setOpportunities(data.data.items);
      } else {
        // Use mock data if no real data
        setOpportunities(generateMockData());
      }
    } catch (error) {
      console.error('Failed to fetch opportunities:', error);
      setOpportunities(generateMockData());
    } finally {
      setLoading(false);
    }
  };

  // Generate mock data for demo
  const generateMockData = (): Opportunity[] => {
    const names = [
      '女士冬季保暖羽绒服', '儿童益智积木玩具', '家用空气净化器',
      '运动健身瑜伽垫', '智能手表手环', '便携式充电宝',
      '男士商务休闲皮带', '婴儿纯棉连体衣', '厨房多功能置物架',
      '户外露营帐篷', '蓝牙无线耳机', '时尚女士手提包',
    ];
    
    return Array.from({ length: 12 }, (_, i) => ({
      id: `opp-${i + 1}`,
      shopId,
      source: ['ozon', 'aliexpress', '1688'][i % 3],
      selectionMode: mode,
      targetType: 'product',
      targetCategoryId: 100 + i,
      targetCategoryName: ['服装', '玩具', '家电', '运动', '数码', '箱包'][i % 6],
      targetProductId: 1000 + i,
      targetName: names[i],
      targetImage: null,
      marketAnalysis: {
        priceRange: { min: 500 + i * 100, max: 2000 + i * 150 },
        sellerCount: 10 + i * 5,
        reviewCount: 50 + i * 20,
        trend: ['up', 'down', 'stable'][i % 3] as 'up' | 'down' | 'stable',
      },
      scores: {
        profit: 40 + (i * 7) % 60,
        competition: 20 + (i * 11) % 50,
        demand: 50 + (i * 13) % 50,
        differentiation: 30 + (i * 17) % 70,
        supply: 60 + (i * 19) % 40,
      },
      status: 'discovered',
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Filter opportunities
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(opp => {
      // Price filter
      if (opp.marketAnalysis) {
        const avgPrice = (opp.marketAnalysis.priceRange.min + opp.marketAnalysis.priceRange.max) / 2;
        if (avgPrice < filters.priceMin || avgPrice > filters.priceMax) return false;
      }
      
      // Grade filter
      if (filters.grades.length > 0) {
        const grade = getGrade(opp.scores);
        if (!filters.grades.includes(grade)) return false;
      }
      
      // Source filter
      if (filters.sources.length > 0) {
        if (!filters.sources.includes(opp.source)) return false;
      }
      
      return true;
    });
  }, [opportunities, filters]);

  // Radar chart data
  const getRadarData = (scores: Opportunity['scores']) => {
    if (!scores) return [];
    return [
      { subject: '利润空间', value: scores.profit, fullMark: 100 },
      { subject: '竞争强度', value: 100 - scores.competition, fullMark: 100 },
      { subject: '需求热度', value: scores.demand, fullMark: 100 },
      { subject: '差异化', value: scores.differentiation, fullMark: 100 },
      { subject: '供应链', value: scores.supply, fullMark: 100 },
    ];
  };

  // Trend mini chart data
  const getTrendData = (trend: 'up' | 'down' | 'stable') => {
    const base = trend === 'up' ? 50 : trend === 'down' ? 80 : 65;
    return Array.from({ length: 7 }, (_, i) => ({
      day: i,
      value: base + (trend === 'up' ? i * 5 : trend === 'down' ? -i * 5 : Math.sin(i) * 10),
    }));
  };

  // Scatter data for matrix view
  const scatterData = useMemo(() => {
    return filteredOpportunities.map(opp => {
      const scores = opp.scores || { profit: 50, competition: 50, demand: 50, differentiation: 50, supply: 50 };
      const grade = getGrade(scores);
      return {
        x: scores.competition,
        y: scores.profit,
        z: scores.demand,
        id: opp.id,
        name: opp.targetName,
        grade,
      };
    });
  }, [filteredOpportunities]);

  // Actions
  const handleConfirm = async (id: string) => {
    try {
      await fetch(`/api/selection/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      // Remove from list or refetch
      setOpportunities(prev => prev.filter(o => o.id !== id));
    } catch (error) {
      console.error('Failed to confirm:', error);
    }
  };

  const handleAbandon = async (id: string) => {
    try {
      await fetch(`/api/selection/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'abandoned' }),
      });
      setOpportunities(prev => prev.filter(o => o.id !== id));
    } catch (error) {
      console.error('Failed to abandon:', error);
    }
  };

  const handleAIDig = async () => {
    try {
      // 调用新的选品引擎API
      const response = await fetch('/api/selection/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          categoryId: aiDigCategoryId ? parseInt(aiDigCategoryId) : undefined,
          strategy: mode === 'copy' ? 'follow_default' : 'refine_default',
          keyword: aiDigKeyword,
        }),
      });
      const result = await response.json();
      
      if (result.success) {
        // 显示结果
        console.log('选品任务完成:', result);
        // 刷新候选品列表
        await fetchOpportunities();
      }
      
      setShowAIDigDialog(false);
      setAiDigKeyword('');
      setAiDigCategoryId('');
      fetchOpportunities();
    } catch (error) {
      console.error('Failed to create opportunity:', error);
    }
  };

  const handleSystemRecommend = async () => {
    try {
      // 调用评分引擎的系统推荐API
      const response = await fetch('/api/selection/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'systemRecommend',
          shopId,
        }),
      });
      const result = await response.json();
      
      if (result.success && result.opportunityId) {
        // 创建成功后，自动触发评分
        await fetch('/api/selection/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batch',
            shopId,
            limit: 10,
          }),
        });
      }
      
      fetchOpportunities();
    } catch (error) {
      console.error('Failed to create system recommendation:', error);
    }
  };
  
  // 批量评分
  const handleBatchScore = async () => {
    try {
      const response = await fetch('/api/selection/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          shopId,
          status: 'discovered',
          limit: 50,
        }),
      });
      const result = await response.json();
      
      if (result.success) {
        fetchOpportunities();
      }
    } catch (error) {
      console.error('Failed to batch score:', error);
    }
  };

  const handleBatchConfirm = async () => {
    try {
      await fetch('/api/selection/opportunities/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: 'confirm',
        }),
      });
      setSelectedIds(new Set());
      fetchOpportunities();
    } catch (error) {
      console.error('Failed to batch confirm:', error);
    }
  };

  const handleBatchAbandon = async () => {
    try {
      await fetch('/api/selection/opportunities/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: 'abandon',
        }),
      });
      setSelectedIds(new Set());
      fetchOpportunities();
    } catch (error) {
      console.error('Failed to batch abandon:', error);
    }
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOpportunities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOpportunities.map(o => o.id)));
    }
  };

  // Long press for multi-select
  const handleLongPressStart = (id: string) => {
    const timer = setTimeout(() => {
      toggleSelect(id);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  return (
    <AppLayout title="AI 选品看板" subtitle="智能选品 · 发现优质商机">
      <div className="flex flex-col h-full">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <div className="flex items-center gap-3">
            {/* Shop Selector */}
            <Select value={shopId} onValueChange={setShopId}>
              <SelectTrigger className="w-[140px]">
                <Store className="w-4 h-4 mr-2" />
                <SelectValue placeholder="选择店铺" />
              </SelectTrigger>
              <SelectContent>
                {shops.map(shop => (
                  <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <Button
                variant={mode === 'copy' ? 'default' : 'ghost'}
                size="sm"
                className={cn('rounded-none', mode === 'copy' && 'bg-[#2F6BFF]')}
                onClick={() => setMode('copy')}
              >
                跟卖
              </Button>
              <Button
                variant={mode === 'refine' ? 'default' : 'ghost'}
                size="sm"
                className={cn('rounded-none', mode === 'refine' && 'bg-[#2F6BFF]')}
                onClick={() => setMode('refine')}
              >
                精铺
              </Button>
            </div>

            {/* AI Dig Button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => setShowAIDigDialog(true)}
            >
              <Sparkles className="w-4 h-4" />
              AI深挖
            </Button>

            {/* System Recommend Button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={handleSystemRecommend}
            >
              <Lightbulb className="w-4 h-4" />
              系统推荐
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <Button
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none px-3"
                onClick={() => setViewMode('card')}
                title="卡片视图"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none px-3"
                onClick={() => setViewMode('list')}
                title="列表视图"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'matrix' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none px-3"
                onClick={() => setViewMode('matrix')}
                title="矩阵视图"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
            </div>

            {/* Filter Toggle */}
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
            >
              <Filter className="w-4 h-4" />
              筛选
              {showFilterPanel ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </Button>

            {/* Refresh */}
            <Button variant="ghost" size="sm" onClick={fetchOpportunities} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 gap-4 min-h-0">
          {/* Main Area */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredOpportunities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Package className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg mb-2">暂无选品机会</p>
                <p className="text-sm mb-4">点击"AI深挖"或"系统推荐"发现商机</p>
                <Button onClick={() => setShowAIDigDialog(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI深挖
                </Button>
              </div>
            ) : viewMode === 'card' ? (
              /* Card View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredOpportunities.map(opp => {
                  const scores = opp.scores || { profit: 50, competition: 50, demand: 50, differentiation: 50, supply: 50 };
                  const grade = getGrade(scores);
                  const trendData = getTrendData(opp.marketAnalysis?.trend || 'stable');
                  
                  return (
                    <Card 
                      key={opp.id} 
                      className={cn(
                        'cursor-pointer transition-all hover:shadow-lg bg-white',
                        selectedIds.has(opp.id) && 'ring-2 ring-primary'
                      )}
                      onMouseDown={() => handleLongPressStart(opp.id)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      onTouchStart={() => handleLongPressStart(opp.id)}
                      onTouchEnd={handleLongPressEnd}
                    >
                      <CardContent className="p-4">
                        {/* Thumbnail */}
                        <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                          {opp.targetImage ? (
                            <ProxiedImage
                              src={opp.targetImage}
                              alt={opp.targetName}
                              className="w-full h-full object-cover"
                              iconSize="lg"
                            />
                          ) : (
                            <Package className="w-12 h-12 text-muted-foreground/30" />
                          )}
                          {/* Source Badge */}
                          <Badge variant="outline" className="absolute top-2 left-2 text-xs">
                            {opp.source === 'ozon' ? 'Ozon' : opp.source === 'aliexpress' ? '速卖通' : '1688'}
                          </Badge>
                        </div>

                        {/* Name */}
                        <h3 className="font-medium text-sm mb-2 line-clamp-2">{opp.targetName}</h3>

                        {/* Radar Chart */}
                        <div className="h-28 mb-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={getRadarData(scores)}>
                              <PolarGrid stroke="#E6EAF2" />
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
                              <PolarRadiusAxis tick={false} />
                              <Radar
                                name="评分"
                                dataKey="value"
                                stroke="#2F6BFF"
                                fill="#2F6BFF"
                                fillOpacity={0.3}
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Trend Mini Chart */}
                        <div className="h-10 mb-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                              <Line 
                                type="monotone" 
                                dataKey="value" 
                                stroke={opp.marketAnalysis?.trend === 'up' ? '#16A37B' : opp.marketAnalysis?.trend === 'down' ? '#EF4444' : '#6B7280'}
                                strokeWidth={2}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Grade & Seller Count */}
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={cn('text-white', gradeColors[grade])}>
                            {grade}级
                          </Badge>
                          <div className="flex items-center text-xs text-muted-foreground">
                            {opp.marketAnalysis?.trend === 'up' ? (
                              <ArrowUpRight className="w-3 h-3 text-green-500" />
                            ) : opp.marketAnalysis?.trend === 'down' ? (
                              <ArrowDownRight className="w-3 h-3 text-red-500" />
                            ) : (
                              <Minus className="w-3 h-3 text-gray-400" />
                            )}
                            <span className="ml-1">
                              {opp.marketAnalysis?.sellerCount || 0} 在售
                            </span>
                          </div>
                        </div>

                        {/* Price Range */}
                        <div className="text-xs text-muted-foreground mb-3">
                          ₽{opp.marketAnalysis?.priceRange?.min?.toLocaleString() || 0} - ₽{opp.marketAnalysis?.priceRange?.max?.toLocaleString() || 0}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" asChild>
                            <a href={`/selection/${opp.id}`}>
                              <Eye className="w-3 h-3 mr-1" />
                              详情
                            </a>
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="flex-1 bg-green-500 hover:bg-green-600"
                            onClick={(e) => { e.stopPropagation(); handleConfirm(opp.id); }}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            确认
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleAbandon(opp.id); }}
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : viewMode === 'list' ? (
              /* List View */
              <div className="bg-white rounded-lg border">
                {/* Batch Actions */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 border-b">
                    <span className="text-sm font-medium">已选择 {selectedIds.size} 项</span>
                    <Button size="sm" variant="default" className="bg-green-500 hover:bg-green-600" onClick={handleBatchConfirm}>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      批量确认
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleBatchAbandon}>
                      <XCircle className="w-3 h-3 mr-1" />
                      批量放弃
                    </Button>
                  </div>
                )}

                {/* Table */}
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="p-3 text-left">
                        <Checkbox 
                          checked={selectedIds.size === filteredOpportunities.length && filteredOpportunities.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="p-3 text-left text-sm font-medium">商品</th>
                      <th className="p-3 text-left text-sm font-medium">类目</th>
                      <th className="p-3 text-left text-sm font-medium">价格</th>
                      <th className="p-3 text-left text-sm font-medium">评分</th>
                      <th className="p-3 text-left text-sm font-medium">趋势</th>
                      <th className="p-3 text-left text-sm font-medium">等级</th>
                      <th className="p-3 text-left text-sm font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOpportunities.map(opp => {
                      const scores = opp.scores || { profit: 50, competition: 50, demand: 50, differentiation: 50, supply: 50 };
                      const grade = getGrade(scores);
                      const avgScore = Math.round((scores.profit + (100 - scores.competition) + scores.demand + scores.differentiation + scores.supply) / 5);

                      return (
                        <tr 
                          key={opp.id} 
                          className="border-b hover:bg-muted/30 cursor-pointer"
                          onClick={() => router.push(`/selection/${opp.id}`)}
                        >
                          <td className="p-3" onClick={e => e.stopPropagation()}>
                            <Checkbox 
                              checked={selectedIds.has(opp.id)}
                              onCheckedChange={() => toggleSelect(opp.id)}
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                                <Package className="w-5 h-5 text-muted-foreground/50" />
                              </div>
                              <span className="text-sm line-clamp-1">{opp.targetName}</span>
                            </div>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {opp.targetCategoryName || '-'}
                          </td>
                          <td className="p-3 text-sm">
                            ₽{opp.marketAnalysis?.priceRange?.min?.toLocaleString() || '-'}
                          </td>
                          <td className="p-3">
                            <span className={cn('font-medium', gradeTextColors[grade])}>
                              {avgScore}
                            </span>
                          </td>
                          <td className="p-3">
                            {opp.marketAnalysis?.trend === 'up' ? (
                              <ArrowUpRight className="w-4 h-4 text-green-500" />
                            ) : opp.marketAnalysis?.trend === 'down' ? (
                              <ArrowDownRight className="w-4 h-4 text-red-500" />
                            ) : (
                              <Minus className="w-4 h-4 text-gray-400" />
                            )}
                          </td>
                          <td className="p-3">
                            <Badge className={cn('text-white', gradeColors[grade])}>
                              {grade}
                            </Badge>
                          </td>
                          <td className="p-3" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" asChild>
                                <a href={`/selection/${opp.id}`}>
                                  <Eye className="w-3 h-3" />
                                </a>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleConfirm(opp.id)}
                              >
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleAbandon(opp.id)}
                              >
                                <XCircle className="w-3 h-3 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Matrix View */
              <div className="bg-white rounded-lg border p-4">
                <h3 className="text-sm font-medium mb-4">竞争-利润矩阵图</h3>
                <div className="h-[500px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
                      <XAxis 
                        type="number" 
                        dataKey="x" 
                        name="竞争强度" 
                        domain={[0, 100]}
                        label={{ value: '竞争强度 →', position: 'bottom', offset: 0 }}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="y" 
                        name="利润空间" 
                        domain={[0, 100]}
                        label={{ value: '利润空间 →', angle: -90, position: 'left' }}
                        tick={{ fontSize: 11 }}
                      />
                      <ZAxis type="number" dataKey="z" range={[100, 1000]} name="需求热度" />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        formatter={(value, name) => [Math.round(Number(value)), name]}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white border rounded-lg p-2 shadow-lg">
                                <p className="font-medium text-sm">{data.name}</p>
                                <p className="text-xs text-muted-foreground">竞争: {Math.round(data.x)} | 利润: {Math.round(data.y)} | 需求: {Math.round(data.z)}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter name="商品" data={scatterData}>
                        {scatterData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={gradeScatterColors[entry.grade]} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500" />
                    <span className="text-xs">A级 (优质)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500" />
                    <span className="text-xs">B级 (良好)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-orange-500" />
                    <span className="text-xs">C级 (一般)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500" />
                    <span className="text-xs">D级 (较差)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Filter Panel */}
          {showFilterPanel && (
            <div className="w-72 bg-white rounded-lg border p-4 shrink-0 overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">筛选条件</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setFilters({
                    categoryId: '',
                    priceMin: 0,
                    priceMax: 100000,
                    grades: [],
                    sources: [],
                  })}
                >
                  重置
                </Button>
              </div>
              
              <div className="space-y-5">
                {/* Category */}
                <div>
                  <Label className="text-sm mb-2 block">类目</Label>
                  <Select value={filters.categoryId} onValueChange={(v) => setFilters({...filters, categoryId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部类目" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      {categories.slice(0, 20).map(cat => (
                        <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Price Range */}
                <div>
                  <Label className="text-sm mb-2 block">价格区间</Label>
                  <div className="px-2">
                    <Slider
                      value={[filters.priceMin, filters.priceMax]}
                      onValueChange={([min, max]) => setFilters({...filters, priceMin: min, priceMax: max})}
                      max={100000}
                      step={1000}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>₽{filters.priceMin.toLocaleString()}</span>
                      <span>₽{filters.priceMax.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* AI Grade */}
                <div>
                  <Label className="text-sm mb-2 block">AI等级</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {['A', 'B', 'C', 'D'].map(grade => (
                      <Button
                        key={grade}
                        variant={filters.grades.includes(grade) ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          filters.grades.includes(grade) && gradeColors[grade]
                        )}
                        onClick={() => {
                          const grades = filters.grades.includes(grade)
                            ? filters.grades.filter(g => g !== grade)
                            : [...filters.grades, grade];
                          setFilters({...filters, grades});
                        }}
                      >
                        {grade}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Data Source */}
                <div>
                  <Label className="text-sm mb-2 block">数据来源</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Ozon', '速卖通', '1688', '海关'].map(source => (
                      <Button
                        key={source}
                        variant={filters.sources.includes(source) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const sources = filters.sources.includes(source)
                            ? filters.sources.filter(s => s !== source)
                            : [...filters.sources, source];
                          setFilters({...filters, sources});
                        }}
                      >
                        {source}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Filter Stats */}
              <div className="mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  共 <span className="font-medium text-foreground">{filteredOpportunities.length}</span> 个结果
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Dig Dialog */}
      <Dialog open={showAIDigDialog} onOpenChange={setShowAIDigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI 深挖</DialogTitle>
            <DialogDescription>
              输入关键词或选择类目，AI 将为您深度挖掘潜在商机
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>关键词</Label>
              <Input 
                placeholder="输入商品关键词..." 
                className="mt-1"
                value={aiDigKeyword}
                onChange={(e) => setAiDigKeyword(e.target.value)}
              />
            </div>
            <div>
              <Label>目标类目</Label>
              <Select value={aiDigCategoryId} onValueChange={setAiDigCategoryId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择类目（可选）" />
                </SelectTrigger>
                <SelectContent>
                  {categories.slice(0, 20).map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIDigDialog(false)}>
              取消
            </Button>
            <Button onClick={handleAIDig}>
              <Sparkles className="w-4 h-4 mr-2" />
              开始深挖
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
