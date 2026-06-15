'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Search,
  Package,
  RefreshCw,
  Store,
  Clock,
  ArrowUpRight,
  ChevronRight,
  ShoppingBag,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// 平台类型
type Platform = 'ozon' | 'wb';

// 市场概览数据类型
interface MarketOverview {
  totalProducts: number;
  newToday: number;
  priceChanges: number;
  hotCategories: Array<{ category: string; productCount: number; avgPrice: number }>;
  salesTrend: Array<{ date: string; sales: number }>;
  topShops: Array<{ name: string; productCount: number }>;
  avgProfitRate: number;
}

// 类目排行数据类型
interface CategoryRanking {
  category: string;
  productCount: number;
  avgPrice: number;
  avgSales: number;
  totalSales: number;
  revenue: number;
  growth: number;
  sellerCount: number;
  avgRating: number;
}

// 搜索飙升数据类型
interface SearchTrending {
  keyword: string;
  searchVolume: number;
  growth: number;
  relatedProducts: number;
}

// 新品榜数据类型
interface NewArrival {
  id?: number;
  productTitle: string;
  price: number;
  salesVolume: number;
  rating: number;
  listedDate: string;
  category: string;
}

// 简化的饼图组件 - 使用useMemo预计算避免lint错误
function SimplePieChart({ data, title }: { 
  data: Array<{ name: string; value: number; color: string }>;
  title: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        暂无数据
      </div>
    );
  }

  // 预计算饼图数据，避免在渲染时重新赋值
  const pieSlices = data.reduce<Array<{
    percent: number;
    startPercent: number;
    endPercent: number;
    color: string;
  }>>((acc, item) => {
    const percent = (item.value / total) * 100;
    const startPercent = acc.length > 0 ? acc[acc.length - 1].endPercent : 0;
    const endPercent = startPercent + percent;
    return [...acc, { percent, startPercent, endPercent, color: item.color }];
  }, []);
  
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {pieSlices.map((slice, index) => {
            const startX = Math.cos((2 * Math.PI * slice.startPercent) / 100);
            const startY = Math.sin((2 * Math.PI * slice.startPercent) / 100);
            const endX = Math.cos((2 * Math.PI * slice.endPercent) / 100);
            const endY = Math.sin((2 * Math.PI * slice.endPercent) / 100);
            const largeArcFlag = slice.percent > 50 ? 1 : 0;
            const pathData = `M 50 50 L ${50 + startX * 40} ${50 + startY * 40} A 40 40 0 ${largeArcFlag} 1 ${50 + endX * 40} ${50 + endY * 40} Z`;
            
            return (
              <path
                key={index}
                d={pathData}
                fill={slice.color}
                className="transition-all hover:opacity-80"
              />
            );
          })}
        </svg>
      </div>
      <div className="flex flex-col gap-1 text-xs">
        {data.slice(0, 5).map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground truncate max-w-[80px]">
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 简化的柱状图组件
function SimpleBarChart({ data, title }: { 
  data: Array<{ name: string; value: number }>;
  title: string;
}) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        暂无数据
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {data.slice(0, 10).map((item, index) => (
        <Link 
          key={index}
          href={`/selection?tab=hot-categories&category=${encodeURIComponent(item.name)}`}
          className="group flex items-center gap-2"
        >
          <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
          <span className="text-xs truncate flex-1 max-w-[100px] group-hover:text-primary">
            {item.name}
          </span>
          <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
            <div 
              className="h-full bg-primary/70 rounded-sm transition-all group-hover:bg-primary"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-12 text-right">
            {item.value.toLocaleString()}
          </span>
          <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ))}
    </div>
  );
}

