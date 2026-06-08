'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  ChevronDown,
  ChevronRight,
  Columns,
  Grid3X3,
  List,
  SkipForward,
  Link2,
  Star,
  ZoomIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 图片类型定义
interface ComplianceCheck {
  size: boolean;
  ratio: boolean;
  format: boolean;
  whiteBackground: boolean;
  watermark: boolean;
  text: boolean;
  backgroundTolerance: boolean;
  margin: boolean;
}

interface ImageItem {
  id: number;
  name: string;
  productCardId: number;
  originalUrl: string;
  processedUrl: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  complianceStatus: 'pending' | 'passed' | 'failed';
  reviewStatus: 'pending' | 'approved' | 'rejected';
  template: string | null;
  complianceCheck: ComplianceCheck | null;
  createdAt: string;
}

// 商品卡类型定义
interface ProductCard {
  id: number;
  title: string;
  status: 'pending' | 'processing' | 'reviewing';
  imageCount: number;
  thumbnail: string;
}

// 审核模式类型
type ReviewMode = 'single' | 'grid' | 'batch';

// 打回原因
const rejectReasons = [
  { value: 'quality', label: '图片质量不合格' },
  { value: 'color', label: '颜色偏差严重' },
  { value: 'angle', label: '拍摄角度不合适' },
  { value: 'background', label: '背景处理不合格' },
  { value: 'size', label: '尺寸不符合要求' },
  { value: 'other', label: '其他原因' },
];

