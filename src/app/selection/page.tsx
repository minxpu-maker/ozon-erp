'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';
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
  Radio,
  Clock,
  TrendingUp,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProxiedImage, getProxiedImageUrl } from '@/components/ui/proxied-image';

// ============ Types ============

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
  marketSignalId?: number;  // 关联的市场信号ID
  signalSourceType?: 'wb' | 'ozon_market' | 'aliexpress' | '1688';  // 市场信号来源
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

interface MarketSignal {
  id: number;
  shopId: string;
  shopName?: string;
  sourceType: 'wb' | 'ozon_market' | 'aliexpress' | '1688';
  signalType: 'demand' | 'competition';
  productId: string;
  productTitle: string;
  productTitleZh?: string;
  productUrl: string;
  imageUrl?: string;
  images?: string[];
  brandName?: string;
  categoryPath?: string;
  categoryId?: number;
  categoryName?: string;
  price?: number;
  originalPrice?: number;
  salesVolume?: number;
  rating?: number;
  reviewsCount?: number;
  sellerCount?: number;
  collectedAt: string;
  processedAt?: string;
  rawData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // 前端状态
  isAdded?: boolean;
}

interface Shop {
  id: string;
  name: string;
}

interface Category {
  id: number;
  name: string;
}

// ============ Grade helpers ============

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

// ============ Source Type helpers ============

const getSourceTypeLabel = (sourceType: MarketSignal['sourceType']): string => {
  switch (sourceType) {
    case 'wb': return 'WB需求';
    case 'ozon_market': return 'Ozon竞争';
    case 'aliexpress': return '速卖通';
    case '1688': return '1688';
    default: return sourceType;
  }
};

