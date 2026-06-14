'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package,
  Store,
  CheckCircle2,
  Clock,
  TrendingUp,
  Trash2,
  MoreHorizontal,
  Search,
  RefreshCw,
  Download,
  AlertCircle,
  Loader2,
  X,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CollectionItemModal } from './collection-item-modal';

// 类型定义
interface MarketSignal {
  id: number;
  productId: string;
  title: string;
  imageUrl?: string;
  imageS3Url?: string;
  price: number;
  originalPrice?: number;
  salesVolume?: number;
  rating?: number;
  commentCount?: number;
  sellerName?: string;
  platform: 'ozon' | 'wb';
  category?: string;
  createdAt: string;
  updatedAt: string;
}

interface CollectionItem {
  id: number;
  signalId: number;
  signal: MarketSignal;
  shopId?: string;
  shop?: { id: string; name: string };
  status: 'pending' | 'claimed' | 'published';
  publishStatus?: 'pending' | 'pending_review' | 'listed' | 'rejected';
  publishError?: string;
  editedData?: {
    title?: string;
    description?: string;
    price?: number;
    images?: string[];
  };
  claimedAt?: string;
  claimedBy?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface CollectionStats {
  pendingCount: number;
  claimedCount: number;
  publishedCount: number;
}

interface Shop {
  id: string;
  name: string;
}

interface BatchClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: number[];
  onConfirm: (shopId: string) => Promise<void>;
  shops: Shop[];
}

