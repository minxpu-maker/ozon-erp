'use client';

import { useState, useEffect } from 'react';
import { Search, TrendingUp, BarChart3, Package, DollarSign, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSearchParams, useRouter } from 'next/navigation';

interface TrendItem {
  date: string;
  searchVolume: number;
  productCount: number;
  avgPrice: number;
}

interface TrendResponse {
  success: boolean;
  data: {
    keyword: string;
    trend: TrendItem[];
  };
}

interface RelatedKeyword {
  keyword: string;
  monthlySearch: number;
  monthlyGrowth: number;
}

export default function KeywordTrendPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState<TrendItem[]>([]);
  const [relatedKeywords, setRelatedKeywords] = useState<RelatedKeyword[]>([]);

  useEffect(() => {
    const kw = searchParams.get('keyword');
    if (kw) {
      setKeyword(kw);
      fetchTrend(kw, days);
      fetchRelatedKeywords(kw);
    }
  }, [searchParams]);

  useEffect(() => {
    if (keyword) {
      fetchRelatedKeywords(keyword);
    }
  }, [days]);

  const fetchTrend = async (kw: string, d: number) => {
    if (!kw.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/keywords/trend?keyword=${encodeURIComponent(kw)}&days=${d}`);
      const data: TrendResponse = await response.json();
      if (data.success) {
        setTrendData(data.data.trend);
      }
    } catch (error) {
      console.error('Failed to fetch trend:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedKeywords = async (kw: string) => {
    if (!kw.trim()) return;
    try {
      const response = await fetch(`/api/keywords/mining?seed=${encodeURIComponent(kw)}&limit=5`);
      const data = await response.json();
      if (data.success && data.data) {
        setRelatedKeywords(data.data.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to fetch related keywords:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTrend(keyword, days);
    fetchRelatedKeywords(keyword);
  };

  const handleDaysChange = (d: number) => {
    setDays(d);
    if (keyword) {
      fetchTrend(keyword, d);
    }
  };

  const handleRelatedKeywordClick = (kw: string) => {
    setKeyword(kw);
    fetchTrend(kw, days);
    fetchRelatedKeywords(kw);
  };

  // 计算统计数据
  const stats = {
    avgSearchVolume: trendData.length > 0
      ? Math.round(trendData.reduce((sum, t) => sum + t.searchVolume, 0) / trendData.length)
      : 0,
    totalProducts: trendData.reduce((sum, t) => sum + t.productCount, 0),
    avgPrice: trendData.length > 0
      ? Math.round(trendData.reduce((sum, t) => sum + t.avgPrice, 0) / trendData.length)
      : 0,
    growthRate: trendData.length >= 2
      ? ((trendData[trendData.length - 1].searchVolume - trendData[0].searchVolume) / Math.max(1, trendData[0].searchVolume) * 100).toFixed(1)
      : '0',
  };

  // 计算图表高度
  const maxSearchVolume = Math.max(...trendData.map(t => t.searchVolume), 1);
  const maxProductCount = Math.max(...trendData.map(t => t.productCount), 1);
  const maxPrice = Math.max(...trendData.map(t => t.avgPrice), 1);

  // 简化图表：只显示有数据的点
  const chartPoints = trendData.filter(t => t.searchVolume > 0 || t.productCount > 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">搜索趋势</h1>
        <p className="text-sm text-muted-foreground mt-1">
          查看关键词的历史搜索趋势数据
        </p>
      </div>

      {/* 搜索框 */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="输入关键词"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? '加载中...' : '查询'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {trendData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左侧趋势图 */}
          <div className="lg:col-span-3 space-y-4">
            {/* 时间范围切换 */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">趋势分析</h2>
              <div className="flex gap-1">
                <Button
                  variant={days === 7 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDaysChange(7)}
                >
                  7天
                </Button>
                <Button
                  variant={days === 30 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDaysChange(30)}
                >
                  30天
                </Button>
                <Button
                  variant={days === 90 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDaysChange(90)}
                >
                  90天
                </Button>
              </div>
            </div>

            {/* 趋势图 */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>搜索量</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <span>商品数</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>平均价格</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* 简化柱状图 */}
                <div className="relative h-64">
                  {/* Y轴刻度 */}
                  <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-muted-foreground pr-2">
                    <span>{maxSearchVolume.toLocaleString()}</span>
                    <span>{Math.round(maxSearchVolume * 0.75).toLocaleString()}</span>
                    <span>{Math.round(maxSearchVolume * 0.5).toLocaleString()}</span>
                    <span>{Math.round(maxSearchVolume * 0.25).toLocaleString()}</span>
                    <span>0</span>
                  </div>

                  {/* 图表区域 */}
                  <div className="absolute left-14 right-0 top-0 bottom-6 flex items-end gap-1">
                    {chartPoints.map((item, index) => {
                      const barWidth = Math.max(100 / chartPoints.length - 1, 2);
                      const searchHeight = (item.searchVolume / maxSearchVolume) * 100;
                      const productHeight = (item.productCount / maxProductCount) * 100;
                      const priceHeight = (item.avgPrice / maxPrice) * 100;
                      
                      return (
                        <div
                          key={item.date}
                          className="relative flex-1 flex items-end justify-center gap-px"
                          style={{ minWidth: `${barWidth}px` }}
                        >
                          {/* 价格（绿色） */}
                          <div
                            className="w-1 bg-green-500 opacity-60"
                            style={{ height: `${priceHeight}%` }}
                          />
                          {/* 商品数（灰色） */}
                          <div
                            className="w-1 bg-gray-400 opacity-60"
                            style={{ height: `${productHeight}%` }}
                          />
                          {/* 搜索量（蓝色） */}
                          <div
                            className="w-1 bg-blue-500"
                            style={{ height: `${searchHeight}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* X轴标签 */}
                  <div className="absolute left-14 right-0 bottom-0 h-6 flex items-start justify-between text-xs text-muted-foreground overflow-hidden">
                    {chartPoints.length > 0 && (
                      <>
                        <span>{chartPoints[0]?.date?.slice(5)}</span>
                        {chartPoints.length > 1 && chartPoints.length <= 10 && (
                          <span>{chartPoints[Math.floor(chartPoints.length / 2)]?.date?.slice(5)}</span>
                        )}
                        {chartPoints.length > 1 && <span>{chartPoints[chartPoints.length - 1]?.date?.slice(5)}</span>}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 数据表格 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">详细数据</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">日期</th>
                        <th className="text-right py-2 px-3">搜索量</th>
                        <th className="text-right py-2 px-3">商品数</th>
                        <th className="text-right py-2 px-3">平均价格</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendData.slice(-7).reverse().map((item) => (
                        <tr key={item.date} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-3">{item.date}</td>
                          <td className="text-right py-2 px-3 font-mono">{item.searchVolume.toLocaleString()}</td>
                          <td className="text-right py-2 px-3 font-mono">{item.productCount}</td>
                          <td className="text-right py-2 px-3 font-mono">{item.avgPrice > 0 ? `₽${item.avgPrice.toLocaleString()}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧信息卡 */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">关键词信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    <span>平均搜索量</span>
                  </div>
                  <span className="font-mono font-semibold">{stats.avgSearchVolume.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-gray-500" />
                    <span>商品总数</span>
                  </div>
                  <span className="font-mono font-semibold">{stats.totalProducts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span>平均价格</span>
                  </div>
                  <span className="font-mono font-semibold">{stats.avgPrice > 0 ? `₽${stats.avgPrice.toLocaleString()}` : '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {Number(stats.growthRate) >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span>增长率</span>
                  </div>
                  <span className={`font-mono font-semibold ${Number(stats.growthRate) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Number(stats.growthRate) >= 0 ? '+' : ''}{stats.growthRate}%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 相关关键词 */}
            {relatedKeywords.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">相关关键词</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {relatedKeywords.map((item) => (
                      <button
                        key={item.keyword}
                        onClick={() => handleRelatedKeywordClick(item.keyword)}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 text-left transition-colors"
                      >
                        <span className="text-sm font-medium">{item.keyword}</span>
                        <Badge variant={item.monthlyGrowth > 0 ? 'default' : 'secondary'} className="text-xs">
                          {item.monthlyGrowth > 0 ? '+' : ''}{item.monthlyGrowth.toFixed(1)}%
                        </Badge>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {keyword && !loading && trendData.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无趋势数据</h3>
            <p className="text-sm text-muted-foreground">
              该关键词暂无足够的趋势数据
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
