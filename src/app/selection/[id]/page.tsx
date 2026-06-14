'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Star,
  ShoppingCart,
  Eye,
  Bell,
  Database,
  TrendingUp,
  TrendingDown,
  Minus,
  Package2,
  Building2,
  Truck,
  Calendar,
  Scale,
  Box,
  MessageCircle,
  AlertTriangle,
  Lock,
  Bot,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ Types ============

type DetailTab = 'basic' | 'trends' | 'keywords' | 'ai-analysis';

interface MarketSignal {
  id: number;
  productId: string;
  title: string;
  imageUrl: string;
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
  profitRate?: number;
  returnRate?: number;
  impressions?: number;
  cardViews?: number;
  cartRate?: number;
  adShare?: number;
  qaCount?: number;
  totalImpressions?: number;
  lostRevenue?: number;
  keywords?: string[];
}

interface TrendData {
  date: string;
  sales: number;
  price: number;
  revenue: number;
}

// ============ Mock Data ============

function generateMockDetail(): MarketSignal {
  return {
    id: 1,
    productId: 'Ozon-12345678',
    title: '无线蓝牙耳机 降噪耳机 运动耳机 高品质音效 兼容iOS Android',
    imageUrl: 'https://picsum.photos/seed/detail/400/400',
    sku: 'SKU0001234',
    brand: '品牌A',
    category: '电子产品',
    categoryPath: '根类目 / 电子产品 / 耳机音响',
    platform: 'ozon',
    price: 2999,
    originalPrice: 3999,
    salesVolume: 12580,
    revenue: 2999 * 12580,
    rating: 4.7,
    reviewCount: 3856,
    sellerName: '官方旗舰店',
    sellerType: 'local',
    deliveryType: 'FBS',
    weight: 280,
    volume: 0.8,
    dimensions: { length: 15, width: 10, height: 8 },
    listedDate: '2024-03-15',
    variantCount: 8,
    stock: 1256,
    profitRate: 28.5,
    returnRate: 3.2,
    impressions: 856000,
    cardViews: 428000,
    cartRate: 6.8,
    adShare: 15.2,
    qaCount: 89,
    totalImpressions: 1250000,
    lostRevenue: 186500,
    keywords: ['蓝牙耳机', '降噪耳机', '无线耳机', '运动耳机', '高颜值耳机'],
  };
}

function generateTrendData(): TrendData[] {
  const data: TrendData[] = [];
  const baseDate = new Date('2025-06-01');
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      sales: Math.floor(Math.random() * 500 + 300),
      price: Math.floor(Math.random() * 500 + 2800),
      revenue: Math.floor(Math.random() * 1500000 + 1000000),
    });
  }
  
  return data;
}

// ============ Components ============

