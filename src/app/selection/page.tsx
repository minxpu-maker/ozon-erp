'use client';

import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  AreaChart,
  Area,
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
  MoreHorizontal,
  Trash2,
  CheckSquare,
  XSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Opportunity {
  id: number;
  shopId: string;
  source: string;
  selectionMode: 'copy' | 'refine' | 'system_recommend';
  targetType: string;
  targetCategoryId: number | null;
  targetProductId: number | null;
  targetName: string;
  marketAnalysis: any;
  profitEstimate: any;
  riskFlags: any;
  status: 'discovered' | 'confirmed' | 'abandoned';
  createdAt: string;
  updatedAt: string;
}

interface Shop {
  id: string;
  name: string;
}

// Mock data for radar chart
const getRadarData = (scores: any) => [
  { subject: '利润空间', value: scores?.profit || 60, fullMark: 100 },
  { subject: '竞争强度', value: 100 - (scores?.competition || 40), fullMark: 100 },
  { subject: '需求热度', value: scores?.demand || 75, fullMark: 100 },
  { subject: '差异化', value: scores?.differentiation || 55, fullMark: 100 },
  { subject: '供应链', value: scores?.supply || 70, fullMark: 100 },
];

// Mock trend data
const getTrendData = () => {
  const data = [];
  for (let i = 6; i >= 0; i--) {
    data.push({
      day: `${i}天前`,
      value: Math.random() * 100 + 50,
    });
  }
  return data;
};

// Grade colors
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

