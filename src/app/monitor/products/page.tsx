'use client';

import { useState, useEffect } from 'react';
import { 
  Package, Search, Filter, RefreshCw, Pause, Play, Trash2, 
  TrendingUp, TrendingDown, Minus, X, Eye, ChevronLeft, ChevronRight,
  BarChart3, LineChart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// 类型定义
interface MonitorProduct {
  id: number;
  signalId: number;
  productTitle: string;
  imageUrl: string;
  currentPrice: number;
  currentSales: number;
  currentRating: number;
  currentReviewCount: number;
  currentStock: number;
  priceChanged: boolean;
  salesChanged: boolean;
  priceChange: number;
  salesChange: number;
  status: string;
  createdAt: string;
}

interface PriceHistory {
  date: string;
  price: number;
  sales: number;
}

interface ChangeRecord {
  id: number;
  snapshotId: number;
  changeType: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
}

// MiniSparkline 组件 - 迷你趋势图
function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return <div className="w-16 h-4" />;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 16;
  const width = 64;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  const color = positive ? '#16A37B' : '#EF4444';
  
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// TrendChart 组件 - 趋势折线图
function TrendChart({ data, type }: { data: PriceHistory[]; type: 'price' | 'sales' | 'rating' }) {
  if (!data || data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-muted-foreground">暂无数据</div>;
  }
  
  const values = data.map(d => type === 'price' ? d.price : d.sales);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const height = 160;
  const width = 100;
  const padding = 20;
  
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((values[i] - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');
  
  const color = type === 'price' ? '#2F6BFF' : type === 'sales' ? '#16A37B' : '#F59E0B';
  const label = type === 'price' ? '价格' : type === 'sales' ? '销量' : '评分';
  
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}趋势</span>
        <span className="text-xs text-muted-foreground">{min.toFixed(0)} ~ {max.toFixed(0)}</span>
      </div>
      <svg width="100%" height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((d, i) => {
          const x = padding + (i / (data.length - 1)) * (width - padding * 2);
          const y = height - padding - ((values[i] - min) / range) * (height - padding * 2);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill={color}
              className="opacity-0 hover:opacity-100 transition-opacity"
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function MonitorProductsPage() {
  const [products, setProducts] = useState<MonitorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<string>('all');
  const [changeType, setChangeType] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MonitorProduct | null>(null);
  const [showTrend, setShowTrend] = useState(false);
  const [trendData, setTrendData] = useState<PriceHistory[]>([]);
  const [changeRecords, setChangeRecords] = useState<ChangeRecord[]>([]);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 获取监控商品列表
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: 'product',
        limit: '20',
        page: page.toString(),
      });
      
      const res = await fetch(`/api/monitor/items?${params}`);
      const data = await res.json();
      
      if (data.success) {
        let items = data.data.items || [];
        
        // 应用筛选
        if (search) {
          items = items.filter((item: MonitorProduct) => 
            item.productTitle?.toLowerCase().includes(search.toLowerCase())
          );
        }
        if (changeType === 'price') {
          items = items.filter((item: MonitorProduct) => item.priceChanged);
        } else if (changeType === 'sales') {
          items = items.filter((item: MonitorProduct) => item.salesChanged);
        }
        if (status !== 'all') {
          items = items.filter((item: MonitorProduct) => item.status === status);
        }
        
        setProducts(items);
        setTotalPages(data.data.totalPages || 1);
      }
    } catch (error) {
      console.error('获取监控商品失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, platform, status, changeType]);

  // 获取趋势数据
  const fetchTrend = async (productId: number) => {
    setLoadingTrend(true);
    try {
      // 获取快照历史
      const res = await fetch(`/api/monitor/snapshot?monitorItemId=${productId}&limit=30`);
      const data = await res.json();
      
      if (data.success && data.data.length > 0) {
        const history: PriceHistory[] = data.data.map((s: any) => ({
          date: s.capturedAt,
          price: s.price,
          sales: s.sales,
        })).reverse();
        setTrendData(history);
      } else {
        setTrendData([]);
      }
      
      // 获取变更记录
      const changesRes = await fetch(`/api/monitor/items/${productId}/changes`);
      const changesData = await changesRes.json();
      if (changesData.success) {
        setChangeRecords(changesData.data || []);
      }
    } catch (error) {
      console.error('获取趋势数据失败:', error);
    } finally {
      setLoadingTrend(false);
    }
  };

  // 查看趋势
  const handleViewTrend = async (product: MonitorProduct) => {
    setSelectedProduct(product);
    setShowTrend(true);
    await fetchTrend(product.id);
  };

  // 暂停/恢复监控
  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/monitor/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchProducts();
      }
    } catch (error) {
      console.error('更新状态失败:', error);
    }
  };

  // 取消监控
  const handleRemove = async (id: number) => {
    if (!confirm('确定要取消监控吗？')) return;
    try {
      const res = await fetch(`/api/monitor/items/${id}?type=signal`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchProducts();
        setSelectedProducts(prev => prev.filter(p => p !== id));
      }
    } catch (error) {
      console.error('取消监控失败:', error);
    }
  };

  // 批量操作
  const handleBatchAction = async (action: 'pause' | 'resume' | 'remove') => {
    if (selectedProducts.length === 0) return;
    
    if (action === 'remove' && !confirm(`确定要取消监控选中的 ${selectedProducts.length} 个商品吗？`)) {
      return;
    }
    
    for (const id of selectedProducts) {
      try {
        if (action === 'remove') {
          await fetch(`/api/monitor/items/${id}?type=signal`, { method: 'DELETE' });
        } else {
          await fetch(`/api/monitor/items/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: action === 'pause' ? 'paused' : 'active' }),
          });
        }
      } catch (error) {
        console.error(`操作失败:`, error);
      }
    }
    
    setSelectedProducts([]);
    fetchProducts();
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id));
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#152033]">产品监控</h1>
          <p className="text-sm text-[#637089] mt-1">监控商品的价格、销量、评分等变化</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchProducts}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-xl border border-[#E6EAF2] p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#637089]" />
              <Input
                placeholder="搜索商品名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <Select value={changeType} onValueChange={setChangeType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="变更类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部变更</SelectItem>
              <SelectItem value="price">价格变动</SelectItem>
              <SelectItem value="sales">销量变动</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="监控状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">监控中</SelectItem>
              <SelectItem value="paused">已暂停</SelectItem>
              <SelectItem value="removed">已移除</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 批量操作 */}
        {selectedProducts.length > 0 && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t">
            <span className="text-sm text-[#637089]">已选择 {selectedProducts.length} 项</span>
            <Button size="sm" variant="outline" onClick={() => handleBatchAction('pause')}>
              <Pause className="w-4 h-4 mr-1" />
              暂停
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBatchAction('resume')}>
              <Play className="w-4 h-4 mr-1" />
              恢复
            </Button>
            <Button size="sm" variant="destructive" onClick={() => handleBatchAction('remove')}>
              <Trash2 className="w-4 h-4 mr-1" />
              取消监控
            </Button>
          </div>
        )}
      </div>

      {/* 商品列表 */}
      <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F6F8FB]">
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  checked={selectedProducts.length === products.length && products.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-[#E6EAF2]"
                />
              </TableHead>
              <TableHead className="w-[60px]">图片</TableHead>
              <TableHead>商品名称</TableHead>
              <TableHead className="w-[100px] text-right">当前价格</TableHead>
              <TableHead className="w-[100px]">7天趋势</TableHead>
              <TableHead className="w-[80px]">状态</TableHead>
              <TableHead className="w-[140px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-10 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[64px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[100px]" /></TableCell>
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Package className="w-12 h-12 text-[#637089] mx-auto mb-4" />
                  <p className="text-[#637089]">暂无监控商品</p>
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id} className={selectedProducts.includes(product.id) ? 'bg-[#2F6BFF]/5' : ''}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProducts(prev => [...prev, product.id]);
                        } else {
                          setSelectedProducts(prev => prev.filter(id => id !== product.id));
                        }
                      }}
                      className="rounded border-[#E6EAF2]"
                    />
                  </TableCell>
                  <TableCell>
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.productTitle}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-[#F6F8FB] rounded flex items-center justify-center">
                        <Package className="w-5 h-5 text-[#637089]" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[250px]">
                      <p className="font-medium text-sm truncate">{product.productTitle || '未知商品'}</p>
                      <p className="text-xs text-[#637089] mt-1">
                        销量: {product.currentSales || 0}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      <span className="font-medium">¥{((product.currentPrice || 0) / 100).toFixed(2)}</span>
                      {product.priceChange !== 0 && (
                        <div className={cn(
                          "flex items-center justify-end text-xs mt-1",
                          product.priceChange > 0 ? "text-[#EF4444]" : "text-[#16A37B]"
                        )}>
                          {product.priceChange > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                          {product.priceChange > 0 ? '+' : ''}{product.priceChange.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.priceChanged || product.salesChanged ? (
                      <div className="flex items-center gap-1">
                        {product.priceChanged && (
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-xs",
                              product.priceChange > 0 ? "bg-[#EF4444]/10 text-[#EF4444]" : "bg-[#16A37B]/10 text-[#16A37B]"
                            )}
                          >
                            价格
                          </Badge>
                        )}
                        {product.salesChanged && (
                          <Badge variant="secondary" className="text-xs">
                            销量
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Minus className="w-4 h-4 text-[#637089]" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        product.status === 'active' && "bg-[#16A37B]/10 text-[#16A37B]",
                        product.status === 'paused' && "bg-[#F59E0B]/10 text-[#F59E0B]",
                        product.status === 'removed' && "bg-[#EF4444]/10 text-[#EF4444]"
                      )}
                    >
                      {product.status === 'active' ? '监控中' : product.status === 'paused' ? '已暂停' : '已移除'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewTrend(product)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleStatus(product.id, product.status)}
                        disabled={product.status === 'removed'}
                      >
                        {product.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemove(product.id)}
                        className="text-[#EF4444] hover:text-[#EF4444]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-[#637089]">
              第 {page} / {totalPages} 页
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 趋势面板弹窗 */}
      <Dialog open={showTrend} onOpenChange={setShowTrend}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LineChart className="w-5 h-5" />
              {selectedProduct?.productTitle || '商品趋势'}
            </DialogTitle>
          </DialogHeader>
          
          {loadingTrend ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-[#2F6BFF]" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* 商品概览 */}
              {selectedProduct && (
                <div className="bg-[#F6F8FB] rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    {selectedProduct.imageUrl && (
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.productTitle}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-[#637089]">当前价格</p>
                        <p className="font-semibold">¥{((selectedProduct.currentPrice || 0) / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#637089]">当前销量</p>
                        <p className="font-semibold">{selectedProduct.currentSales || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#637089]">评分</p>
                        <p className="font-semibold">{selectedProduct.currentRating || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#637089]">监控状态</p>
                        <p className="font-semibold">
                          {selectedProduct.status === 'active' ? '监控中' : selectedProduct.status === 'paused' ? '已暂停' : '已移除'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 趋势图表 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border rounded-lg p-4">
                  <TrendChart data={trendData} type="price" />
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <TrendChart data={trendData} type="sales" />
                </div>
              </div>

              {/* 变更记录时间轴 */}
              <div>
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  变更记录
                </h4>
                {changeRecords.length === 0 ? (
                  <div className="text-center py-8 text-[#637089]">
                    暂无变更记录
                  </div>
                ) : (
                  <div className="space-y-3">
                    {changeRecords.map((record, index) => (
                      <div
                        key={record.id || index}
                        className="flex items-start gap-3 p-3 bg-[#F6F8FB] rounded-lg"
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-2",
                          record.changeType === 'price' ? 'bg-[#2F6BFF]' :
                          record.changeType === 'sales' ? 'bg-[#16A37B]' :
                          record.changeType === 'rating' ? 'bg-[#F59E0B]' :
                          'bg-[#637089]'
                        )} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {record.changeType === 'price' ? '价格变动' :
                               record.changeType === 'sales' ? '销量变动' :
                               record.changeType === 'rating' ? '评分变动' :
                               '其他变动'}
                            </span>
                            <span className="text-xs text-[#637089]">
                              {formatDate(record.changedAt)}
                            </span>
                          </div>
                          <p className="text-sm text-[#637089] mt-1">
                            {record.oldValue} → {record.newValue}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