const getSourceTypeColor = (sourceType: MarketSignal['sourceType']): string => {
  switch (sourceType) {
    case 'wb': return 'bg-purple-500 text-white';
    case 'ozon_market': return 'bg-blue-500 text-white';
    case 'aliexpress': return 'bg-orange-500 text-white';
    case '1688': return 'bg-green-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

// ============ Time helpers ============

const getRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN');
};

// ============ Main Component ============

export default function SelectionPage() {
  const router = useRouter();
  
  // ============ State ============
  
  // Common state
  const [shopId, setShopId] = useState('');
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(true);
  
  // Source Tab state (新增)
  const [sourceTab, setSourceTab] = useState<'opportunities' | 'signals'>('opportunities');
  
  // Opportunities state (原有)
  const [mode, setMode] = useState<'copy' | 'refine'>('copy');
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'matrix'>('card');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAIDigDialog, setShowAIDigDialog] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Opportunities filters (原有)
  const [filters, setFilters] = useState({
    categoryId: 'all',
    priceMin: 0,
    priceMax: 100000,
    grades: [] as string[],
    sources: [] as string[],
  });
  
  // AI Dig dialog state (原有)
  const [aiDigKeyword, setAiDigKeyword] = useState('');
  const [aiDigCategoryId, setAiDigCategoryId] = useState('');
  
  // Market Signals state (新增)
  const [signals, setSignals] = useState<MarketSignal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [signalFilters, setSignalFilters] = useState({
    sourceType: 'all' as 'all' | 'wb' | 'ozon_market',
    categoryId: 'all',
    timeRange: 'all' as 'today' | '3days' | '7days' | 'all',
  });
  const [signalStats, setSignalStats] = useState({
    total: 0,
    wbCount: 0,
    ozonCount: 0,
    todayNew: 0,
  });
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [addedSignalIds, setAddedSignalIds] = useState<Set<number>>(new Set());
  const [selectedSignalForPopup, setSelectedSignalForPopup] = useState<MarketSignal | null>(null);
  
  // Batch selection states
  const [selectedSignalIds, setSelectedSignalIds] = useState<Set<number>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isBatchOperating, setIsBatchOperating] = useState(false);
  const [ignoredSignalIds, setIgnoredSignalIds] = useState<Set<number>>(new Set());
  
  // Ref for long press timer
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // ============ Effects ============
  
  // Fetch initial data
  useEffect(() => {
    fetchShops();
    fetchCategories();
  }, []);
  
  // Fetch opportunities when shop/mode/filters change
  useEffect(() => {
    if (shopId && sourceTab === 'opportunities') {
      fetchOpportunities();
    }
  }, [shopId, mode, filters, sourceTab]);
  
  // Fetch signals when sourceTab or filters change
  useEffect(() => {
    if (shopId && sourceTab === 'signals') {
      fetchMarketSignals();
    }
  }, [shopId, signalFilters, sourceTab]);
  
  // ============ Data Fetching ============
  
  const fetchShops = async () => {
    try {
      const res = await fetch('/api/shops');
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        setShops(data.data);
        const tantanShop = data.data.find((s: Shop) => s.name === 'TIANTAN');
        setShopId(tantanShop?.id || data.data[0].id);
      } else {
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
        const flat: Category[] = [];
        const flatten = (cats: unknown[], prefix = '') => {
          (cats as Array<{ category_id: number; category_name: string; children?: unknown[] }>).forEach(cat => {
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
        setOpportunities(generateMockOpportunities());
      }
    } catch (error) {
      console.error('Failed to fetch opportunities:', error);
      setOpportunities(generateMockOpportunities());
    } finally {
      setLoading(false);
    }
  };
  
  const fetchMarketSignals = async () => {
    setSignalsLoading(true);
    try {
      const params = new URLSearchParams({
        shopId,
        limit: '50',
        offset: '0',
      });
      
      if (signalFilters.sourceType !== 'all') {
        params.append('sourceType', signalFilters.sourceType);
      }
      if (signalFilters.categoryId !== 'all') {
        params.append('categoryId', signalFilters.categoryId);
      }
      
      const res = await fetch(`/api/market-signals?${params}`);
      const data = await res.json();
      
      if (data.success && data.data?.signals) {
        // Apply time filter client-side
        let filteredSignals = data.data.signals as MarketSignal[];
        
        if (signalFilters.timeRange !== 'all') {
          const now = new Date();
          const cutoff = new Date(now.getTime() - (
            signalFilters.timeRange === 'today' ? 86400000 :
            signalFilters.timeRange === '3days' ? 259200000 :
            604800000 // 7days
          ));
          filteredSignals = filteredSignals.filter(s => new Date(s.collectedAt) >= cutoff);
        }
        
        // Mark added signals
        filteredSignals = filteredSignals.map(s => ({
          ...s,
          isAdded: addedSignalIds.has(s.id),
        }));
        
        setSignals(filteredSignals);
        
        // Calculate stats
        const total = data.data.total || filteredSignals.length;
        const wbCount = filteredSignals.filter(s => s.sourceType === 'wb').length;
        const ozonCount = filteredSignals.filter(s => s.sourceType === 'ozon_market').length;
        
        // Today's new count (compare to yesterday - simplified)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayNew = filteredSignals.filter(s => new Date(s.collectedAt) >= todayStart).length;
        
        setSignalStats({ total, wbCount, ozonCount, todayNew });
        setLastRefreshTime(new Date());
      } else {
        setSignals([]);
        setSignalStats({ total: 0, wbCount: 0, ozonCount: 0, todayNew: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch market signals:', error);
      setSignals([]);
    } finally {
      setSignalsLoading(false);
    }
  };
  
  // Generate mock opportunities
  const generateMockOpportunities = (): Opportunity[] => {
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
  
  // ============ Filtering ============
  
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(opp => {
      if (opp.marketAnalysis) {
        const avgPrice = (opp.marketAnalysis.priceRange.min + opp.marketAnalysis.priceRange.max) / 2;
        if (avgPrice < filters.priceMin || avgPrice > filters.priceMax) return false;
      }
      
      if (filters.grades.length > 0) {
        const grade = getGrade(opp.scores);
        if (!filters.grades.includes(grade)) return false;
      }
      
      if (filters.sources.length > 0) {
        if (!filters.sources.includes(opp.source)) return false;
      }
      
      return true;
    });
  }, [opportunities, filters]);
  
  const filteredSignals = useMemo(() => {
    return signals;
  }, [signals]);
  
  // ============ Chart Data ============
  
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
  
  const getTrendData = (trend: 'up' | 'down' | 'stable') => {
    const base = trend === 'up' ? 50 : trend === 'down' ? 80 : 65;
    return Array.from({ length: 7 }, (_, i) => ({
      day: i,
      value: base + (trend === 'up' ? i * 5 : trend === 'down' ? -i * 5 : Math.sin(i) * 10),
    }));
  };
  
  // Scatter data for opportunities matrix view
  const oppScatterData = useMemo(() => {
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
  
  // Scatter data for signals matrix view
  const signalScatterData = useMemo(() => {
    return filteredSignals.map(signal => {
      const color = signal.sourceType === 'wb' ? '#9333ea' : '#3b82f6';
      const priceNum = Number(signal.price || 0);
      const salesNum = Number(signal.salesVolume || 0);
      const sellerNum = Number(signal.sellerCount || 0);
      const ratingNum = Number(signal.rating || 0);
      return {
        x: priceNum,
        y: signal.sourceType === 'wb' 
          ? salesNum 
          : (100 - sellerNum), // Ozon: seller count inverse (fewer sellers = higher Y = better opportunity)
        z: signal.sourceType === 'wb' 
          ? (salesNum || 100) 
          : (ratingNum * 20 || 100), // WB: bubble size by sales, Ozon: by rating (scale rating 0-5 to 0-100)
        id: signal.id,
        name: signal.productTitleZh || signal.productTitle,
        color,
        sourceType: signal.sourceType,
        signal, // Include full signal data for popup
      };
    });
  }, [filteredSignals]);
  
  // ============ Actions ============
  
  // Opportunities actions
  const handleConfirm = async (id: string) => {
    try {
      await fetch(`/api/selection/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
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
        console.log('选品任务完成:', result);
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
  
  // Signal actions (新增)
  const handleAddToSelection = async (signalId: number) => {
    try {
      const signal = signals.find(s => s.id === signalId);
      if (!signal) return;
      
      const response = await fetch('/api/selection/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          source: 'system_recommend',
          selectionMode: mode,
          targetType: 'product',
          marketSignalId: signalId,
          status: 'suggested',
          // Additional data from signal
          targetName: signal.productTitleZh || signal.productTitle,
          targetImage: signal.imageUrl,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Mark as added
        setAddedSignalIds(prev => new Set([...prev, signalId]));
        setSignals(prev => prev.map(s => 
          s.id === signalId ? { ...s, isAdded: true } : s
        ));
        toast.success('已加入选品', {
          description: signal.productTitleZh || signal.productTitle,
        });
      } else {
        toast.error('加入选品失败', {
          description: result.error || '请稍后重试',
        });
      }
    } catch (error) {
      console.error('Failed to add to selection:', error);
      toast.error('加入选品失败', {
        description: '网络错误，请稍后重试',
      });
    }
  };
  
  const handleIgnoreSignal = (signalId: number) => {
    // Add to ignored set and remove from display
    setIgnoredSignalIds(prev => new Set([...prev, signalId]));
    setSignals(prev => prev.filter(s => s.id !== signalId));
    setSelectedSignalIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(signalId);
      return newSet;
    });
    toast.success('已忽略该信号');
  };
  
  // Batch operations
  const handleBatchAddToSelection = async () => {
    if (selectedSignalIds.size === 0) return;
    setIsBatchOperating(true);
    
    const signalIds = Array.from(selectedSignalIds);
    let successCount = 0;
    let failCount = 0;
    
    for (const signalId of signalIds) {
      const signal = signals.find(s => s.id === signalId);
      if (!signal || addedSignalIds.has(signalId)) continue;
      
      try {
        const response = await fetch('/api/selection/opportunities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopId,
            source: 'system_recommend',
            selectionMode: mode,
            targetType: 'product',
            marketSignalId: signalId,
            status: 'suggested',
            targetName: signal.productTitleZh || signal.productTitle,
            targetImage: signal.imageUrl,
          }),
        });
        
        const result = await response.json();
        if (result.success) {
          successCount++;
          setAddedSignalIds(prev => new Set([...prev, signalId]));
          setSignals(prev => prev.map(s => 
            s.id === signalId ? { ...s, isAdded: true } : s
          ));
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }
    }
    
    setIsBatchOperating(false);
    setSelectedSignalIds(new Set());
    setIsMultiSelectMode(false);
    
    if (successCount > 0) {
      toast.success(`已加入${successCount}个选品`);
    }
    if (failCount > 0) {
      toast.error(`${failCount}个加入失败`);
    }
  };
  
  const handleBatchIgnore = () => {
    if (selectedSignalIds.size === 0) return;
    
    const count = selectedSignalIds.size;
    setIgnoredSignalIds(prev => new Set([...prev, ...Array.from(selectedSignalIds)]));
    setSignals(prev => prev.filter(s => !selectedSignalIds.has(s.id)));
    setSelectedSignalIds(new Set());
    setIsMultiSelectMode(false);
    toast.success(`已忽略${count}个信号`);
  };
  
  const toggleSignalSelection = (signalId: number) => {
    setSelectedSignalIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(signalId)) {
        newSet.delete(signalId);
      } else {
        newSet.add(signalId);
      }
      return newSet;
    });
  };
  
  const toggleAllSignalSelection = () => {
    const displayedSignals = signals.filter(s => !ignoredSignalIds.has(s.id));
    if (selectedSignalIds.size === displayedSignals.length) {
      setSelectedSignalIds(new Set());
    } else {
      setSelectedSignalIds(new Set(displayedSignals.map(s => s.id)));
    }
  };
  
  const exitMultiSelectMode = () => {
    setIsMultiSelectMode(false);
    setSelectedSignalIds(new Set());
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
  
  // ============ Render ============
  
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
            
            {/* Source Tab Toggle (新增) */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <Button
                variant={sourceTab === 'opportunities' ? 'default' : 'ghost'}
                size="sm"
                className={cn('rounded-none', sourceTab === 'opportunities' && 'bg-[#2F6BFF]')}
                onClick={() => setSourceTab('opportunities')}
              >
                已选品
              </Button>
              <Button
                variant={sourceTab === 'signals' ? 'default' : 'ghost'}
                size="sm"
                className={cn('rounded-none', sourceTab === 'signals' && 'bg-[#2F6BFF]')}
                onClick={() => setSourceTab('signals')}
              >
                市场信号
              </Button>
            </div>
            
            {/* Mode Toggle (只在opportunities tab显示) */}
            {sourceTab === 'opportunities' && (
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
            )}
            
            {/* Signal Source Filter (只在signals tab显示，新增) */}
            {sourceTab === 'signals' && (
              <div className="flex rounded-lg border border-border overflow-hidden">
                <Button
                  variant={signalFilters.sourceType === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn('rounded-none', signalFilters.sourceType === 'all' && 'bg-[#2F6BFF]')}
                  onClick={() => setSignalFilters({...signalFilters, sourceType: 'all'})}
                >
                  全部
                </Button>
                <Button
                  variant={signalFilters.sourceType === 'wb' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn('rounded-none bg-purple-500', signalFilters.sourceType === 'wb' && 'bg-purple-600')}
                  onClick={() => setSignalFilters({...signalFilters, sourceType: 'wb'})}
                >
                  WB需求
                </Button>
                <Button
                  variant={signalFilters.sourceType === 'ozon_market' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn('rounded-none bg-blue-500', signalFilters.sourceType === 'ozon_market' && 'bg-blue-600')}
                  onClick={() => setSignalFilters({...signalFilters, sourceType: 'ozon_market'})}
                >
                  Ozon竞争
                </Button>
              </div>
            )}
            
            {/* AI Dig Button (只在opportunities tab) */}
            {sourceTab === 'opportunities' && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setShowAIDigDialog(true)}
              >
                <Sparkles className="w-4 h-4" />
                AI深挖
              </Button>
            )}
            
            {/* System Recommend Button (只在opportunities tab) */}
            {sourceTab === 'opportunities' && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={handleSystemRecommend}
              >
                <Lightbulb className="w-4 h-4" />
                系统推荐
              </Button>
            )}
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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={sourceTab === 'opportunities' ? fetchOpportunities : fetchMarketSignals} 
              disabled={loading || signalsLoading}
            >
              <RefreshCw className={cn('w-4 h-4', (loading || signalsLoading) && 'animate-spin')} />
            </Button>
          </div>
        </div>
        
        {/* Signal Stats Bar (只在signals tab显示，新增) */}
        {sourceTab === 'signals' && (
          <div className="flex gap-3 mb-4">
            <Card className="px-4 py-2 bg-white">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">信号总数</span>
                <span className="text-lg font-semibold">{signalStats.total}</span>
              </div>
            </Card>
            <Card className="px-4 py-2 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-sm text-muted-foreground">WB信号</span>
                <span className="text-lg font-semibold">{signalStats.wbCount}</span>
              </div>
            </Card>
            <Card className="px-4 py-2 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm text-muted-foreground">Ozon信号</span>
                <span className="text-lg font-semibold">{signalStats.ozonCount}</span>
              </div>
            </Card>
            {signalStats.todayNew > 0 && (
              <Card className="px-4 py-2 bg-white">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">今日新增</span>
                  <span className="text-lg font-semibold text-green-500">↑{signalStats.todayNew}</span>
                </div>
              </Card>
            )}
            {addedSignalIds.size > 0 && (
              <Card className="px-4 py-2 bg-white">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">已加入</span>
                  <span className="text-lg font-semibold text-green-500">{addedSignalIds.size}</span>
                </div>
              </Card>
            )}
            {lastRefreshTime && (
              <span className="text-xs text-muted-foreground ml-auto">
                最后刷新: {getRelativeTime(lastRefreshTime.toISOString())}
              </span>
            )}
          </div>
        )}
        
        {/* Signal Time Filter (只在signals tab显示，新增) */}
        {sourceTab === 'signals' && (
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">采集时间:</span>
            <div className="flex gap-1">
              {(['today', '3days', '7days', 'all'] as const).map(range => (
                <Button
                  key={range}
                  variant={signalFilters.timeRange === range ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setSignalFilters({...signalFilters, timeRange: range})}
                >
                  {range === 'today' ? '今天' : range === '3days' ? '3天内' : range === '7days' ? '7天内' : '全部'}
                </Button>
              ))}
            </div>
          </div>
        )}
        
        {/* Main Content */}
        <div className="flex flex-1 gap-4 min-h-0">
          {/* Main Area */}
          <div className="flex-1 overflow-auto">
            {/* Opportunities View */}
            {sourceTab === 'opportunities' && (
              loading ? (
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
                /* Opportunities Card View */
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
                            {/* 来源标签 */}
                            <div className="absolute top-2 left-2 flex flex-col gap-1">
                              <Badge variant="outline" className="text-xs">
                                {opp.source === 'ozon' ? 'Ozon' : opp.source === 'aliexpress' ? '速卖通' : '1688'}
                              </Badge>
                              {/* 市场信号来源标签 */}
                              {opp.signalSourceType && (
                                <Badge className={cn('text-xs', getSourceTypeColor(opp.signalSourceType))}>
                                  {getSourceTypeLabel(opp.signalSourceType)}
                                </Badge>
                              )}
                            </div>
                            {/* 数据完整度标签 */}
                            {opp.marketSignalId && (
                              <div className="absolute top-2 right-2">
                                <Badge className="text-xs bg-yellow-500/80 text-white">
                                  单源数据
                                </Badge>
                              </div>
                            )}
                          </div>
                          
                          <h3 className="font-medium text-sm mb-2 line-clamp-2">{opp.targetName}</h3>
                          
                          <div className="h-28 mb-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart data={getRadarData(scores)}>
                                <PolarGrid stroke="#E6EAF2" />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
                                <PolarRadiusAxis tick={false} />
                                <Radar name="评分" dataKey="value" stroke="#2F6BFF" fill="#2F6BFF" fillOpacity={0.3} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                          
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
                          
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={cn('text-white', gradeColors[grade])}>{grade}级</Badge>
                            <div className="flex items-center text-xs text-muted-foreground">
                              {opp.marketAnalysis?.trend === 'up' ? (
                                <ArrowUpRight className="w-3 h-3 text-green-500" />
                              ) : opp.marketAnalysis?.trend === 'down' ? (
                                <ArrowDownRight className="w-3 h-3 text-red-500" />
                              ) : (
                                <Minus className="w-3 h-3 text-gray-400" />
                              )}
                              <span className="ml-1">{opp.marketAnalysis?.sellerCount || 0} 在售</span>
                            </div>
                          </div>
                          
                          <div className="text-xs text-muted-foreground mb-3">
                            ₽{opp.marketAnalysis?.priceRange?.min?.toLocaleString() || 0} - ₽{opp.marketAnalysis?.priceRange?.max?.toLocaleString() || 0}
                          </div>
                          
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
                /* Opportunities List View */
                <div className="bg-white rounded-lg border">
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
                        <th className="p-3 text-left text-sm font-medium">来源</th>
                        <th className="p-3 text-left text-sm font-medium">数据</th>
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
                            <td className="p-3">
                              <div className="flex flex-col gap-1">
                                <Badge variant="outline" className="text-xs">
                                  {opp.source === 'ozon' ? 'Ozon' : opp.source === 'aliexpress' ? '速卖通' : '1688'}
                                </Badge>
                                {opp.signalSourceType && (
                                  <Badge className={cn('text-xs', getSourceTypeColor(opp.signalSourceType))}>
                                    {getSourceTypeLabel(opp.signalSourceType)}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              {opp.marketSignalId ? (
                                <Badge className="text-xs bg-yellow-500/80 text-white">
                                  单源数据
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">{opp.targetCategoryName || '-'}</td>
                            <td className="p-3 text-sm">₽{opp.marketAnalysis?.priceRange?.min?.toLocaleString() || '-'}</td>
                            <td className="p-3">
                              <span className={cn('font-medium', gradeTextColors[grade])}>{avgScore}</span>
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
                              <Badge className={cn('text-white', gradeColors[grade])}>{grade}</Badge>
                            </td>
                            <td className="p-3" onClick={e => e.stopPropagation()}>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={`/selection/${opp.id}`}>
                                    <Eye className="w-3 h-3" />
                                  </a>
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleConfirm(opp.id)}>
                                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleAbandon(opp.id)}>
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
                /* Opportunities Matrix View */
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="text-sm font-medium mb-4">竞争-利润矩阵图</h3>
                  <div className="h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
                        <XAxis type="number" dataKey="x" name="竞争强度" domain={[0, 100]} label={{ value: '竞争强度 →', position: 'bottom', offset: 0 }} tick={{ fontSize: 11 }} />
                        <YAxis type="number" dataKey="y" name="利润空间" domain={[0, 100]} label={{ value: '利润空间 →', angle: -90, position: 'left' }} tick={{ fontSize: 11 }} />
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
                        <Scatter name="商品" data={oppScatterData}>
                          {oppScatterData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={gradeScatterColors[entry.grade]} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-500" /><span className="text-xs">A级 (优质)</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-500" /><span className="text-xs">B级 (良好)</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-orange-500" /><span className="text-xs">C级 (一般)</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-500" /><span className="text-xs">D级 (较差)</span></div>
                  </div>
                </div>
              )
            )}
            
            {/* Signals View (新增) */}
            {sourceTab === 'signals' && (
              signalsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredSignals.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Radio className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg mb-2">暂无市场数据</p>
                  <p className="text-sm mb-4">请使用Chrome插件浏览WB/Ozon商品页，点击一键采集</p>
                  <Button onClick={() => setSourceTab('opportunities')}>
                    查看已选品
                  </Button>
                </div>
              ) : viewMode === 'card' ? (
                /* Signals Card View */
                <>
                  {/* Batch operation bar for multi-select mode */}
                  {isMultiSelectMode && selectedSignalIds.size > 0 && (
                    <div className="sticky top-0 z-10 bg-[#2F6BFF] text-white px-4 py-2 rounded-lg mb-4 flex items-center justify-between">
                      <span>已选 {selectedSignalIds.size} 项</span>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleBatchAddToSelection}
                          disabled={isBatchOperating}
                        >
                          {isBatchOperating ? '处理中...' : '批量加入选品'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleBatchIgnore}
                          className="bg-white/20 hover:bg-white/30"
                        >
                          批量忽略
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={exitMultiSelectMode}
                          className="text-white hover:bg-white/20"
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredSignals.map(signal => (
                      <Card 
                        key={signal.id} 
                        className={cn(
                          'transition-all hover:shadow-lg bg-white select-none',
                          isMultiSelectMode && selectedSignalIds.has(signal.id) && 'ring-2 ring-[#2F6BFF]',
                          signal.isAdded && 'opacity-75'
                        )}
                        onClick={() => {
                          if (isMultiSelectMode) {
                            toggleSignalSelection(signal.id);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (!isMultiSelectMode) {
                            setIsMultiSelectMode(true);
                            setSelectedSignalIds(new Set([signal.id]));
                          }
                        }}
                        onTouchStart={(e) => {
                          if (!isMultiSelectMode && !signal.isAdded) {
                            longPressTimerRef.current = setTimeout(() => {
                              setIsMultiSelectMode(true);
                              setSelectedSignalIds(new Set([signal.id]));
                            }, 500);
                          }
                        }}
                        onTouchEnd={() => {
                          if (longPressTimerRef.current) {
                            clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                          }
                        }}
                        onTouchMove={() => {
                          if (longPressTimerRef.current) {
                            clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                          }
                        }}
                        onMouseDown={(e) => {
                          if (!isMultiSelectMode && !signal.isAdded && e.button === 0) {
                            longPressTimerRef.current = setTimeout(() => {
                              setIsMultiSelectMode(true);
                              setSelectedSignalIds(new Set([signal.id]));
                            }, 500);
                          }
                        }}
                        onMouseUp={() => {
                          if (longPressTimerRef.current) {
                            clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                          }
                        }}
                        onMouseLeave={() => {
                          if (longPressTimerRef.current) {
                            clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                          }
                        }}
                      >
                        <CardContent className="p-4">
                          {/* Selection indicator for multi-select mode */}
                          {isMultiSelectMode && (
                            <div className="absolute top-2 right-2 z-10">
                              <div className={cn(
                                'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                                selectedSignalIds.has(signal.id)
                                  ? 'bg-[#2F6BFF] border-[#2F6BFF]'
                                  : 'bg-white border-gray-300'
                              )}>
                                {selectedSignalIds.has(signal.id) && (
                                  <CheckCircle className="w-3 h-3 text-white" />
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Image */}
                          <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                            {signal.imageUrl ? (
                              <ProxiedImage
                                src={signal.imageUrl}
                                alt={signal.productTitleZh || signal.productTitle}
                                className="w-full h-full object-cover"
                                iconSize="lg"
                              />
                            ) : (
                              <Package className="w-12 h-12 text-muted-foreground/30" />
                            )}
                            {/* Source Badge */}
                            <Badge className={cn('absolute top-2 left-2 text-xs', getSourceTypeColor(signal.sourceType))}>
                              {getSourceTypeLabel(signal.sourceType)}
                            </Badge>
                          </div>
                        
                        {/* Title */}
                        <h3 className="font-medium text-sm mb-2 line-clamp-2">
                          {signal.productTitleZh || signal.productTitle}
                        </h3>
                        
                        {/* Price */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg font-semibold">₽{Number(signal.price || 0).toLocaleString()}</span>
                          {signal.originalPrice && Number(signal.originalPrice) > Number(signal.price || 0) && (
                            <span className="text-sm text-muted-foreground line-through">
                              ₽{Number(signal.originalPrice).toLocaleString()}
                            </span>
                          )}
                        </div>
                        
                        {/* Data Row */}
                        <div className="text-xs text-muted-foreground mb-2">
                          {signal.sourceType === 'wb' ? (
                            <span>★{Number(signal.rating || 0).toFixed(1)} | 销量{Number(signal.salesVolume || 0).toLocaleString()} | {Number(signal.reviewsCount || 0).toLocaleString()}评</span>
                          ) : (
                            <span>{signal.sellerCount || '-'}家卖家 | ★{Number(signal.rating || 0).toFixed(1)}</span>
                          )}
                        </div>
                        
                        {/* Brand */}
                        {signal.brandName && (
                          <div className="text-xs text-muted-foreground mb-2">
                            品牌: {signal.brandName}
                          </div>
                        )}
                        
                        {/* Time */}
                        <div className="text-xs text-muted-foreground mb-3">
                          {getRelativeTime(signal.collectedAt)}
                        </div>
                        
                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            className={cn(
                              'flex-1',
                              signal.isAdded ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#2F6BFF]'
                            )}
                            disabled={signal.isAdded}
                            onClick={() => handleAddToSelection(signal.id)}
                          >
                            {signal.isAdded ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                已加入
                              </>
                            ) : (
                              '加入选品'
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => handleIgnoreSignal(signal.id)}
                          >
                            忽略
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                </>
              ) : viewMode === 'list' ? (
                /* Signals List View */
                <>
                  {/* Batch operation bar for list mode */}
                  {selectedSignalIds.size > 0 && (
                    <div className="sticky top-0 z-10 bg-[#2F6BFF] text-white px-4 py-2 rounded-lg mb-4 flex items-center justify-between">
                      <span>已选 {selectedSignalIds.size} 项</span>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleBatchAddToSelection}
                          disabled={isBatchOperating}
                        >
                          {isBatchOperating ? '处理中...' : '批量加入选品'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleBatchIgnore}
                          className="bg-white/20 hover:bg-white/30"
                        >
                          批量忽略
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSignalIds(new Set())}
                          className="text-white hover:bg-white/20"
                        >
                          取消选择
                        </Button>
                      </div>
                    </div>
                  )}
                <div className="bg-white rounded-lg border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="p-3 text-left text-sm font-medium w-[50px]">
                          <Checkbox
                            checked={filteredSignals.length > 0 && filteredSignals.every(s => selectedSignalIds.has(s.id))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedSignalIds(new Set(filteredSignals.map(s => s.id)));
                              } else {
                                setSelectedSignalIds(new Set());
                              }
                            }}
                          />
                        </th>
                        <th className="p-3 text-left text-sm font-medium">图片</th>
                        <th className="p-3 text-left text-sm font-medium">标题</th>
                        <th className="p-3 text-left text-sm font-medium">来源</th>
                        <th className="p-3 text-left text-sm font-medium">价格</th>
                        <th className="p-3 text-left text-sm font-medium">评分/数据</th>
                        <th className="p-3 text-left text-sm font-medium">品牌</th>
                        <th className="p-3 text-left text-sm font-medium">采集时间</th>
                        <th className="p-3 text-left text-sm font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSignals.map(signal => (
                        <tr key={signal.id} className="border-b hover:bg-muted/30">
                          <td className="p-3 w-[40px]">
                            <Checkbox
                              checked={selectedSignalIds.has(signal.id)}
                              onCheckedChange={(checked) => {
                                setSelectedSignalIds(prev => {
                                  const newSet = new Set(prev);
                                  if (checked) {
                                    newSet.add(signal.id);
                                  } else {
                                    newSet.delete(signal.id);
                                  }
                                  return newSet;
                                });
                              }}
                            />
                          </td>
                          <td className="p-3">
                            <div className="w-[50px] h-[50px] bg-muted rounded flex items-center justify-center">
                              {signal.imageUrl ? (
                                <ProxiedImage
                                  src={signal.imageUrl}
                                  alt={signal.productTitleZh || signal.productTitle}
                                  className="w-full h-full object-cover"
                                  iconSize="sm"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-muted-foreground/50" />
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-sm line-clamp-2">{signal.productTitleZh || signal.productTitle}</span>
                          </td>
                          <td className="p-3">
                            <Badge className={cn('text-xs', getSourceTypeColor(signal.sourceType))}>
                              {getSourceTypeLabel(signal.sourceType)}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-medium">₽{Number(signal.price || 0).toLocaleString()}</span>
                              {signal.originalPrice && Number(signal.originalPrice) > Number(signal.price || 0) && (
                                <span className="text-xs text-muted-foreground line-through">
                                  ₽{Number(signal.originalPrice).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {signal.sourceType === 'wb' ? (
                              <span>★{Number(signal.rating || 0).toFixed(1)} | 销量{Number(signal.salesVolume || 0).toLocaleString()}</span>
                            ) : (
                              <span>{signal.sellerCount || '-'}家卖家 | ★{Number(signal.rating || 0).toFixed(1)}</span>
                            )}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">{signal.brandName || '-'}</td>
                          <td className="p-3 text-xs text-muted-foreground">{getRelativeTime(signal.collectedAt)}</td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <Button
                                variant={signal.isAdded ? 'outline' : 'default'}
                                size="sm"
                                className={cn(signal.isAdded && 'text-gray-400')}
                                disabled={signal.isAdded}
                                onClick={() => handleAddToSelection(signal.id)}
                              >
                                {signal.isAdded ? '已加入' : '加入选品'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground"
                                onClick={() => handleIgnoreSignal(signal.id)}
                              >
                                忽略
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              ) : (
                /* Signals Matrix View */
                <div className="bg-white rounded-lg border p-4">
                  {/* 批量操作栏 */}
                  {selectedSignalIds.size > 0 && (
                    <div className="mb-4 p-3 bg-primary/5 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium">已选 {selectedSignalIds.size} 项</span>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          className="bg-primary text-primary-foreground"
                          onClick={handleBatchAddToSelection}
                        >
                          批量加入选品
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={handleBatchIgnore}
                        >
                          批量忽略
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setSelectedSignalIds(new Set())}
                        >
                          取消选择
                        </Button>
                      </div>
                    </div>
                  )}
                  <h3 className="text-sm font-medium mb-2">价格-热度矩阵图</h3>
                  <p className="text-xs text-muted-foreground mb-4">点击气泡查看详情，按住 Shift 点击可多选</p>
                  <div className="h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
                        <XAxis 
                          type="number" 
                          dataKey="x" 
                          name="价格" 
                          domain={[0, 'auto']}
                          label={{ value: '价格 (₽) →', position: 'bottom', offset: 0 }}
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => `₽${v}`}
                        />
                        <YAxis 
                          type="number" 
                          dataKey="y" 
                          name="热度" 
                          domain={[0, 'auto']}
                          label={{ value: '热度 →', angle: -90, position: 'left' }}
                          tick={{ fontSize: 11 }}
                        />
                        <ZAxis type="number" dataKey="z" range={[100, 1000]} name="大小" />
                        <Tooltip 
                          cursor={{ strokeDasharray: '3 3' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white border rounded-lg p-3 shadow-lg">
                                  <p className="font-medium text-sm mb-1">{data.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    价格: ₽{Math.round(data.x)} | 热度: {Math.round(data.y)}
                                  </p>
                                  <Badge className={cn('mt-2', data.sourceType === 'wb' ? 'bg-purple-500' : 'bg-blue-500')}>
                                    {data.sourceType === 'wb' ? 'WB需求' : 'Ozon竞争'}
                                  </Badge>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter name="市场信号" data={signalScatterData} onClick={(data, mouseEvent) => {
                          if (data && data.payload) {
                            // Shift + 点击：多选模式
                            const evt = mouseEvent as unknown as { shiftKey?: boolean } | undefined;
                            if (evt && evt.shiftKey) {
                              setSelectedSignalIds(prev => {
                                const newSet = new Set(prev);
                                const signalId = data.payload.signal.id;
                                if (newSet.has(signalId)) {
                                  newSet.delete(signalId);
                                } else {
                                  newSet.add(signalId);
                                }
                                return newSet;
                              });
                            } else {
                              // 普通点击：弹出详情卡片
                              setSelectedSignalForPopup(data.payload.signal);
                            }
                          }
                        }}>
                          {signalScatterData.map((entry, index) => {
                            const isSelected = selectedSignalIds.has(entry.signal.id);
                            return (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.color} 
                                fillOpacity={isSelected ? 1 : 0.7}
                                stroke={isSelected ? '#152033' : 'transparent'}
                                strokeWidth={isSelected ? 2 : 0}
                                style={{ cursor: 'pointer' }} 
                              />
                            );
                          })}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-purple-500" /><span className="text-xs">WB需求信号</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-500" /><span className="text-xs">Ozon竞争信号</span></div>
                  </div>
                  
                  {/* 点击气泡弹出商品卡片详情 */}
                  {selectedSignalForPopup && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedSignalForPopup(null)}>
                      <div className="bg-white rounded-xl p-6 max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-4">
                          <ProxiedImage
                            src={selectedSignalForPopup.imageUrl}
                            alt={selectedSignalForPopup.productTitleZh || selectedSignalForPopup.productTitle}
                            className="w-24 h-24 rounded-lg object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm line-clamp-2 mb-2">
                              {selectedSignalForPopup.productTitleZh || selectedSignalForPopup.productTitle}
                            </h3>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg font-semibold text-foreground">
                                ₽{Number(selectedSignalForPopup.price || 0).toLocaleString()}
                              </span>
                              {selectedSignalForPopup.originalPrice && (
                                <span className="text-sm text-muted-foreground line-through">
                                  ₽{Number(selectedSignalForPopup.originalPrice || 0).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <Badge className={selectedSignalForPopup.sourceType === 'wb' ? 'bg-purple-500' : 'bg-blue-500'}>
                              {selectedSignalForPopup.sourceType === 'wb' ? 'WB需求' : 'Ozon竞争'}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                          {selectedSignalForPopup.sourceType === 'wb' ? (
                            <>
                              <span>★{Number(selectedSignalForPopup.rating || 0).toFixed(1)}</span>
                              <span>销量{(Number(selectedSignalForPopup.salesVolume || 0)).toLocaleString()}</span>
                              <span>{selectedSignalForPopup.reviewsCount}评</span>
                            </>
                          ) : (
                            <>
                              <span>{selectedSignalForPopup.sellerCount}家卖家</span>
                              <span>★{Number(selectedSignalForPopup.rating || 0).toFixed(1)}</span>
                            </>
                          )}
                        </div>
                        {selectedSignalForPopup.brandName && (
                          <div className="mt-2 text-xs text-muted-foreground">品牌: {selectedSignalForPopup.brandName}</div>
                        )}
                        <div className="mt-4 flex gap-2">
                          <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => {
                            handleAddToSelection(selectedSignalForPopup.id);
                            setSelectedSignalForPopup(null);
                          }}>
                            加入选品
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => {
                            handleIgnoreSignal(selectedSignalForPopup.id);
                            setSelectedSignalForPopup(null);
                          }}>
                            忽略
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setSelectedSignalForPopup(null)}>
                            关闭
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
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
                  onClick={() => sourceTab === 'opportunities' 
                    ? setFilters({ categoryId: 'all', priceMin: 0, priceMax: 100000, grades: [], sources: [] })
                    : setSignalFilters({ sourceType: 'all', categoryId: 'all', timeRange: 'all' })
                  }
                >
                  重置
                </Button>
              </div>
              
              {/* Opportunities Filters */}
              {sourceTab === 'opportunities' && (
                <div className="space-y-5">
                  <div>
                    <Label className="text-sm mb-2 block">类目</Label>
                    <Select value={filters.categoryId} onValueChange={(v) => setFilters({...filters, categoryId: v})}>
                      <SelectTrigger><SelectValue placeholder="全部类目" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        {categories.slice(0, 20).map(cat => (
                          <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
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
                  
                  <div>
                    <Label className="text-sm mb-2 block">AI等级</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {['A', 'B', 'C', 'D'].map(grade => (
                        <Button
                          key={grade}
                          variant={filters.grades.includes(grade) ? 'default' : 'outline'}
                          size="sm"
                          className={cn(filters.grades.includes(grade) && gradeColors[grade])}
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
                  
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      共 <span className="font-medium text-foreground">{filteredOpportunities.length}</span> 个结果
                    </p>
                  </div>
                </div>
              )}
              
              {/* Signals Filters */}
              {sourceTab === 'signals' && (
                <div className="space-y-5">
                  <div>
                    <Label className="text-sm mb-2 block">类目</Label>
                    <Select 
                      value={signalFilters.categoryId} 
                      onValueChange={(v) => setSignalFilters({...signalFilters, categoryId: v})}
                    >
                      <SelectTrigger><SelectValue placeholder="全部类目" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        {categories.slice(0, 20).map(cat => (
                          <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      共 <span className="font-medium text-foreground">{filteredSignals.length}</span> 条信号
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* AI Dig Dialog */}
      <Dialog open={showAIDigDialog} onOpenChange={setShowAIDigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI 深挖</DialogTitle>
            <DialogDescription>输入关键词或选择类目，AI 将为您深度挖掘潜在商机</DialogDescription>
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
                <SelectTrigger className="mt-1"><SelectValue placeholder="选择类目（可选）" /></SelectTrigger>
                <SelectContent>
                  {categories.slice(0, 20).map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIDigDialog(false)}>取消</Button>
            <Button onClick={handleAIDig}>
              <Sparkles className="w-4 h-4 mr-2" />
              开始深挖
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast 提示 */}
      <Toaster position="top-center" richColors />
    </AppLayout>
  );
}