function BatchClaimDialog({ open, onOpenChange, selectedIds, onConfirm, shops }: BatchClaimDialogProps) {
  const [selectedShop, setSelectedShop] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!selectedShop) return;
    setLoading(true);
    try {
      await onConfirm(selectedShop);
      setSelectedShop('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批量认领商品</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            确认认领选中的 {selectedIds.length} 件商品到：
          </p>
          <Select value={selectedShop} onValueChange={setSelectedShop}>
            <SelectTrigger>
              <SelectValue placeholder="选择目标店铺" />
            </SelectTrigger>
            <SelectContent>
              {shops.map((shop) => (
                <SelectItem key={shop.id} value={shop.id}>
                  {shop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedShop || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认认领
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CollectionBoxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'pending';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [stats, setStats] = useState<CollectionStats>({
    pendingCount: 0,
    claimedCount: 0,
    publishedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [shops, setShops] = useState<Shop[]>([]);
  
  // 编辑弹窗
  const [editingItem, setEditingItem] = useState<CollectionItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  // 批量认领弹窗
  const [batchClaimOpen, setBatchClaimOpen] = useState(false);
  const [batchClaimLoading, setBatchClaimLoading] = useState(false);

  // 加载数据
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: activeTab,
        page: page.toString(),
        pageSize: '20',
      });
      if (platformFilter !== 'all') params.set('platform', platformFilter);
      if (timeFilter !== 'all') params.set('timeRange', timeFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/collection-items?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, platformFilter, timeFilter, searchQuery]);

  // 加载统计数据
  const loadStats = async () => {
    try {
      const res = await fetch('/api/collection-items/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  // 加载店铺列表
  const loadShops = async () => {
    try {
      const res = await fetch('/api/shops');
      if (res.ok) {
        const data = await res.json();
        setShops(data.shops || []);
      }
    } catch (error) {
      console.error('Failed to load shops:', error);
    }
  };

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    loadStats();
  }, [activeTab]);

  useEffect(() => {
    loadShops();
  }, []);

  // Tab切换时清空选择
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSelectedIds(new Set());
    setPage(1);
    router.push(`/collection-box?tab=${value}`, { scroll: false });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  // 单选
  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // 认领商品
  const handleClaim = async (itemId: number, shopId: string) => {
    try {
      const res = await fetch(`/api/collection-items/${itemId}/claim`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId }),
      });
      if (res.ok) {
        await loadItems();
        await loadStats();
      }
    } catch (error) {
      console.error('Failed to claim:', error);
    }
  };

  // 批量认领
  const handleBatchClaim = async (shopId: string) => {
    setBatchClaimLoading(true);
    try {
      const res = await fetch('/api/collection-items/batch-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: Array.from(selectedIds), shopId }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        await loadItems();
        await loadStats();
      }
    } catch (error) {
      console.error('Failed to batch claim:', error);
    } finally {
      setBatchClaimLoading(false);
    }
  };

  // 删除商品
  const handleDelete = async (itemId: number) => {
    if (!confirm('确认删除该商品？')) return;
    try {
      const res = await fetch(`/api/collection-items/${itemId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadItems();
        await loadStats();
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  // 发布到Ozon
  const handlePublish = async (itemId: number) => {
    try {
      const res = await fetch('/api/products/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionItemId: itemId }),
      });
      if (res.ok) {
        await loadItems();
        await loadStats();
        alert('发布成功！商品正在等待Ozon审核。');
      } else {
        const data = await res.json();
        alert(`发布失败: ${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('Failed to publish:', error);
      alert('发布失败，请重试');
    }
  };

  // 批量发布
  const handleBatchPublish = async (itemIds: number[]) => {
    if (itemIds.length === 0) return;
    
    if (!confirm(`确定要发布选中的 ${itemIds.length} 件商品到Ozon吗？`)) {
      return;
    }

    let success = 0;
    let failed = 0;

    for (const id of itemIds) {
      try {
        const res = await fetch('/api/products/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionItemId: id }),
        });
        if (res.ok) {
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    await loadItems();
    await loadStats();
    
    if (failed === 0) {
      alert(`批量发布完成！成功 ${success} 件。`);
    } else {
      alert(`批量发布完成！成功 ${success} 件，失败 ${failed} 件。`);
    }
  };

  // 批量删除
  const handleBatchDelete = async (itemIds: number[]) => {
    if (itemIds.length === 0) return;
    
    if (!confirm(`确定要删除选中的 ${itemIds.length} 件商品吗？此操作不可恢复。`)) {
      return;
    }

    let success = 0;
    let failed = 0;

    for (const id of itemIds) {
      try {
        const res = await fetch(`/api/collection-items/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    await loadItems();
    await loadStats();
    
    if (failed === 0) {
      alert(`删除成功！已删除 ${success} 件。`);
    } else {
      alert(`删除完成！成功 ${success} 件，失败 ${failed} 件。`);
    }
  };

  // 编辑完成回调
  const handleEditComplete = () => {
    setModalOpen(false);
    setEditingItem(null);
    loadItems();
  };

  // 平台图标
  const PlatformBadge = ({ platform }: { platform: string }) => {
    if (platform === 'ozon') {
      return <Badge className="bg-blue-500 hover:bg-blue-600">Ozon</Badge>;
    }
    return <Badge className="bg-purple-500 hover:bg-purple-600">WB</Badge>;
  };

  // 状态标签
  const StatusBadge = ({ status, publishStatus }: { status: string; publishStatus?: string }) => {
    if (status === 'pending') {
      return <Badge variant="outline" className="border-blue-500 text-blue-500">待认领</Badge>;
    }
    if (status === 'claimed') {
      return <Badge className="bg-blue-500 hover:bg-blue-600">已认领</Badge>;
    }
    if (status === 'published') {
      if (publishStatus === 'listed') {
        return <Badge className="bg-green-500 hover:bg-green-600">已上架</Badge>;
      }
      if (publishStatus === 'rejected') {
        return <Badge variant="destructive">被拒</Badge>;
      }
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">待审核</Badge>;
    }
    return null;
  };

  // 格式化时间
  const formatTime = (time: string) => {
    const date = new Date(time);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  // 空状态组件
  const EmptyState = ({ type }: { type: string }) => {
    if (type === 'pending') {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 mb-6 rounded-full bg-muted flex items-center justify-center">
            <Download className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">暂无待认领商品</h3>
          <p className="text-muted-foreground mb-4">
            使用 Chrome 插件采集商品，数据将自动出现在这里
          </p>
          <Button variant="outline" onClick={() => window.open('https://chrome.google.com/webstore', '_blank')}>
            下载插件
          </Button>
        </div>
      );
    }
    if (type === 'claimed') {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 mb-6 rounded-full bg-muted flex items-center justify-center">
            <Store className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">暂无已认领商品</h3>
          <p className="text-muted-foreground">
            请先在「待认领」页面认领商品
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-24 h-24 mb-6 rounded-full bg-muted flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">暂无已发布商品</h3>
        <p className="text-muted-foreground">
          认领并编辑商品后即可发布到 Ozon
        </p>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">采集箱</h1>
          <p className="text-muted-foreground">管理采集的商品，编辑后发布到 Ozon</p>
        </div>
        <Button variant="outline" onClick={loadItems} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">待认领</p>
              <p className="text-2xl font-bold">{stats.pendingCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <Store className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">已认领</p>
              <p className="text-2xl font-bold">{stats.claimedCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">已发布</p>
              <p className="text-2xl font-bold">{stats.publishedCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              待认领
              {stats.pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1">{stats.pendingCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="claimed" className="gap-2">
              已认领
              {stats.claimedCount > 0 && (
                <Badge variant="secondary" className="ml-1">{stats.claimedCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="published" className="gap-2">
              已发布
              {stats.publishedCount > 0 && (
                <Badge variant="secondary" className="ml-1">{stats.publishedCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 待认领 Tab */}
        <TabsContent value="pending" className="space-y-4">
          {/* 筛选栏 */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索商品..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="平台" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部平台</SelectItem>
                  <SelectItem value="ozon">Ozon</SelectItem>
                  <SelectItem value="wb">WB</SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="时间范围" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部时间</SelectItem>
                  <SelectItem value="today">今天</SelectItem>
                  <SelectItem value="7days">近7天</SelectItem>
                  <SelectItem value="30days">近30天</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* 列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState type="pending" />
          ) : (
            <>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === items.length && items.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>商品</TableHead>
                      <TableHead>平台</TableHead>
                      <TableHead className="text-right">售价</TableHead>
                      <TableHead className="text-right">销量</TableHead>
                      <TableHead className="text-center">评分</TableHead>
                      <TableHead>卖家</TableHead>
                      <TableHead>采集时间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleSelect(item.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {item.signal.imageUrl || item.signal.imageS3Url ? (
                              <img
                                src={item.signal.imageS3Url || item.signal.imageUrl}
                                alt={item.signal.title}
                                className="w-12 h-12 object-cover rounded"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                <Package className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <span className="font-medium line-clamp-2 max-w-[200px]">
                              {item.signal.title}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <PlatformBadge platform={item.signal.platform} />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ₽{item.signal.price?.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.signal.salesVolume?.toLocaleString() || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.signal.rating ? (
                            <span className="flex items-center justify-center gap-1">
                              ⭐ {item.signal.rating}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{item.signal.sellerName || '-'}</TableCell>
                        <TableCell title={new Date(item.createdAt).toLocaleString()}>
                          {formatTime(item.createdAt)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} />
                        </TableCell>
                        <TableCell>
                          <ClaimButton
                            itemId={item.id}
                            shops={shops}
                            onClaim={handleClaim}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              {/* 批量操作栏 */}
              {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg px-6 py-3 flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    已选择 {selectedIds.size} 件商品
                  </span>
                  <Button onClick={() => setBatchClaimOpen(true)}>
                    批量认领
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedIds(new Set())}>
                    取消
                  </Button>
                </div>
              )}

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    上一页
                  </Button>
                  <span className="flex items-center px-4">
                    第 {page} / {totalPages} 页
                  </span>
                  <Button
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* 已认领 Tab */}
        <TabsContent value="claimed">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState type="claimed" />
          ) : (
            <ClaimedTable
              items={items}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onSelectAll={toggleSelectAll}
              onEdit={setEditingItem}
              onModalOpen={setModalOpen}
              onPublish={handlePublish}
              onDelete={handleDelete}
              onBatchPublish={handleBatchPublish}
              onBatchDelete={handleBatchDelete}
            />
          )}
        </TabsContent>

        {/* 已发布 Tab */}
        <TabsContent value="published">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState type="published" />
          ) : (
            <PublishedTable items={items} onRefresh={loadItems} />
          )}
        </TabsContent>
      </Tabs>

      {/* 批量认领弹窗 */}
      <BatchClaimDialog
        open={batchClaimOpen}
        onOpenChange={setBatchClaimOpen}
        selectedIds={Array.from(selectedIds)}
        onConfirm={handleBatchClaim}
        shops={shops}
      />

      {/* 编辑弹窗 */}
      <CollectionItemModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        item={editingItem}
        onComplete={handleEditComplete}
      />
    </div>
  );
}

// 认领按钮组件
function ClaimButton({
  itemId,
  shops,
  onClaim,
}: {
  itemId: number;
  shops: Shop[];
  onClaim: (id: number, shopId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClaim = async () => {
    if (!selectedShop) return;
    setLoading(true);
    try {
      await onClaim(itemId, selectedShop);
      setOpen(false);
      setSelectedShop('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          认领
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="p-2">
          <Select value={selectedShop} onValueChange={setSelectedShop}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择店铺" />
            </SelectTrigger>
            <SelectContent>
              {shops.map((shop) => (
                <SelectItem key={shop.id} value={shop.id}>
                  {shop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full mt-2"
            size="sm"
            onClick={handleClaim}
            disabled={!selectedShop || loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认认领
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// 已认领列表
function ClaimedTable({
  items,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onEdit,
  onModalOpen,
  onPublish,
  onDelete,
  onBatchPublish,
  onBatchDelete,
}: {
  items: CollectionItem[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onEdit: (item: CollectionItem) => void;
  onModalOpen: (open: boolean) => void;
  onPublish: (id: number) => void;
  onDelete: (id: number) => void;
  onBatchPublish: (ids: number[]) => void;
  onBatchDelete: (ids: number[]) => void;
}) {
  // 状态标签
  const StatusBadgeClaimed = ({ status }: { status: string }) => {
    if (status === 'claimed') {
      return <Badge className="bg-blue-500 hover:bg-blue-600">已认领</Badge>;
    }
    return <Badge variant="outline" className="border-blue-500 text-blue-500">待认领</Badge>;
  };

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === items.length && items.length > 0}
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
              <TableHead>商品</TableHead>
              <TableHead>店铺</TableHead>
              <TableHead className="text-right">售价</TableHead>
              <TableHead>采集时间</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => onToggleSelect(item.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {item.signal.imageUrl || item.signal.imageS3Url ? (
                      <img
                        src={item.signal.imageS3Url || item.signal.imageUrl}
                        alt={item.signal.title}
                        className="w-12 h-12 object-cover rounded"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <span className="font-medium line-clamp-2 max-w-[200px]">
                      {item.signal.title}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{item.shop?.name || '-'}</TableCell>
                <TableCell className="text-right font-mono">
                  ₽{item.signal.price?.toLocaleString()}
                </TableCell>
                <TableCell>
                  {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                </TableCell>
                <TableCell>
                  <StatusBadgeClaimed status={item.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onEdit(item);
                        onModalOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onPublish(item.id)}>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          发布到Ozon
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(item.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg px-6 py-3 flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            已选择 {selectedIds.size} 件商品
          </span>
          <Button onClick={() => onBatchPublish(Array.from(selectedIds))}>
            批量发布
          </Button>
          <Button variant="outline" onClick={() => onBatchDelete(Array.from(selectedIds))}>
            批量删除
          </Button>
          <Button variant="ghost" onClick={() => onToggleSelect(-1)}>
            取消
          </Button>
        </div>
      )}
    </>
  );
}

// 已发布列表
function PublishedTable({ 
  items, 
  onRefresh 
}: { 
  items: CollectionItem[]; 
  onRefresh: () => void;
}) {
  // 自动刷新：每60秒刷新一次
  useEffect(() => {
    const interval = setInterval(() => {
      onRefresh();
    }, 60000);
    return () => clearInterval(interval);
  }, [onRefresh]);

  return (
    <Card>
      <div className="flex justify-end p-2 border-b">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新状态
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>商品</TableHead>
            <TableHead>店铺</TableHead>
            <TableHead className="text-right">售价</TableHead>
            <TableHead>发布时间</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="w-24">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  {item.signal.imageUrl || item.signal.imageS3Url ? (
                    <img
                      src={item.signal.imageS3Url || item.signal.imageUrl}
                      alt={item.signal.title}
                      className="w-12 h-12 object-cover rounded"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <span className="font-medium line-clamp-2 max-w-[200px]">
                    {item.signal.title}
                  </span>
                </div>
              </TableCell>
              <TableCell>{item.shop?.name || '-'}</TableCell>
              <TableCell className="text-right font-mono">
                ₽{item.signal.price?.toLocaleString()}
              </TableCell>
              <TableCell>
                {item.publishedAt
                  ? new Date(item.publishedAt).toLocaleDateString('zh-CN')
                  : '-'}
              </TableCell>
              <TableCell>
                <PublishStatusBadge status={item.publishStatus} error={item.publishError} />
              </TableCell>
              <TableCell>
                <Button size="sm" variant="ghost">
                  查看详情
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// 发布状态标签
function PublishStatusBadge({
  status,
  error,
}: {
  status?: string;
  error?: string;
}) {
  if (status === 'listed') {
    return <Badge className="bg-green-500">已上架</Badge>;
  }
  if (status === 'rejected') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Badge variant="destructive" className="cursor-pointer">
            被拒
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <div className="p-2 text-sm">
            <p className="font-semibold">拒绝原因：</p>
            <p className="text-muted-foreground">{error || '未知原因'}</p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return <Badge className="bg-yellow-500">待审核</Badge>;
}