export default function SelectionPage() {
  // State
  const [shopId, setShopId] = useState('8275dd99-f8fe-4560-a63a-774d15a03bbf');
  const [mode, setMode] = useState<'copy' | 'refine'>('copy');
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'matrix'>('card');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showAIDigDialog, setShowAIDigDialog] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    categoryId: '',
    priceMin: 0,
    priceMax: 100000,
    grades: [] as string[],
    sources: [] as string[],
  });

  // AI Dig dialog state
  const [aiDigKeyword, setAiDigKeyword] = useState('');
  const [aiDigCategoryId, setAiDigCategoryId] = useState('');

  // Mock shops
  const shops: Shop[] = [
    { id: '8275dd99-f8fe-4560-a63a-774d15a03bbf', name: 'TIANTAN' },
  ];

  // Fetch opportunities
  useEffect(() => {
    fetchOpportunities();
  }, [shopId, mode, filters]);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        shopId,
        mode,
        status: 'discovered',
      });
      const res = await fetch(`/api/selection/opportunities?${params}`);
      const data = await res.json();
      if (data.success) {
        setOpportunities(data.data.items);
      }
    } catch (error) {
      console.error('Failed to fetch opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate mock data for demo
  const mockOpportunities: Opportunity[] = useMemo(() => {
    if (opportunities.length > 0) return opportunities;
    
    return Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      shopId: shopId,
      source: ['ozon', 'aliexpress', '1688'][i % 3],
      selectionMode: mode,
      targetType: 'product',
      targetCategoryId: 100 + i,
      targetProductId: 1000 + i,
      targetName: ['女士冬季保暖羽绒服', '儿童益智积木玩具', '家用空气净化器', '运动健身瑜伽垫', '智能手表手环', '便携式充电宝'][i % 6],
      marketAnalysis: {
        priceRange: { min: 500 + i * 100, max: 2000 + i * 150 },
        sellerCount: 10 + i * 5,
        reviewCount: 50 + i * 20,
      },
      profitEstimate: {
        profitMargin: 20 + Math.random() * 30,
        roi: 50 + Math.random() * 100,
      },
      riskFlags: {},
      status: 'discovered',
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }, [opportunities, shopId, mode]);

  // Mock scores
  const getMockScores = (id: number) => ({
    profit: 40 + (id * 7) % 60,
    competition: 20 + (id * 11) % 50,
    demand: 50 + (id * 13) % 50,
    differentiation: 30 + (id * 17) % 70,
    supply: 60 + (id * 19) % 40,
  });

  const getGrade = (scores: any) => {
    const avg = (scores.profit + (100 - scores.competition) + scores.demand + scores.differentiation + scores.supply) / 5;
    if (avg >= 70) return 'A';
    if (avg >= 55) return 'B';
    if (avg >= 40) return 'C';
    return 'D';
  };

  // Actions
  const handleConfirm = async (id: number) => {
    try {
      await fetch(`/api/selection/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      fetchOpportunities();
    } catch (error) {
      console.error('Failed to confirm:', error);
    }
  };

  const handleAbandon = async (id: number) => {
    try {
      await fetch(`/api/selection/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'abandoned' }),
      });
      fetchOpportunities();
    } catch (error) {
      console.error('Failed to abandon:', error);
    }
  };

  const handleAIDig = async () => {
    try {
      await fetch('/api/selection/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          mode,
          targetCategoryId: aiDigCategoryId || null,
          keywords: aiDigKeyword,
        }),
      });
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
      await fetch('/api/selection/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          mode: 'system_recommend',
        }),
      });
      fetchOpportunities();
    } catch (error) {
      console.error('Failed to create system recommendation:', error);
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

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === mockOpportunities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(mockOpportunities.map(o => o.id)));
    }
  };

  // Scatter data for matrix view
  const scatterData = mockOpportunities.map(o => {
    const scores = getMockScores(o.id);
    const grade = getGrade(scores);
    return {
      x: scores.competition,
      y: scores.profit,
      z: scores.demand,
      id: o.id,
      name: o.targetName,
      grade,
    };
  });

  return (
    <AppLayout title="AI 选品看板" subtitle="智能选品 · 发现优质商机">
      <div className="flex flex-col h-full">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <div className="flex items-center gap-3">
            {/* Shop Selector */}
            <Select value={shopId} onValueChange={setShopId}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="选择店铺" />
              </SelectTrigger>
              <SelectContent>
                {shops.map(shop => (
                  <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-[#E6EAF2] overflow-hidden">
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
            <div className="flex rounded-lg border border-[#E6EAF2] overflow-hidden">
              <Button
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none px-3"
                onClick={() => setViewMode('card')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none px-3"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'matrix' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none px-3"
                onClick={() => setViewMode('matrix')}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
            </div>

            {/* Filter Button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
            >
              <Filter className="w-4 h-4" />
              筛选
            </Button>

            {/* Refresh */}
            <Button variant="ghost" size="sm" onClick={fetchOpportunities}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 gap-4 min-h-0">
          {/* Main Area */}
          <div className={cn('flex-1 overflow-auto', showFilterPanel && 'pr-4')}>
            {viewMode === 'card' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {mockOpportunities.map(opp => {
                  const scores = getMockScores(opp.id);
                  const grade = getGrade(scores);
                  const trendData = getTrendData();
                  const isPriceUp = Math.random() > 0.5;
                  
                  return (
                    <Card 
                      key={opp.id} 
                      className={cn(
                        'cursor-pointer transition-all hover:shadow-lg',
                        selectedIds.has(opp.id) && 'ring-2 ring-[#2F6BFF]'
                      )}
                      onClick={() => toggleSelect(opp.id)}
                    >
                      <CardContent className="p-4">
                        {/* Thumbnail */}
                        <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
                          <span className="text-4xl">📦</span>
                        </div>

                        {/* Name */}
                        <h3 className="font-medium text-sm mb-2 line-clamp-2">{opp.targetName}</h3>

                        {/* Radar Chart */}
                        <div className="h-32 mb-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={getRadarData(scores)}>
                              <PolarGrid stroke="#E6EAF2" />
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
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
                        <div className="h-12 mb-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                              <Line 
                                type="monotone" 
                                dataKey="value" 
                                stroke={isPriceUp ? '#16A37B' : '#EF4444'} 
                                strokeWidth={2}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Grade Badge */}
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={cn('text-white', gradeColors[grade])}>
                            {grade}级
                          </Badge>
                          <div className="flex items-center text-xs text-muted-foreground">
                            {isPriceUp ? (
                              <ArrowUpRight className="w-3 h-3 text-green-500" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3 text-red-500" />
                            )}
                            <span className="ml-1">
                              {opp.marketAnalysis?.sellerCount || 0} 在售
                            </span>
                          </div>
                        </div>

                        {/* Price Range */}
                        <div className="text-xs text-muted-foreground mb-3">
                          ¥{opp.marketAnalysis?.priceRange?.min || 0} - ¥{opp.marketAnalysis?.priceRange?.max || 0}
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
            )}

            {viewMode === 'list' && (
              <div className="bg-white rounded-lg border border-[#E6EAF2]">
                {/* Batch Actions */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 border-b">
                    <span className="text-sm">已选择 {selectedIds.size} 项</span>
                    <Button size="sm" variant="default" className="bg-green-500" onClick={handleBatchConfirm}>
                      <CheckSquare className="w-3 h-3 mr-1" />
                      批量确认
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleBatchAbandon}>
                      <XSquare className="w-3 h-3 mr-1" />
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
                          checked={selectedIds.size === mockOpportunities.length}
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
                    {mockOpportunities.map(opp => {
                      const scores = getMockScores(opp.id);
                      const grade = getGrade(scores);
                      const avgScore = Math.round((scores.profit + (100 - scores.competition) + scores.demand + scores.differentiation + scores.supply) / 5);
                      const isPriceUp = Math.random() > 0.5;

                      return (
                        <tr 
                          key={opp.id} 
                          className="border-b hover:bg-muted/30 cursor-pointer"
                          onClick={() => window.location.href = `/selection/${opp.id}`}
                        >
                          <td className="p-3" onClick={e => e.stopPropagation()}>
                            <Checkbox 
                              checked={selectedIds.has(opp.id)}
                              onCheckedChange={() => toggleSelect(opp.id)}
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-lg">
                                📦
                              </div>
                              <span className="text-sm line-clamp-1">{opp.targetName}</span>
                            </div>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            类目 {opp.targetCategoryId}
                          </td>
                          <td className="p-3 text-sm">
                            ¥{opp.marketAnalysis?.priceRange?.min || 0}
                          </td>
                          <td className="p-3">
                            <span className={cn('font-medium', gradeTextColors[grade])}>
                              {avgScore}
                            </span>
                          </td>
                          <td className="p-3">
                            {isPriceUp ? (
                              <ArrowUpRight className="w-4 h-4 text-green-500" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-red-500" />
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
            )}

            {viewMode === 'matrix' && (
              <div className="bg-white rounded-lg border border-[#E6EAF2] p-4">
                <h3 className="text-sm font-medium mb-4">竞争-利润矩阵图</h3>
                <div className="h-[500px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <XAxis 
                        type="number" 
                        dataKey="x" 
                        name="竞争强度" 
                        domain={[0, 100]}
                        label={{ value: '竞争强度 →', position: 'bottom' }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="y" 
                        name="利润空间" 
                        domain={[0, 100]}
                        label={{ value: '利润空间 →', angle: -90, position: 'left' }}
                      />
                      <ZAxis type="number" dataKey="z" range={[50, 400]} name="需求热度" />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        formatter={(value, name) => [Math.round(Number(value)), name]}
                      />
                      <Scatter 
                        name="商品" 
                        data={scatterData} 
                        fill="#2F6BFF"
                        onClick={(data) => window.location.href = `/selection/${data.id}`}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
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

            {loading && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Filter Panel */}
          {showFilterPanel && (
            <div className="w-72 bg-white rounded-lg border border-[#E6EAF2] p-4">
              <h3 className="font-medium mb-4">筛选条件</h3>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm">类目</Label>
                  <Select value={filters.categoryId} onValueChange={(v) => setFilters({...filters, categoryId: v})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="全部类目" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全部</SelectItem>
                      <SelectItem value="100">服装</SelectItem>
                      <SelectItem value="200">电子</SelectItem>
                      <SelectItem value="300">家居</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm">价格区间</Label>
                  <div className="flex gap-2 mt-1">
                    <Input 
                      type="number" 
                      placeholder="最低" 
                      className="flex-1"
                      value={filters.priceMin}
                      onChange={(e) => setFilters({...filters, priceMin: Number(e.target.value)})}
                    />
                    <Input 
                      type="number" 
                      placeholder="最高" 
                      className="flex-1"
                      value={filters.priceMax}
                      onChange={(e) => setFilters({...filters, priceMax: Number(e.target.value)})}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm">AI等级</Label>
                  <div className="flex gap-2 mt-1">
                    {['A', 'B', 'C', 'D'].map(grade => (
                      <Button
                        key={grade}
                        variant={filters.grades.includes(grade) ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'flex-1',
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

                <div>
                  <Label className="text-sm">数据来源</Label>
                  <div className="flex gap-2 mt-1 flex-wrap">
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

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setFilters({
                    categoryId: '',
                    priceMin: 0,
                    priceMax: 100000,
                    grades: [],
                    sources: [],
                  })}
                >
                  重置筛选
                </Button>
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
                  <SelectValue placeholder="选择类目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">服装配饰</SelectItem>
                  <SelectItem value="200">电子产品</SelectItem>
                  <SelectItem value="300">家居用品</SelectItem>
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
