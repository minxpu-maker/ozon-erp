'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Image,
  Upload,
  Wand2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  Filter,
  Grid,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageItem {
  id: number;
  productCardId: number;
  originalUrl: string;
  processedUrl: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  complianceStatus: 'pending' | 'passed' | 'failed';
  template: string | null;
  createdAt: string;
}

export default function ImageWorkbenchPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedImages, setSelectedImages] = useState<number[]>([]);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/image-listing/images');
      const data = await res.json();
      if (data.success) {
        setImages(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data
  const mockImages: ImageItem[] = [
    { id: 1, productCardId: 1, originalUrl: '', processedUrl: '', status: 'completed', complianceStatus: 'passed', template: '白底图', createdAt: new Date().toISOString() },
    { id: 2, productCardId: 1, originalUrl: '', processedUrl: '', status: 'completed', complianceStatus: 'passed', template: '场景图', createdAt: new Date().toISOString() },
    { id: 3, productCardId: 2, originalUrl: '', processedUrl: null, status: 'processing', complianceStatus: 'pending', template: null, createdAt: new Date().toISOString() },
    { id: 4, productCardId: 2, originalUrl: '', processedUrl: null, status: 'pending', complianceStatus: 'pending', template: null, createdAt: new Date().toISOString() },
    { id: 5, productCardId: 3, originalUrl: '', processedUrl: '', status: 'completed', complianceStatus: 'failed', template: '白底图', createdAt: new Date().toISOString() },
    { id: 6, productCardId: 3, originalUrl: '', processedUrl: '', status: 'failed', complianceStatus: 'pending', template: '场景图', createdAt: new Date().toISOString() },
  ];

  const displayImages = images.length > 0 ? images : mockImages;

  const filteredImages = displayImages.filter(img => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return img.status === 'pending';
    if (filterStatus === 'processing') return img.status === 'processing';
    if (filterStatus === 'completed') return img.status === 'completed';
    if (filterStatus === 'failed') return img.status === 'failed' || img.complianceStatus === 'failed';
    return true;
  });

  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    pending: { icon: Clock, color: 'text-yellow-500', label: '等待处理' },
    processing: { icon: RefreshCw, color: 'text-blue-500', label: '处理中' },
    completed: { icon: CheckCircle, color: 'text-green-500', label: '已完成' },
    failed: { icon: XCircle, color: 'text-red-500', label: '失败' },
  };

  const handleSelect = (id: number) => {
    setSelectedImages(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedImages.length === filteredImages.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages(filteredImages.map(img => img.id));
    }
  };

  const handleBatchProcess = async () => {
    // TODO: Call batch process API
    console.log('Batch process:', selectedImages);
  };

  const handleComplianceCheck = async (id: number) => {
    // TODO: Call compliance check API
    console.log('Check compliance:', id);
  };

  const handleEditImage = async (id: number, type: string) => {
    // TODO: Call AI edit API
    console.log('Edit image:', id, type);
  };

  return (
    <AppLayout title="修图工作台" subtitle="AI智能修图与合规检查">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Upload Button */}
          <Button>
            <Upload className="w-4 h-4 mr-2" />
            上传图片
          </Button>

          {/* Filter */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="筛选状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="pending">等待处理</SelectItem>
              <SelectItem value="processing">处理中</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="failed">失败/不合规</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex border rounded-lg">
            <Button 
              variant={viewMode === 'grid' ? 'default' : 'ghost'} 
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'default' : 'ghost'} 
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          {/* Templates Button */}
          <Button variant="outline">
            修图模板
          </Button>
        </div>
      </div>

      {/* Selected Actions Bar */}
      {selectedImages.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-3 mb-6 flex items-center justify-between">
          <span className="text-sm">
            已选择 {selectedImages.length} 张图片
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedImages([])}>
              取消选择
            </Button>
            <Button size="sm" onClick={handleBatchProcess}>
              <Wand2 className="w-4 h-4 mr-2" />
              批量处理
            </Button>
          </div>
        </div>
      )}

      {/* Image Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredImages.map(img => {
            const status = statusConfig[img.status];
            const StatusIcon = status.icon;
            
            return (
              <Card 
                key={img.id}
                className={cn(
                  'cursor-pointer transition-all',
                  selectedImages.includes(img.id) && 'ring-2 ring-[#2F6BFF]'
                )}
                onClick={() => handleSelect(img.id)}
              >
                <CardContent className="p-3">
                  {/* Image Preview */}
                  <div className="aspect-square bg-muted rounded-lg mb-3 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Image className="w-12 h-12 text-muted-foreground/50" />
                    </div>

                    {/* Selection Checkbox */}
                    <div className="absolute top-2 left-2">
                      <div className={cn(
                        'w-5 h-5 rounded border flex items-center justify-center',
                        selectedImages.includes(img.id) 
                          ? 'bg-[#2F6BFF] border-[#2F6BFF]' 
                          : 'bg-white'
                      )}>
                        {selectedImages.includes(img.id) && (
                          <CheckCircle className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className={cn('text-xs', status.color)}>
                        <StatusIcon className={cn(
                          'w-3 h-3 mr-1',
                          img.status === 'processing' && 'animate-spin'
                        )} />
                        {status.label}
                      </Badge>
                    </div>

                    {/* Compliance Badge */}
                    {img.complianceStatus === 'passed' && (
                      <div className="absolute bottom-2 left-2">
                        <Badge className="bg-green-500 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          合规
                        </Badge>
                      </div>
                    )}
                    {img.complianceStatus === 'failed' && (
                      <div className="absolute bottom-2 left-2">
                        <Badge className="bg-red-500 text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          不合规
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Image Info */}
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      商品卡: #{img.productCardId}
                    </div>
                    {img.template && (
                      <Badge variant="outline" className="text-xs">
                        {img.template}
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 mt-3">
                    <Button variant="ghost" size="sm" className="flex-1">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleComplianceCheck(img.id);
                      }}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditImage(img.id, 'background');
                      }}
                    >
                      <Wand2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List View */
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-3 text-left">
                    <input 
                      type="checkbox"
                      checked={selectedImages.length === filteredImages.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="p-3 text-left text-sm">预览</th>
                  <th className="p-3 text-left text-sm">商品卡</th>
                  <th className="p-3 text-left text-sm">模板</th>
                  <th className="p-3 text-left text-sm">状态</th>
                  <th className="p-3 text-left text-sm">合规</th>
                  <th className="p-3 text-left text-sm">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredImages.map(img => {
                  const status = statusConfig[img.status];
                  const StatusIcon = status.icon;
                  
                  return (
                    <tr key={img.id} className="border-b">
                      <td className="p-3">
                        <input 
                          type="checkbox"
                          checked={selectedImages.includes(img.id)}
                          onChange={() => handleSelect(img.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                          <Image className="w-6 h-6 text-muted-foreground" />
                        </div>
                      </td>
                      <td className="p-3">#{img.productCardId}</td>
                      <td className="p-3">{img.template || '-'}</td>
                      <td className="p-3">
                        <Badge variant="secondary" className={status.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {img.complianceStatus === 'passed' && (
                          <Badge className="bg-green-500">通过</Badge>
                        )}
                        {img.complianceStatus === 'failed' && (
                          <Badge className="bg-red-500">不通过</Badge>
                        )}
                        {img.complianceStatus === 'pending' && (
                          <Badge variant="outline">待检查</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Wand2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{displayImages.length}</div>
            <div className="text-sm text-muted-foreground">总图片数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">
              {displayImages.filter(i => i.complianceStatus === 'passed').length}
            </div>
            <div className="text-sm text-muted-foreground">合规通过</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-500">
              {displayImages.filter(i => i.status === 'pending').length}
            </div>
            <div className="text-sm text-muted-foreground">待处理</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-500">
              {displayImages.filter(i => i.complianceStatus === 'failed').length}
            </div>
            <div className="text-sm text-muted-foreground">不合规</div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
