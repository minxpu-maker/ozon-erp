'use client';

import { useState } from 'react';
import { Search, Star, TrendingUp, Package, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ReverseKeyword {
  keyword: string;
  searchVolume: number | null;
  competition: string;
  competitionValue: number | null;
  rank: number;
  source: 'title' | 'tag' | 'category';
}

interface ProductInfo {
  productId: string;
  productTitle: string;
  imageUrl: string | null;
  price: number;
  salesVolume: number;
}

export default function KeywordReversePage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [keywords, setKeywords] = useState<ReverseKeyword[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  // 解析商品ID或链接
  const parseProductId = (input: string): string | null => {
    // 直接是商品ID
    if (input && input.length > 0) {
      return input.trim();
    }
    return null;
  };

  // 查询关键词
  const handleSearch = async () => {
    const productId = parseProductId(input);
    if (!productId) {
      setError('请输入商品ID');
      return;
    }

    setLoading(true);
    setError('');
    setProductInfo(null);
    setKeywords([]);
    setSelectedKeywords(new Set());

    try {
      const res = await fetch(`/api/keywords/reverse?productId=${encodeURIComponent(productId)}`);
      const data = await res.json();

      if (data.success) {
        setKeywords(data.data || []);
        // 如果有商品信息则显示
        if (data.productInfo) {
          setProductInfo(data.productInfo);
        }
      } else {
        setError(data.error || '查询失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 添加到词库
  const addToLibrary = async (keyword: string) => {
    try {
      const res = await fetch('/api/keywords/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, group: '反查添加' }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`"${keyword}" 已添加到词库`);
      }
    } catch {
      alert('添加失败');
    }
  };

  // 批量添加到词库
  const addSelectedToLibrary = async () => {
    if (selectedKeywords.size === 0) {
      alert('请先选择关键词');
      return;
    }

    const keywordsToAdd = Array.from(selectedKeywords);
    try {
      const res = await fetch('/api/keywords/library/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywordsToAdd, group: '反查添加' }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`成功添加 ${data.data?.added || 0} 个关键词到词库`);
        setSelectedKeywords(new Set());
      }
    } catch {
      alert('添加失败');
    }
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedKeywords.size === keywords.length) {
      setSelectedKeywords(new Set());
    } else {
      setSelectedKeywords(new Set(keywords.map(k => k.keyword)));
    }
  };

  // 切换单个选中
  const toggleSelect = (keyword: string) => {
    const newSet = new Set(selectedKeywords);
    if (newSet.has(keyword)) {
      newSet.delete(keyword);
    } else {
      newSet.add(keyword);
    }
    setSelectedKeywords(newSet);
  };

  // 获取来源标签颜色
  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'title':
        return <Badge variant="default" className="bg-blue-500">标题</Badge>;
      case 'tag':
        return <Badge variant="default" className="bg-green-500">标签</Badge>;
      case 'category':
        return <Badge variant="secondary">类目</Badge>;
      default:
        return <Badge variant="secondary">{source}</Badge>;
    }
  };

  // 获取竞争度颜色
  const getCompetitionColor = (competition: string) => {
    switch (competition) {
      case 'low':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'high':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">关键词反查</h1>
        <p className="text-sm text-muted-foreground mt-1">
          输入商品ID或粘贴商品链接，查询该商品的关联关键词来源
        </p>
      </div>

      {/* 搜索区域 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="输入商品ID或粘贴商品链接..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? '查询中...' : '查询'}
            </Button>
          </div>
          {error && (
            <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 商品信息卡 */}
      {productInfo && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              商品信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {productInfo.imageUrl && (
                <img
                  src={productInfo.imageUrl}
                  alt={productInfo.productTitle}
                  className="w-20 h-20 object-cover rounded border"
                />
              )}
              <div className="flex-1">
                <p className="font-medium">{productInfo.productTitle}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  ID: {productInfo.productId}
                </p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span>价格: ¥{productInfo.price}</span>
                  <span>销量: {productInfo.salesVolume}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 关键词列表 */}
      {keywords.length > 0 && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  关联关键词 ({keywords.length})
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAll}
                  >
                    {selectedKeywords.size === keywords.length ? '取消全选' : '全选'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={addSelectedToLibrary}
                    disabled={selectedKeywords.size === 0}
                  >
                    <Star className="h-4 w-4 mr-1" />
                    批量加入词库 ({selectedKeywords.size})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="w-10 px-3 py-3 text-left"></th>
                      <th className="px-3 py-3 text-left text-sm font-medium">关键词</th>
                      <th className="px-3 py-3 text-right text-sm font-medium">搜索量</th>
                      <th className="px-3 py-3 text-right text-sm font-medium">竞争度</th>
                      <th className="px-3 py-3 text-right text-sm font-medium">排名</th>
                      <th className="px-3 py-3 text-center text-sm font-medium">来源</th>
                      <th className="px-3 py-3 text-center text-sm font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {keywords.map((kw, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedKeywords.has(kw.keyword)}
                            onChange={() => toggleSelect(kw.keyword)}
                            className="rounded border-input"
                          />
                        </td>
                        <td className="px-3 py-3 font-medium">{kw.keyword}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">
                          {kw.searchVolume != null ? kw.searchVolume.toLocaleString() : '—'}
                        </td>
                        <td className={`px-3 py-3 text-right font-medium ${getCompetitionColor(kw.competition)}`}>
                          {kw.competition === 'low' ? '低' : kw.competition === 'medium' ? '中' : kw.competition === 'high' ? '高' : '未知'}
                        </td>
                        <td className="px-3 py-3 text-right">
                          #{kw.rank}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {getSourceBadge(kw.source)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addToLibrary(kw.keyword)}
                              title="添加到词库"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`/keywords/trend?keyword=${encodeURIComponent(kw.keyword)}`, '_blank')}
                              title="查看趋势"
                            >
                              <TrendingUp className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 空状态 */}
      {!loading && keywords.length === 0 && input && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">未找到关键词</h3>
            <p className="text-sm text-muted-foreground">
              该商品暂无关联关键词数据，请尝试其他商品ID
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