export default function ImageWorkbenchPage() {
  // 商品卡列表状态
  const [productCards, setProductCards] = useState<ProductCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<ProductCard | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['pending', 'processing', 'reviewing']);
  
  // 图片列表状态
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  
  // 审核模式
  const [reviewMode, setReviewMode] = useState<ReviewMode>('single');
  
  // 对话框状态
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showComplianceDetail, setShowComplianceDetail] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [importUrls, setImportUrls] = useState('');
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProductCards();
  }, []);

  const fetchProductCards = async () => {
    setLoading(true);
    try {
      // 模拟数据
      setProductCards([
        { id: 1, title: '女士针织开衫', status: 'pending', imageCount: 8, thumbnail: '' },
        { id: 2, title: '男士休闲T恤', status: 'pending', imageCount: 6, thumbnail: '' },
        { id: 3, title: '儿童连衣裙', status: 'processing', imageCount: 12, thumbnail: '' },
        { id: 4, title: '运动短裤', status: 'processing', imageCount: 4, thumbnail: '' },
        { id: 5, title: '羊毛大衣', status: 'reviewing', imageCount: 10, thumbnail: '' },
        { id: 6, title: '棉麻衬衫', status: 'reviewing', imageCount: 8, thumbnail: '' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchImages = async (productCardId: number) => {
    // 模拟数据
    const mockImages: ImageItem[] = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      name: `图片-${i + 1}.jpg`,
      productCardId,
      originalUrl: '',
      processedUrl: i < 8 ? '' : null,
      status: i < 8 ? 'completed' : (i < 10 ? 'processing' : 'pending'),
      complianceStatus: i < 6 ? 'passed' : (i < 8 ? 'failed' : 'pending'),
      reviewStatus: i < 4 ? 'approved' : (i < 6 ? 'rejected' : 'pending'),
      template: i % 2 === 0 ? '白底图' : '场景图',
      complianceCheck: {
        size: i % 3 !== 0,
        ratio: i % 2 === 0,
        format: true,
        whiteBackground: i % 4 !== 0,
        watermark: true,
        text: i % 5 !== 0,
        backgroundTolerance: i % 3 === 0,
        margin: i % 2 === 0,
      },
      createdAt: new Date().toISOString(),
    }));
    setImages(mockImages);
    if (mockImages.length > 0) {
      setSelectedImage(mockImages[0]);
    }
  };

  // 分组商品卡
  const groupedCards = {
    pending: productCards.filter(c => c.status === 'pending'),
    processing: productCards.filter(c => c.status === 'processing'),
    reviewing: productCards.filter(c => c.status === 'reviewing'),
  };

  const groupLabels = {
    pending: { label: '待修图', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    processing: { label: '修图中', color: 'text-blue-600', bg: 'bg-blue-50' },
    reviewing: { label: '待审核', color: 'text-green-600', bg: 'bg-green-50' },
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => 
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const handleSelectCard = (card: ProductCard) => {
    setSelectedCard(card);
    fetchImages(card.id);
    setSelectedImages([]);
  };

  // 审核操作
  const handleApprove = async (imageId: number) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, reviewStatus: 'approved' } : img
    ));
    // 移动到下一张
    const currentIndex = images.findIndex(img => img.id === imageId);
    if (currentIndex < images.length - 1) {
      setSelectedImage(images[currentIndex + 1]);
    }
  };

  const handleReject = async (imageId: number) => {
    setShowRejectDialog(true);
  };

  const handleSkip = () => {
    const currentIndex = images.findIndex(img => img.id === selectedImage?.id);
    if (currentIndex < images.length - 1) {
      setSelectedImage(images[currentIndex + 1]);
    }
  };

  const confirmReject = async () => {
    if (selectedImage) {
      setImages(prev => prev.map(img => 
        img.id === selectedImage.id ? { ...img, reviewStatus: 'rejected' } : img
      ));
      handleSkip();
    }
    setShowRejectDialog(false);
    setRejectReason('');
  };

  // 批量操作
  const handleSelectAll = () => {
    if (selectedImages.length === images.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages(images.map(img => img.id));
    }
  };

  const handleInvertSelection = () => {
    setSelectedImages(prev => 
      images.map(img => img.id).filter(id => !prev.includes(id))
    );
  };

  const handleBatchApprove = async () => {
    setImages(prev => prev.map(img => 
      selectedImages.includes(img.id) ? { ...img, reviewStatus: 'approved' } : img
    ));
    setSelectedImages([]);
  };

  const handleBatchReject = async () => {
    setImages(prev => prev.map(img => 
      selectedImages.includes(img.id) ? { ...img, reviewStatus: 'rejected' } : img
    ));
    setSelectedImages([]);
  };

  // 合规检查项
  const complianceItems = [
    { key: 'size', label: '尺寸' },
    { key: 'ratio', label: '比例' },
    { key: 'format', label: '格式' },
    { key: 'whiteBackground', label: '白底' },
    { key: 'watermark', label: '水印' },
    { key: 'text', label: '文字' },
    { key: 'backgroundTolerance', label: '背景容差' },
    { key: 'margin', label: '边距' },
  ];

  const getCompliancePassedCount = (check: ComplianceCheck) => {
    return Object.values(check).filter(Boolean).length;
  };

  return (
    <AppLayout title="修图工作台" subtitle="AI智能修图与合规审核">
      <div className="flex gap-4 h-[calc(100vh-140px)]">
        {/* 左侧商品卡列表 */}
        <div className="w-72 flex-shrink-0 overflow-y-auto border rounded-lg bg-background">
          <div className="p-3 border-b bg-muted/30 font-medium sticky top-0">
            商品卡列表 ({productCards.length})
          </div>
          <div className="p-2">
            {Object.entries(groupedCards).map(([group, cards]) => {
              const config = groupLabels[group as keyof typeof groupLabels];
              const isExpanded = expandedGroups.includes(group);
              
              return (
                <div key={group} className="mb-2">
                  <div 
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg cursor-pointer',
                      config.bg
                    )}
                    onClick={() => toggleGroup(group)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span className={cn('font-medium', config.color)}>{config.label}</span>
                    </div>
                    <Badge variant="secondary" className={config.color}>{cards.length}</Badge>
                  </div>
                  {isExpanded && (
                    <div className="mt-1 space-y-1">
                      {cards.map(card => (
                        <div
                          key={card.id}
                          className={cn(
                            'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                            selectedCard?.id === card.id 
                              ? 'bg-primary/10 border border-primary/30' 
                              : 'hover:bg-muted/50'
                          )}
                          onClick={() => handleSelectCard(card)}
                        >
                          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0">
                            <Image className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{card.title}</div>
                            <div className="text-xs text-muted-foreground">{card.imageCount} 张图片</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧审核区域 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedCard ? (
            <>
              {/* 顶部工具栏 */}
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selectedCard.title}</span>
                  <Badge variant="outline">{images.length} 张图片</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {/* 审核模式切换 */}
                  <div className="flex border rounded-lg overflow-hidden">
                    <Button
                      variant={reviewMode === 'single' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none"
                      onClick={() => setReviewMode('single')}
                    >
                      <Columns className="w-4 h-4 mr-1" />
                      单图对比
                    </Button>
                    <Button
                      variant={reviewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none"
                      onClick={() => setReviewMode('grid')}
                    >
                      <Grid3X3 className="w-4 h-4 mr-1" />
                      九宫格快审
                    </Button>
                    <Button
                      variant={reviewMode === 'batch' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none"
                      onClick={() => setReviewMode('batch')}
                    >
                      <List className="w-4 h-4 mr-1" />
                      批量操作
                    </Button>
                  </div>
                  
                  <Button variant="outline" onClick={() => setShowBatchImport(true)}>
                    <Link2 className="w-4 h-4 mr-1" />
                    批量导入
                  </Button>
                </div>
              </div>

              {/* 审核内容区 */}
              <div className="flex-1 overflow-hidden">
                {reviewMode === 'single' && (
                  /* 单图对比模式 */
                  <div className="h-full flex flex-col">
                    <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                      {/* 原图 */}
                      <Card className="flex flex-col">
                        <CardHeader className="py-2 px-4 border-b">
                          <CardTitle className="text-sm flex items-center justify-between">
                            <span>原图</span>
                            {selectedImage && (
                              <Badge variant="outline">{selectedImage.name}</Badge>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex items-center justify-center p-4">
                          {selectedImage ? (
                            <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center relative">
                              <Image className="w-24 h-24 text-muted-foreground/30" />
                              {/* 合规状态 */}
                              <div className="absolute top-2 right-2 flex gap-1">
                                {selectedImage.complianceStatus === 'passed' && (
                                  <Badge className="bg-green-500">
                                    <CheckCircle className="w-3 h-3 mr-1" /> 合规
                                  </Badge>
                                )}
                                {selectedImage.complianceStatus === 'failed' && (
                                  <Badge 
                                    className="bg-red-500 cursor-pointer"
                                    onClick={() => setShowComplianceDetail(selectedImage.id)}
                                  >
                                    <AlertTriangle className="w-3 h-3 mr-1" /> 不合规
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground">请选择图片</div>
                          )}
                        </CardContent>
                      </Card>

                      {/* 修后图 */}
                      <Card className="flex flex-col">
                        <CardHeader className="py-2 px-4 border-b">
                          <CardTitle className="text-sm flex items-center justify-between">
                            <span>修后图</span>
                            {selectedImage?.template && (
                              <Badge variant="secondary">{selectedImage.template}</Badge>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex items-center justify-center p-4">
                          {selectedImage?.processedUrl ? (
                            <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                              <Image className="w-24 h-24 text-muted-foreground/30" />
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-center">
                              <Clock className="w-12 h-12 mx-auto mb-2 text-yellow-500" />
                              <div>图片待处理中</div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* 底部操作栏 */}
                    <div className="mt-4 flex items-center justify-center gap-4 p-4 bg-muted/30 rounded-lg flex-shrink-0">
                      <Button 
                        variant="outline" 
                        className="w-32"
                        onClick={handleSkip}
                      >
                        <SkipForward className="w-4 h-4 mr-2" />
                        跳过
                      </Button>
                      <Button 
                        variant="destructive" 
                        className="w-32"
                        onClick={() => selectedImage && handleReject(selectedImage.id)}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        打回
                      </Button>
                      <Button 
                        className="w-32 bg-green-600 hover:bg-green-700"
                        onClick={() => selectedImage && handleApprove(selectedImage.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        通过
                      </Button>
                    </div>

                    {/* 图片缩略图导航 */}
                    <div className="mt-4 flex gap-2 overflow-x-auto p-2 bg-muted/30 rounded-lg flex-shrink-0">
                      {images.map(img => (
                        <div
                          key={img.id}
                          className={cn(
                            'w-16 h-16 bg-muted rounded flex-shrink-0 cursor-pointer relative flex items-center justify-center',
                            selectedImage?.id === img.id && 'ring-2 ring-primary'
                          )}
                          onClick={() => setSelectedImage(img)}
                        >
                          <Image className="w-6 h-6 text-muted-foreground/50" />
                          {img.reviewStatus === 'approved' && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                          )}
                          {img.reviewStatus === 'rejected' && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                              <XCircle className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reviewMode === 'grid' && (
                  /* 九宫格快审模式 */
                  <div className="h-full flex flex-col">
                    {/* 快捷操作 */}
                    <div className="flex gap-2 mb-4 flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={handleSelectAll}>
                        全选通过
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleBatchReject}>
                        全选打回
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleInvertSelection}>
                        反选
                      </Button>
                    </div>
                    
                    {/* 图片网格 */}
                    <div className="flex-1 grid grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto">
                      {images.map(img => (
                        <div
                          key={img.id}
                          className="aspect-square bg-muted rounded-lg relative group"
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Image className="w-12 h-12 text-muted-foreground/30" />
                          </div>
                          
                          {/* 合规状态图标 */}
                          <div className="absolute top-2 left-2">
                            {img.complianceStatus === 'passed' && (
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-4 h-4 text-white" />
                              </div>
                            )}
                            {img.complianceStatus === 'failed' && (
                              <div 
                                className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center cursor-pointer"
                                onClick={() => setShowComplianceDetail(img.id)}
                              >
                                <XCircle className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>
                          
                          {/* 审核按钮 */}
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="w-7 h-7 p-0 bg-green-500 hover:bg-green-600"
                              onClick={() => handleApprove(img.id)}
                            >
                              <CheckCircle className="w-4 h-4 text-white" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="w-7 h-7 p-0 bg-red-500 hover:bg-red-600"
                              onClick={() => {
                                setSelectedImage(img);
                                handleReject(img.id);
                              }}
                            >
                              <XCircle className="w-4 h-4 text-white" />
                            </Button>
                          </div>
                          
                          {/* 图片名称 */}
                          <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white text-xs truncate">
                            {img.name}
                          </div>
                          
                          {/* 已审核标记 */}
                          {img.reviewStatus !== 'pending' && (
                            <div className={cn(
                              'absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg',
                            )}>
                              {img.reviewStatus === 'approved' && (
                                <Badge className="bg-green-500">已通过</Badge>
                              )}
                              {img.reviewStatus === 'rejected' && (
                                <Badge className="bg-red-500">已打回</Badge>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reviewMode === 'batch' && (
                  /* 批量操作模式 */
                  <Card className="h-full flex flex-col">
                    <CardContent className="flex-1 overflow-auto p-0">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-background border-b">
                          <tr>
                            <th className="p-3 text-left w-10">
                              <Checkbox 
                                checked={selectedImages.length === images.length && images.length > 0}
                                onCheckedChange={handleSelectAll}
                              />
                            </th>
                            <th className="p-3 text-left">缩略图</th>
                            <th className="p-3 text-left">图片名称</th>
                            <th className="p-3 text-left">合规状态</th>
                            <th className="p-3 text-left">审核状态</th>
                            <th className="p-3 text-left">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {images.map(img => (
                            <tr key={img.id} className="border-b hover:bg-muted/30">
                              <td className="p-3">
                                <Checkbox 
                                  checked={selectedImages.includes(img.id)}
                                  onCheckedChange={() => {
                                    setSelectedImages(prev => 
                                      prev.includes(img.id) 
                                        ? prev.filter(i => i !== img.id) 
                                        : [...prev, img.id]
                                    );
                                  }}
                                />
                              </td>
                              <td className="p-3">
                                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                  <Image className="w-6 h-6 text-muted-foreground/50" />
                                </div>
                              </td>
                              <td className="p-3 text-sm">{img.name}</td>
                              <td className="p-3">
                                {img.complianceStatus === 'passed' && (
                                  <Badge className="bg-green-500">
                                    <CheckCircle className="w-3 h-3 mr-1" /> 通过
                                  </Badge>
                                )}
                                {img.complianceStatus === 'failed' && (
                                  <Badge 
                                    className="bg-red-500 cursor-pointer"
                                    onClick={() => setShowComplianceDetail(img.id)}
                                  >
                                    <AlertTriangle className="w-3 h-3 mr-1" /> 不合规
                                  </Badge>
                                )}
                                {img.complianceStatus === 'pending' && (
                                  <Badge variant="outline">待检查</Badge>
                                )}
                              </td>
                              <td className="p-3">
                                {img.reviewStatus === 'approved' && (
                                  <Badge className="bg-green-500">已通过</Badge>
                                )}
                                {img.reviewStatus === 'rejected' && (
                                  <Badge className="bg-red-500">已打回</Badge>
                                )}
                                {img.reviewStatus === 'pending' && (
                                  <Badge variant="outline">待审核</Badge>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => handleApprove(img.id)}>
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => { setSelectedImage(img); handleReject(img.id); }}>
                                    <XCircle className="w-4 h-4 text-red-500" />
                                  </Button>
                                  <Button variant="ghost" size="sm">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                    {selectedImages.length > 0 && (
                      <div className="p-3 border-t bg-muted/30 flex items-center justify-between flex-shrink-0">
                        <span className="text-sm">已选择 {selectedImages.length} 张</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setSelectedImages([])}>
                            取消
                          </Button>
                          <Button variant="destructive" size="sm" onClick={handleBatchReject}>
                            批量打回
                          </Button>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleBatchApprove}>
                            批量通过
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Image className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <p>请从左侧选择商品卡开始审核</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 批量导入对话框 */}
      <Dialog open={showBatchImport} onOpenChange={setShowBatchImport}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>批量导入图片</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              粘贴多个1688图片URL，每行一个，系统将自动下载并上传到S3
            </p>
            <Textarea
              placeholder="https://cbu01.alicdn.com/img/ibank/xxx.jpg&#10;https://cbu01.alicdn.com/img/ibank/yyy.jpg&#10;..."
              value={importUrls}
              onChange={(e) => setImportUrls(e.target.value)}
              rows={8}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchImport(false)}>
              取消
            </Button>
            <Button onClick={() => {
              // TODO: 实现下载逻辑
              setShowBatchImport(false);
              setImportUrls('');
            }}>
              <Download className="w-4 h-4 mr-2" />
              开始导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 打回原因对话框 */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择打回原因</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={rejectReason} onValueChange={setRejectReason}>
              <SelectTrigger>
                <SelectValue placeholder="请选择打回原因" />
              </SelectTrigger>
              <SelectContent>
                {rejectReasons.map(reason => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmReject} disabled={!rejectReason}>
              确认打回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 合规检查明细对话框 */}
      <Dialog open={showComplianceDetail !== null} onOpenChange={() => setShowComplianceDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>合规检查明细</DialogTitle>
          </DialogHeader>
          {showComplianceDetail && (
            <div className="space-y-2">
              {(() => {
                const img = images.find(i => i.id === showComplianceDetail);
                if (!img?.complianceCheck) return <div className="text-muted-foreground">暂无合规检查数据</div>;
                return complianceItems.map(item => (
                  <div 
                    key={item.key} 
                    className="flex items-center justify-between p-2 rounded bg-muted/30"
                  >
                    <span className="text-sm">{item.label}</span>
                    {img.complianceCheck?.[item.key as keyof ComplianceCheck] ? (
                      <Badge className="bg-green-500">
                        <CheckCircle className="w-3 h-3 mr-1" /> 通过
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500">
                        <XCircle className="w-3 h-3 mr-1" /> 不通过
                      </Badge>
                    )}
                  </div>
                ));
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
