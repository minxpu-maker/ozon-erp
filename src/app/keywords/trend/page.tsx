'use client';

import { useState, useEffect } from 'react';
import { Search, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSearchParams } from 'next/navigation';

interface TrendData {
  date: string;
  searchVolume: number;
  productCount: number;
  avgPrice: number;
}

interface TrendResponse {
  success: boolean;
  data: {
    keyword: string;
    trend: TrendData[];
  };
}

export default function KeywordTrendPage() {
  const searchParams = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState<TrendData[]>([]);

  useEffect(() => {
    const kw = searchParams.get('keyword');
    if (kw) {
      setKeyword(kw);
      fetchTrend(kw);
    }
  }, [searchParams]);

  const fetchTrend = async (kw: string) => {
    if (!kw.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/keywords/trend?keyword=${encodeURIComponent(kw)}`);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTrend(keyword);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">搜索趋势</h1>
        <p className="text-sm text-muted-foreground mt-1">
          查看关键词的历史搜索趋势数据
        </p>
      </div>

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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">近30天趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trendData.map((item) => (
                <div key={item.date} className="flex items-center gap-4 text-sm">
                  <span className="w-24 text-muted-foreground">{item.date}</span>
                  <div className="flex-1 bg-blue-100 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (item.searchVolume / Math.max(...trendData.map(t => t.searchVolume))) * 100)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-mono">{item.searchVolume}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
