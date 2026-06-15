'use client';

import { useState, useCallback } from 'react';
import { Search, TrendingUp, Users, Package, Star, Plus, BarChart3, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface MiningResult {
  keyword: string;
  monthlySearch: number;
  monthlyGrowth: number;
  competitorCount: number;
  productCount: number;
  marketSpace: number;
}

interface MiningResponse {
  success: boolean;
  data: MiningResult[];
  total: number;
  productCount: number;
}

type SortField = 'monthlySearch' | 'monthlyGrowth' | 'competitorCount' | 'marketSpace';

export default function KeywordMiningPage() {
  const [seed, setSeed] = useState('');
  const [platform, setPlatform] = useState('ozon');
  const [results, setResults] = useState<MiningResult[]>([]);
  const [total, setTotal] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField>('monthlySearch');
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [addingToLibrary, setAddingToLibrary] = useState(false);

  const fetchMiningResults = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/keywords/mining?seed=${encodeURIComponent(keyword)}&platform=${platform}`);
      const data: MiningResponse = await response.json();
      
      if (data.success) {
        setResults(data.data || []);
        setTotal(data.total);
        setProductCount(data.productCount);
        setSelectedKeywords(new Set());
      }
    } catch {
      console.error('关键词挖掘失败');
    } finally {
      setLoading(false);
    }
  }, [platform]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMiningResults(seed);
  };

  const handleSortChange = (value: string) => {
    setSortField(value as SortField);
  };

  const sortedResults = [...results].sort((a, b) => {
    return b[sortField] - a[sortField];
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeywords(new Set(results.map(r => r.keyword)));
    } else {
      setSelectedKeywords(new Set());
    }
  };

  const handleSelectKeyword = (keyword: string, checked: boolean) => {
    const newSelected = new Set(selectedKeywords);
    if (checked) {
      newSelected.add(keyword);
    } else {
      newSelected.delete(keyword);
    }
    setSelectedKeywords(newSelected);
  };

  const handleAddToLibrary = async (keyword: string) => {
    setAddingToLibrary(true);
    try {
      const response = await fetch('/api/keywords/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`「${keyword}」已添加到词库`);
      } else {
        alert(data.error || '添加失败');
      }
    } catch {
      alert('网络错误');
    } finally {
      setAddingToLibrary(false);
    }
  };

  const handleBatchAddToLibrary = async () => {
    if (selectedKeywords.size === 0) return;

    setAddingToLibrary(true);
    try {
      const response = await fetch('/api/keywords/library/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: Array.from(selectedKeywords) }),
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`成功添加 ${data.data?.added || 0} 个关键词`);
        setSelectedKeywords(new Set());
      } else {
        alert(data.error || '批量添加失败');
      }
    } catch {
      alert('网络错误');
    } finally {
      setAddingToLibrary(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">关键词挖掘</h1>
        <p className="text-sm text-muted-foreground mt-1">
          输入种子词，挖掘相关关键词，分析市场机会
        </p>
      </div>

      {/* 搜索框 */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="输入种子词，如：пуховик"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ozon">Ozon</SelectItem>
                <SelectItem value="wb">Wildberries</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={loading}>
              {loading ? '挖掘中...' : '挖掘'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 统计信息 */}
      {total > 0 && (
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">关联商品：</span>
            <span className="font-medium">{productCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">关键词：</span>
            <span className="font-medium">{total}</span>
          </div>
        </div>
      )}

      {/* 操作栏 */}
      {sortedResults.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Checkbox
              checked={selectedKeywords.size === results.length}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-muted-foreground">
              已选择 {selectedKeywords.size} 个
            </span>
            <Select value={sortField} onValueChange={handleSortChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthlySearch">月搜热度</SelectItem>
                <SelectItem value="monthlyGrowth">搜索增长</SelectItem>
                <SelectItem value="competitorCount">竞对数</SelectItem>
                <SelectItem value="marketSpace">市场空间</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selectedKeywords.size > 0 && (
            <Button onClick={handleBatchAddToLibrary} disabled={addingToLibrary}>
              <Plus className="h-4 w-4 mr-1" />
              批量加入词库
            </Button>
          )}
        </div>
      )}

      {/* 结果列表 */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-muted-foreground">挖掘中...</span>
            </div>
          </CardContent>
        </Card>
      ) : sortedResults.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>关键词</TableHead>
                  <TableHead className="text-right">月搜热度</TableHead>
                  <TableHead className="text-right">搜索增长</TableHead>
                  <TableHead className="text-right">竞对数</TableHead>
                  <TableHead className="text-right">商品数</TableHead>
                  <TableHead className="text-right">市场空间</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResults.map((item) => (
                  <TableRow key={item.keyword}>
                    <TableCell>
                      <Checkbox
                        checked={selectedKeywords.has(item.keyword)}
                        onCheckedChange={(checked) => handleSelectKeyword(item.keyword, !!checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <a 
                        href={`/keywords/trend?keyword=${encodeURIComponent(item.keyword)}`}
                        className="text-primary hover:underline"
                      >
                        {item.keyword}
                      </a>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(item.monthlySearch)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={item.monthlyGrowth > 50 ? 'default' : 'secondary'}
                        className={cn(
                          item.monthlyGrowth > 50 && 'bg-green-500',
                          item.monthlyGrowth > 20 && item.monthlyGrowth <= 50 && 'bg-yellow-500'
                        )}
                      >
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {item.monthlyGrowth > 0 ? '+' : ''}{item.monthlyGrowth.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.competitorCount}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.productCount}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(item.marketSpace)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddToLibrary(item.keyword)}
                        disabled={addingToLibrary}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : seed && !loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">未找到相关关键词</h3>
            <p className="text-sm text-muted-foreground">
              尝试其他种子词，或增加采集数据量
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">输入种子词开始挖掘</h3>
            <p className="text-sm text-muted-foreground">
              输入俄语关键词，如 пуховик（羽绒服）、наушники（耳机）
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
