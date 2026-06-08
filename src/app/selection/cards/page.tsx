'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Send,
  Eye,
  LayoutGrid,
  List,
  RefreshCw,
  Loader2,
  Image as ImageIcon,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface ProductCard {
  id: string;
  shopId: string;
  shopName: string;
  opportunityId: string | null;
  titleZh: string | null;
  titleRu: string | null;
  descriptionRu: string | null;
  ozonCategoryId: number | null;
  ozonCategoryName: string | null;
  source1688Url: string | null;
  suggestedPrice: number | null;
  costPrice: number | null;
  status: 'draft' | 'ready' | 'submitted' | 'archived';
  variantCount: number;
  imageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Shop {
  id: string;
  name: string;
}

// Status config
const statusConfig = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: Clock },
  ready: { label: '待提交', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  submitted: { label: '已提交', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  archived: { label: '已归档', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function ProductCardsPage() {
  const router = useRouter();
  
  // State
  const [cards, setCards] = useState<ProductCard[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    shopId: 'all',
    status: 'all',
    search: '',
  });

  // Fetch data
  useEffect(() => {
    fetchShops();
    fetchCards();
  }, []);

  useEffect(() => {
    fetchCards();
  }, [filters]);

  const fetchShops = async () => {
    try {
      const res = await fetch('/api/shops');
      const data = await res.json();
      if (data.success) {
        setShops(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch shops:', error);
    }
  };

  const fetchCards = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.shopId && filters.shopId !== 'all') params.append('shopId', filters.shopId);
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      
      const res = await fetch(`/api/selection/product-cards?${params}`);
      const data = await res.json();
      if (data.success) {
        setCards(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch cards:', error);
      // Mock data for demo
      setCards(mockCards);
    } finally {
      setLoading(false);
    }
  };

  // Mock data
  const mockCards: ProductCard[] = [
    {
      id: '1',
      shopId: '1',
      shopName: 'TIANTAN',
      opportunityId: '101',
      titleZh: '女士冬季保暖羽绒服',
      titleRu: 'Женская зимняя теплая куртка',
      descriptionRu: '高品质羽绒服...',
      ozonCategoryId: 101,
      ozonCategoryName: '女装',
      source1688Url: 'https://detail.1688.com/offer/123456.html',
      suggestedPrice: 2500,
      costPrice: 800,
      status: 'ready',
      variantCount: 6,
      imageCount: 5,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-16T15:30:00Z',
    },
    {
      id: '2',
      shopId: '1',
      shopName: 'TIANTAN',
      opportunityId: '102',
      titleZh: '儿童益智积木玩具',
      titleRu: 'Детские развивающие кубики',
      descriptionRu: '益智玩具...',
      ozonCategoryId: 201,
      ozonCategoryName: '玩具',
      source1688Url: 'https://detail.1688.com/offer/789012.html',
      suggestedPrice: 890,
      costPrice: 280,
      status: 'draft',
      variantCount: 3,
      imageCount: 2,
      createdAt: '2024-01-14T08:00:00Z',
      updatedAt: '2024-01-14T08:00:00Z',
    },
    {
      id: '3',
      shopId: '1',
      shopName: 'TIANTAN',
      opportunityId: null,
      titleZh: '家用空气净化器',
      titleRu: 'Домашний очиститель воздуха',
      descriptionRu: '高效净化...',
      ozonCategoryId: 301,
      ozonCategoryName: '家电',
      source1688Url: null,
      suggestedPrice: 4500,
      costPrice: 1500,
      status: 'submitted',
      variantCount: 1,
      imageCount: 8,
      createdAt: '2024-01-10T12:00:00Z',
      updatedAt: '2024-01-12T09:00:00Z',
    },
  ];

  // Actions
  const handleCreate = () => {
    router.push('/selection/editor/new');
  };

  const handleEdit = (id: string) => {
    router.push(`/selection/editor/${id}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/selection/product-cards/${deleteTarget}`, {
        method: 'DELETE',
      });
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      fetchCards();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleDuplicate = async (id: string) => {
    // TODO: Implement duplication
    console.log('Duplicate:', id);
  };

  const handleSubmit = async (id: string) => {
    router.push(`/selection/editor/${id}`);
  };

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
    if (selectedIds.size === cards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cards.map(c => c.id)));
    }
  };

  // Filter cards
  const filteredCards = cards.filter(card => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!card.titleZh?.toLowerCase().includes(search) && 
          !card.titleRu?.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  // Stats
  const stats = {
    total: cards.length,
    draft: cards.filter(c => c.status === 'draft').length,
    ready: cards.filter(c => c.status === 'ready').length,
    submitted: cards.filter(c => c.status === 'submitted').length,
  };

  return (
    <AppLayout title="商品卡管理" subtitle="管理商品信息卡，准备上架">
      <div className="flex flex-col h-full">
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">全部商品卡</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Package className="w-8 h-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">草稿</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
                </div>
                <Clock className="w-8 h-8 text-gray-400/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">待提交</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.ready}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-blue-400/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已提交</p>
                  <p className="text-2xl font-bold text-green-600">{stats.submitted}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-400/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <div className="flex items-center gap-3">
            {/* Create Button */}
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              新建商品卡
            </Button>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="搜索商品卡..."
                className="pl-9 w-64"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
              />
            </div>

            {/* Shop Filter */}
            <Select value={filters.shopId} onValueChange={(v) => setFilters({...filters, shopId: v})}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="全部店铺" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部店铺</SelectItem>
                {shops.map(shop => (
                  <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="ready">待提交</SelectItem>
                <SelectItem value="submitted">已提交</SelectItem>
                <SelectItem value="archived">已归档</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
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
            </div>

            {/* Refresh */}
            <Button variant="ghost" size="sm" onClick={fetchCards}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Batch Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <span className="text-sm font-medium">已选择 {selectedIds.size} 项</span>
            <Button size="sm" variant="outline">
              批量提交
            </Button>
            <Button size="sm" variant="outline">
              批量归档
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              取消选择
            </Button>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Package className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg mb-2">暂无商品卡</p>
              <p className="text-sm mb-4">点击"新建商品卡"开始创建</p>
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                新建商品卡
              </Button>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCards.map(card => (
                <Card 
                  key={card.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-lg bg-white',
                    selectedIds.has(card.id) && 'ring-2 ring-primary'
                  )}
                >
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <Badge className={statusConfig[card.status].color}>
                        {statusConfig[card.status].label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(card.id)}>
                            <Edit className="w-4 h-4 mr-2" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(card.id)}>
                            <Copy className="w-4 h-4 mr-2" />
                            复制
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => {
                              setDeleteTarget(card.id);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Image Placeholder */}
                    <div 
                      className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center relative overflow-hidden"
                      onClick={() => handleEdit(card.id)}
                    >
                      {card.imageCount > 0 ? (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
                          <ImageIcon className="w-12 h-12 text-primary/30" />
                        </div>
                      ) : (
                        <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                      )}
                      {card.imageCount > 0 && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                          {card.imageCount} 张图片
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <h3 
                      className="font-medium text-sm mb-1 line-clamp-2 cursor-pointer hover:text-primary"
                      onClick={() => handleEdit(card.id)}
                    >
                      {card.titleZh || card.titleRu || '未命名商品'}
                    </h3>

                    {/* Category */}
                    <p className="text-xs text-muted-foreground mb-2">
                      {card.ozonCategoryName || '未选择类目'}
                    </p>

                    {/* Price & Variants */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold text-primary">
                        ₽{card.suggestedPrice?.toLocaleString() || '---'}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {card.variantCount} 变体
                      </Badge>
                    </div>

                    {/* Shop & Time */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                      <span>{card.shopName}</span>
                      <span>{new Date(card.updatedAt).toLocaleDateString()}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <a href={`/selection/editor/${card.id}`}>
                          <Eye className="w-3 h-3 mr-1" />
                          查看
                        </a>
                      </Button>
                      {card.status === 'ready' && (
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleSubmit(card.id)}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          提交
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left">
                      <Checkbox 
                        checked={selectedIds.size === filteredCards.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="p-3 text-left text-sm font-medium">商品</th>
                    <th className="p-3 text-left text-sm font-medium">类目</th>
                    <th className="p-3 text-left text-sm font-medium">价格</th>
                    <th className="p-3 text-left text-sm font-medium">变体</th>
                    <th className="p-3 text-left text-sm font-medium">状态</th>
                    <th className="p-3 text-left text-sm font-medium">更新时间</th>
                    <th className="p-3 text-left text-sm font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCards.map(card => (
                    <tr 
                      key={card.id} 
                      className="border-b hover:bg-muted/30 cursor-pointer"
                    >
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <Checkbox 
                          checked={selectedIds.has(card.id)}
                          onCheckedChange={() => toggleSelect(card.id)}
                        />
                      </td>
                      <td className="p-3" onClick={() => handleEdit(card.id)}>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                          </div>
                          <div>
                            <p className="font-medium text-sm line-clamp-1">
                              {card.titleZh || card.titleRu || '未命名'}
                            </p>
                            <p className="text-xs text-muted-foreground">{card.shopName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {card.ozonCategoryName || '-'}
                      </td>
                      <td className="p-3 font-medium text-primary">
                        ₽{card.suggestedPrice?.toLocaleString() || '-'}
                      </td>
                      <td className="p-3 text-sm">
                        <Badge variant="outline">{card.variantCount}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge className={statusConfig[card.status].color}>
                          {statusConfig[card.status].label}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {new Date(card.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <a href={`/selection/editor/${card.id}`}>
                              <Edit className="w-4 h-4" />
                            </a>
                          </Button>
                          {card.status === 'ready' && (
                            <Button variant="ghost" size="sm" onClick={() => handleSubmit(card.id)}>
                              <Send className="w-4 h-4 text-green-500" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setDeleteTarget(card.id);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这个商品卡吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