export default function MarketDashboard() {
  const [platform, setPlatform] = useState<Platform>('ozon');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [marketOverview, setMarketOverview] = useState<MarketOverview | null>(null);
  const [categoryRanking, setCategoryRanking] = useState<CategoryRanking[]>([]);
  const [searchTrending, setSearchTrending] = useState<SearchTrending[]>([]);
  const [newArrivals, setNewArrivals] = useState<NewArrival[]>([]);

  // 获取所有数据
  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [overviewRes, categoryRes, trendingRes, newArrivalsRes] = await Promise.all([
        fetch(`/api/dashboard/market-overview?platform=${platform}`),
        fetch(`/api/dashboard/category-ranking?platform=${platform}&limit=10`),
        fetch(`/api/dashboard/search-trending?platform=${platform}&limit=10`),
        fetch(`/api/dashboard/new-arrivals?platform=${platform}&days=7&limit=10`),
      ]);

      const [overview, category, trending, newA] = await Promise.all([
        overviewRes.json(),
        categoryRes.json(),
        trendingRes.json(),
        newArrivalsRes.json(),
      ]);

      setMarketOverview(overview.data || overview);
      setCategoryRanking(Array.isArray(category) ? category : []);
      setSearchTrending(Array.isArray(trending) ? trending : []);
      setNewArrivals(Array.isArray(newA) ? newA : []);
    } catch (error) {
      console.error('获取市场数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [platform]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 自动刷新（10分钟）
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const hasData = marketOverview && (
    marketOverview.totalProducts > 0 ||
    categoryRanking.length > 0 ||
    searchTrending.length > 0 ||
    newArrivals.length > 0
  );

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>仪表盘</span>
              </Link>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">市场数据看板</span>
            </div>
            
            <div className="flex items-center gap-4">
              {/* 平台切换 */}
              <div className="flex bg-muted rounded-lg p-1">
                <button
                  onClick={() => setPlatform('ozon')}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    platform === 'ozon'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Ozon
                </button>
                <button
                  onClick={() => setPlatform('wb')}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    platform === 'wb'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Wildberries
                </button>
              </div>

              {/* 刷新按钮 */}
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="container mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !hasData ? (
          /* 空状态引导 */
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Package className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无市场数据</h3>
            <p className="text-muted-foreground mb-4">
              使用插件采集商品后数据将自动呈现
            </p>
            <Link
              href="/selection"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              前往选品页面
            </Link>
          </div>
        ) : (
          /* 2x2 卡片网格 */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左上 - 市场概览 */}
            <div className="bg-card rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Store className="w-5 h-5 text-primary" />
                  市场概览
                </h2>
                <span className="text-xs text-muted-foreground">
                  {marketOverview?.totalProducts || 0} 个商品
                </span>
              </div>

              {/* 指标卡片 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-2xl font-bold">{marketOverview?.totalProducts || 0}</div>
                  <div className="text-sm text-muted-foreground">采集商品</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">+{marketOverview?.newToday || 0}</div>
                  <div className="text-sm text-muted-foreground">今日新增</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-2xl font-bold">{marketOverview?.priceChanges || 0}</div>
                  <div className="text-sm text-muted-foreground">价格变动</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div 
                    className={`text-2xl font-bold ${
                      (marketOverview?.avgProfitRate || 0) > 20 
                        ? 'text-green-600' 
                        : (marketOverview?.avgProfitRate || 0) > 10 
                        ? 'text-yellow-600' 
                        : 'text-red-600'
                    }`}
                  >
                    {marketOverview?.avgProfitRate?.toFixed(1) || 0}%
                  </div>
                  <div className="text-sm text-muted-foreground">平均利润率</div>
                </div>
              </div>

              {/* Top5类目饼图 */}
              <div>
                <h3 className="text-sm font-medium mb-3">Top5 类目分布</h3>
                <SimplePieChart 
                  data={(marketOverview?.hotCategories || []).map((cat, i) => ({
                    name: cat.category.split('/').pop() || cat.category,
                    value: cat.productCount,
                    color: ['#1677FF', '#52C41A', '#FAAD14', '#F5222D', '#722ED1'][i % 5],
                  }))}
                  title="类目分布"
                />
              </div>
            </div>

            {/* 右上 - 类目排行 */}
            <div className="bg-card rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  类目排行
                </h2>
                <Link 
                  href="/selection?tab=hot-categories"
                  className="text-sm text-primary hover:underline"
                >
                  查看全部
                </Link>
              </div>

              <SimpleBarChart 
                data={categoryRanking.map(cat => ({
                  name: cat.category.split('/').pop() || cat.category,
                  value: cat.revenue || cat.totalSales,
                }))}
                title="类目销售额"
              />
            </div>

            {/* 左下 - 搜索飙升 */}
            <div className="bg-card rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Search className="w-5 h-5 text-primary" />
                  搜索飙升
                </h2>
                <Link 
                  href="/selection?tab=hot-keywords"
                  className="text-sm text-primary hover:underline"
                >
                  查看全部
                </Link>
              </div>

              {searchTrending.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {searchTrending.slice(0, 10).map((item, index) => (
                    <Link
                      key={index}
                      href={`/selection?tab=hot-keywords&keyword=${encodeURIComponent(item.keyword)}`}
                      className="group flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-6">#{index + 1}</span>
                        <span className="font-medium group-hover:text-primary transition-colors">
                          {item.keyword}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {item.searchVolume} 搜索
                        </span>
                        {item.growth > 0 ? (
                          <span className="flex items-center text-green-600 text-sm">
                            <TrendingUp className="w-4 h-4" />
                            +{item.growth.toFixed(0)}%
                          </span>
                        ) : item.growth < 0 ? (
                          <span className="flex items-center text-red-600 text-sm">
                            <TrendingDown className="w-4 h-4" />
                            {item.growth.toFixed(0)}%
                          </span>
                        ) : null}
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Search className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">暂无搜索飙升数据</p>
                </div>
              )}
            </div>

            {/* 右下 - 新品榜 */}
            <div className="bg-card rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  新品榜
                </h2>
                <Link 
                  href="/selection?tab=products"
                  className="text-sm text-primary hover:underline"
                >
                  查看全部
                </Link>
              </div>

              {newArrivals.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {newArrivals.slice(0, 10).map((item, index) => (
                    <Link
                      key={index}
                      href={`/selection?tab=hot-ranking&search=${encodeURIComponent(item.productTitle)}`}
                      className="group flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {item.productTitle}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>₽{item.price}</span>
                          <span>·</span>
                          <span>{item.salesVolume} 销量</span>
                          {item.rating > 0 && (
                            <>
                              <span>·</span>
                              <span>⭐{item.rating.toFixed(1)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Clock className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">暂无新品数据</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 底部提示 */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          数据每10分钟自动刷新 · 数据来源：插件采集的市场信号
        </div>
      </div>
    </div>
  );
}