function MetricCard({
  label,
  value,
  subValue,
  trend,
  trendValue,
  icon: Icon,
  warning,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ElementType;
  warning?: boolean;
}) {
  return (
    <Card className={cn('flex-1 min-w-[160px]', warning && 'border-[#F59E0B] bg-[#FFFBEB]')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[#637089] mb-1">{label}</p>
            <p className="text-lg font-semibold text-[#1F2937]">{value}</p>
            {subValue && <p className="text-xs text-[#9CA3AF] mt-0.5">{subValue}</p>}
          </div>
          {Icon && <Icon className="w-5 h-5 text-[#9CA3AF]" />}
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend === 'up' && <TrendingUp className="w-3 h-3 text-[#10B981]" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3 text-[#EF4444]" />}
            {trend === 'neutral' && <Minus className="w-3 h-3 text-[#9CA3AF]" />}
            <span className={cn(
              'text-xs',
              trend === 'up' && 'text-[#10B981]',
              trend === 'down' && 'text-[#EF4444]',
              trend === 'neutral' && 'text-[#9CA3AF]'
            )}>
              {trendValue}
            </span>
          </div>
        )}
        {warning && (
          <div className="flex items-center gap-1 mt-2 text-[#F59E0B]">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-xs">需关注</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BasicInfoTab({ data }: { data: MarketSignal }) {
  const metrics = [
    { label: '售价', value: `₽${data.price.toLocaleString()}`, subValue: data.originalPrice ? `原价 ₽${data.originalPrice.toLocaleString()}` : undefined, icon: Package2, trend: 'up' as const, trendValue: '+5.2%' },
    { label: '销量', value: data.salesVolume?.toLocaleString() || '—', subValue: '30天', icon: TrendingUp, trend: 'up' as const, trendValue: '+12.8%' },
    { label: '销售额', value: data.revenue ? `₽${(data.revenue / 10000).toFixed(0)}万` : '—', icon: Box, trend: 'up' as const, trendValue: '+18.3%' },
    { label: '评分', value: data.rating || '—', subValue: `${data.reviewCount?.toLocaleString()} 条评价`, icon: Star, trend: 'neutral' as const, trendValue: '持平' },
    { label: '利润率', value: data.profitRate ? `${data.profitRate}%` : '—', icon: Scale, warning: Boolean(data.profitRate && data.profitRate < 15) },
    { label: '退货率', value: data.returnRate ? `${data.returnRate}%` : '—', icon: XCircle, warning: Boolean(data.returnRate && data.returnRate > 5) },
    { label: '曝光量', value: data.impressions ? `${(data.impressions / 10000).toFixed(1)}万` : '—', icon: Eye, trend: 'up' as const, trendValue: '+8.5%' },
    { label: '加购率', value: data.cartRate ? `${data.cartRate}%` : '—', icon: ShoppingCart, trend: 'neutral' as const, trendValue: '持平' },
  ];

  return (
    <div className="space-y-6">
      {/* 风险提示 */}
      {data.returnRate && data.returnRate > 5 && (
        <div className="flex items-center gap-3 p-4 bg-[#FFFBEB] border border-[#F59E0B] rounded-lg">
          <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#92400E]">硬约束风险提示</p>
            <p className="text-sm text-[#B45309]">退货率 {data.returnRate}% 偏高，建议优先考虑退货率低于 5% 的商品</p>
          </div>
        </div>
      )}

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      {/* 商品详情 */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">商品信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">商品ID</span>
              <span className="font-mono text-[#1F2937]">{data.productId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">SKU</span>
              <span className="font-mono text-[#1F2937]">{data.sku || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">品牌</span>
              <span className="text-[#1F2937]">{data.brand || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">类目</span>
              <span className="text-[#1F2937]">{data.categoryPath || data.category || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">变体数</span>
              <span className="text-[#1F2937]">{data.variantCount || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">上架时间</span>
              <span className="text-[#1F2937]">{data.listedDate || '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">商家信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">卖家名称</span>
              <span className="text-[#1F2937]">{data.sellerName || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">卖家类型</span>
              <Badge variant="outline">{data.sellerType === 'cross_border' ? '跨境卖家' : '本土卖家'}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">配送方式</span>
              <Badge>{data.deliveryType || '—'}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">商品重量</span>
              <span className="text-[#1F2937]">{data.weight ? `${data.weight}g` : '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">商品体积</span>
              <span className="text-[#1F2937]">{data.volume ? `${data.volume}L` : '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">尺寸</span>
              <span className="text-[#1F2937]">
                {data.dimensions ? `${data.dimensions.length}×${data.dimensions.width}×${data.dimensions.height} mm` : '—'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API占位数据 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">进阶数据（需对接Ozon Seller API）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">曝光量</span>
              <span className="text-[#9CA3AF]">—</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">卡片浏览</span>
              <span className="text-[#9CA3AF]">—</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">广告占比</span>
              <span className="text-[#9CA3AF]">—</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637089]">问答数</span>
              <span className="text-[#9CA3AF]">—</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 操作栏 */}
      <div className="flex items-center gap-3 p-4 bg-[#F9FAFB] rounded-lg">
        <Button className="bg-[#1677FF] hover:bg-[#1565C0]">
          <ShoppingCart className="w-4 h-4 mr-2" />
          采集
        </Button>
        <Button variant="outline">
          <Building2 className="w-4 h-4 mr-2" />
          认领
        </Button>
        <Button variant="outline">
          <Bell className="w-4 h-4 mr-2" />
          监控
        </Button>
        <Button variant="outline">
          <Database className="w-4 h-4 mr-2" />
          加入产品库
        </Button>
      </div>
    </div>
  );
}

function TrendsTab({ data }: { data: TrendData[] }) {
  const maxSales = Math.max(...data.map((d) => d.sales));
  const maxRevenue = Math.max(...data.map((d) => d.revenue));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">近30天销售趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 简化图表 - 用条形图模拟 */}
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs text-[#637089]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#1677FF] rounded" />
                <span>销量</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#10B981] rounded" />
                <span>销售额</span>
              </div>
            </div>
            
            <div className="space-y-2">
              {data.slice(-14).map((item, index) => (
                <div key={item.date} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-[#9CA3AF]">{item.date.slice(5)}</span>
                  <div className="flex-1 flex gap-1">
                    <div
                      className="h-6 bg-[#1677FF]/60 rounded-sm transition-all"
                      style={{ width: `${(item.sales / maxSales) * 100}%` }}
                    />
                    <div
                      className="h-6 bg-[#10B981]/60 rounded-sm transition-all"
                      style={{ width: `${(item.revenue / maxRevenue) * 50}%` }}
                    />
                  </div>
                  <span className="w-12 text-xs text-right text-[#637089]">{item.sales}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 价格趋势 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">价格走势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.slice(-7).map((item, index) => (
              <div key={item.date} className="flex items-center justify-between text-sm">
                <span className="text-[#9CA3AF]">{item.date}</span>
                <span className="font-medium text-[#1F2937]">₽{item.price.toLocaleString()}</span>
                {index > 0 && (
                  <span className={cn(
                    'text-xs',
                    item.price > data[index - 1].price ? 'text-[#10B981]' : 'text-[#EF4444]'
                  )}>
                    {item.price > data[index - 1].price ? '+' : ''}{item.price - data[index - 1].price}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KeywordsTab({ data }: { data: MarketSignal }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">采集关键词</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.keywords?.map((keyword, index) => (
              <Badge key={index} variant="outline" className="px-3 py-1.5 text-sm">
                {keyword}
              </Badge>
            )) || (
              <p className="text-sm text-[#9CA3AF]">暂无关键词数据</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">关键词热度（即将上线）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Lock className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
              <p className="text-sm text-[#637089]">关键词热度分析即将上线</p>
              <p className="text-xs text-[#9CA3AF] mt-1">对接 Ozon Analytics API 后可用</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AIAnalysisTab() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="text-center">
          <Bot className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#1F2937] mb-2">AI 引擎分析</h3>
          <p className="text-sm text-[#637089] mb-4">基于机器学习的智能选品分析</p>
          <div className="space-y-2 text-sm text-[#9CA3AF]">
            <p>综合评分排名</p>
            <p>AI 推荐标签</p>
            <p>竞争度分析</p>
            <p>利润率预测</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Main Page ============

export default function SelectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DetailTab>('basic');
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<MarketSignal | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);

  useEffect(() => {
    // 模拟加载数据
    setTimeout(() => {
      setData(generateMockDetail());
      setTrendData(generateTrendData());
      setIsLoading(false);
    }, 500);
  }, [params.id]);

  if (isLoading) {
    return (
      <AppLayout title="商品详情">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-[#1677FF] animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout title="商品详情">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <XCircle className="w-12 h-12 text-[#EF4444] mb-4" />
          <p className="text-lg text-[#1F2937]">商品不存在或已被删除</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            返回列表
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={data?.title || '商品详情'}>
      <div className="min-h-screen bg-[#F5F7FA]">
        {/* 顶部导航 */}
        <div className="bg-white border-b border-[#E6EAF2] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回
              </Button>
              <div className="flex items-center gap-3">
                <img
                  src={data.imageUrl}
                  alt={data.title}
                  className="w-14 h-14 rounded-lg object-cover"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-lg font-semibold text-[#1F2937]">{data.title}</h1>
                    <Badge className={data.platform === 'ozon' ? 'bg-[#005BFF]' : 'bg-[#E31E24]'}>
                      {data.platform === 'ozon' ? 'OZON' : 'WB'}
                    </Badge>
                  </div>
                  <p className="text-sm text-[#637089]">ID: {data.productId}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 mr-4">
                <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                <span className="font-medium">{data.rating}</span>
                <span className="text-[#9CA3AF] text-sm">({data.reviewCount?.toLocaleString()})</span>
              </div>
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4 mr-1" />
                查看详情
              </Button>
            </div>
          </div>
        </div>

        {/* Tab栏 */}
        <div className="bg-white border-b border-[#E6EAF2] px-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DetailTab)}>
            <TabsList className="bg-transparent h-12">
              <TabsTrigger value="basic" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#1677FF] data-[state=active]:text-[#1677FF] rounded-none">
                基本信息
              </TabsTrigger>
              <TabsTrigger value="trends" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#1677FF] data-[state=active]:text-[#1677FF] rounded-none">
                销售趋势
              </TabsTrigger>
              <TabsTrigger value="keywords" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#1677FF] data-[state=active]:text-[#1677FF] rounded-none">
                关键词
              </TabsTrigger>
              <TabsTrigger value="ai-analysis" disabled className="opacity-50">
                <Bot className="w-4 h-4 mr-1" />
                引擎分析
                <Lock className="w-3 h-3 ml-1" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* 内容区 */}
        <div className="p-6">
          {activeTab === 'basic' && <BasicInfoTab data={data} />}
          {activeTab === 'trends' && <TrendsTab data={trendData} />}
          {activeTab === 'keywords' && <KeywordsTab data={data} />}
          {activeTab === 'ai-analysis' && <AIAnalysisTab />}
        </div>
      </div>
    </AppLayout>
  );
}
