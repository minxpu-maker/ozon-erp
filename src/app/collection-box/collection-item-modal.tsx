'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronUp,
  Calculator,
  Image as ImageIcon,
  Save,
  Rocket,
  X,
  Star,
  GripVertical,
  Loader2,
  AlertTriangle,
  Sparkles,
  Languages,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollectionItem {
  id: number;
  signalId: number;
  signal: {
    id: number;
    productId: string;
    productTitle: string;
    productUrl?: string;
    description?: string;
    imageUrl?: string;
    price: string | number;
    originalPrice?: string | number;
    salesVolume?: number;
    rating?: string | number;
    reviewsCount?: number;
    sellerName?: string;
    sellerType?: string;
    deliveryType?: string;
    weight?: string | number;
    categoryPath?: string;
    categoryName?: string;
    sourceType: string;
    profitRate?: string | number;
    revenue?: string | number;
  };
  shopId?: string;
  status: string;
  editedData?: {
    title?: string;
    description?: string;
    price?: number;
    images?: string[];
  };
}

interface ProfitResult {
  profit: number;
  profitRate: number;
  roi: number;
  suggestedPrice: number;
  breakdown: {
    ozonCommission: number;
    commissionRate: number;
    logisticsCost: number;
    exchangeRate: number;
  };
}

interface CollectionItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CollectionItem | null;
  onComplete: () => void;
}

export function CollectionItemModal({
  open,
  onOpenChange,
  item,
  onComplete,
}: CollectionItemModalProps) {
  // 编辑状态
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // 利润计算器
  const [profitOpen, setProfitOpen] = useState(false);
  const [purchaseCost, setPurchaseCost] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [exchangeRate, setExchangeRate] = useState('0.08');
  const [profitResult, setProfitResult] = useState<ProfitResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  // 初始化数据
  useEffect(() => {
    if (item) {
      setTitle(item.editedData?.title || item.signal.productTitle || '');
      setDescription(item.editedData?.description || '');
      setPrice(item.editedData?.price || Number(item.signal.price) || 0);
      setImages(item.editedData?.images || [item.signal.imageUrl].filter(Boolean) as string[]);
      setProfitResult(null);
      setProfitOpen(false);
    }
  }, [item]);

  // 计算利润
  const calculateProfit = async () => {
    if (!price || !purchaseCost) return;
    setCalculating(true);
    try {
      const res = await fetch('/api/profit-calculator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price,
          purchaseCost: parseFloat(purchaseCost),
          shippingCost: parseFloat(shippingCost) || 0,
          weight: item?.signal.weight,
          exchangeRate: parseFloat(exchangeRate) || 0.08,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfitResult(data);
      }
    } catch (error) {
      console.error('Failed to calculate profit:', error);
    } finally {
      setCalculating(false);
    }
  };

  // AI生成标题
  const handleGenerateTitle = async () => {
    if (!item?.signal?.categoryPath) return;
    setIsGeneratingTitle(true);
    try {
      const res = await fetch('/api/ai/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTitle: (item as any).productTitle || (item as any).signal?.productTitle || (item as any).signal?.title,
          category: item.signal?.categoryPath,
          style: 'seo',
        }),
      });
      const data = await res.json();
      if (data.titles?.length > 0) {
        setTitle(data.titles[0]);
      }
    } catch (error) {
      console.error('Failed to generate title:', error);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  // AI生成描述
  const handleGenerateDescription = async () => {
    if (!item?.signal?.categoryPath) return;
    setIsGeneratingDesc(true);
    try {
      const res = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || (item as any).productTitle,
          category: (item as any).signal?.categoryPath,
          length: 'medium',
        }),
      });
      const data = await res.json();
      if (data.description) {
        setDescription(data.description);
      }
    } catch (error) {
      console.error('Failed to generate description:', error);
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  // 翻译标题和描述
  const handleTranslate = async (_field?: string) => {
    if (!item?.signal?.productTitle && !description) return;
    setIsTranslating(true);
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: [title || item?.signal?.productTitle, description].filter(Boolean),
          from: 'zh',
          to: 'ru',
        }),
      });
      const data = await res.json();
      if (data.translations && data.translations.length > 0) {
        if (data.translations[0]) setTitle(data.translations[0]);
        if (data.translations[1]) setDescription(data.translations[1]);
      }
    } catch (error) {
      console.error('Failed to translate:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  // 保存编辑
  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/collection-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editedData: {
            title,
            description,
            price,
            images,
          },
        }),
      });
      if (res.ok) {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  // 保存并发布
  const handleSaveAndPublish = async () => {
    if (!item) return;
    await handleSave();
    setPublishing(true);
    try {
      const res = await fetch('/api/products/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionItemId: item.id }),
      });
      if (res.ok) {
        alert('发布成功！');
        onComplete();
      } else {
        const data = await res.json();
        alert(`发布失败: ${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('Failed to publish:', error);
    } finally {
      setPublishing(false);
    }
  };

  // 删除图片
  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // 设置主图
  const setPrimaryImage = (index: number) => {
    const newImages = [...images];
    const [selected] = newImages.splice(index, 1);
    newImages.unshift(selected);
    setImages(newImages);
  };

  // 利润率颜色
  const getProfitRateColor = (rate: number) => {
    if (rate < 10) return 'text-red-500';
    if (rate < 20) return 'text-yellow-500';
    return 'text-green-500';
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="line-clamp-1 flex-1">{title || item.signal.productTitle}</span>
            <Badge variant="outline">{item.signal.sourceType === 'ozon_market' ? 'OZON' : item.signal.sourceType?.toUpperCase() || '-'}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="mt-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="description">描述</TabsTrigger>
            <TabsTrigger value="images">图片</TabsTrigger>
            <TabsTrigger value="price">价格</TabsTrigger>
            <TabsTrigger value="preview">预览</TabsTrigger>
          </TabsList>

          {/* 基本信息 */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">商品标题</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入商品标题"
              />
              <p className="text-xs text-muted-foreground">
                {title.length} / 200 字符
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateTitle}
                disabled={isGeneratingTitle || !title}
                className="w-full"
              >
                {isGeneratingTitle ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI生成标题
                  </>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>平台商品ID</Label>
                <Input value={item.signal.productId} disabled />
              </div>
              <div className="space-y-2">
                <Label>类目</Label>
                <Input value={item.signal.categoryName || item.signal.categoryPath || '-'} disabled />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>销量</Label>
                <Input value={item.signal.salesVolume?.toLocaleString() || '-'} disabled />
              </div>
              <div className="space-y-2">
                <Label>评分</Label>
                <Input value={item.signal.rating ? `⭐ ${item.signal.rating}` : '-'} disabled />
              </div>
              <div className="space-y-2">
                <Label>评论数</Label>
                <Input value={item.signal.reviewsCount?.toLocaleString() || '-'} disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label>卖家</Label>
              <Input value={item.signal.sellerName || '-'} disabled />
            </div>
          </TabsContent>

          {/* 描述 */}
          <TabsContent value="description" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="description">商品描述</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="输入商品描述"
                className="min-h-[300px]"
              />
              <p className="text-xs text-muted-foreground">
                {description.length} 字符
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDesc || !title}
                className="w-full"
              >
                {isGeneratingDesc ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI生成描述
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTranslate('description')}
                disabled={isTranslating || !description}
                className="w-full mt-2"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    翻译中...
                  </>
                ) : (
                  <>
                    <Languages className="mr-2 h-4 w-4" />
                    翻译为俄语
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* 图片 */}
          <TabsContent value="images" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>商品图片（拖拽排序，最多15张）</Label>
              <div className="grid grid-cols-5 gap-4">
                {images.map((url, index) => (
                  <div
                    key={index}
                    className={cn(
                      'relative group rounded-lg overflow-hidden border-2',
                      index === 0 ? 'border-blue-500' : 'border-transparent'
                    )}
                  >
                    <img
                      src={url}
                      alt={`图片 ${index + 1}`}
                      className="w-full aspect-square object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {index === 0 && (
                      <Badge className="absolute top-1 left-1 bg-blue-500">主图</Badge>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPrimaryImage(index)}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                已上传 {images.length} / 15 张图片
              </p>
            </div>
          </TabsContent>

          {/* 价格 */}
          <TabsContent value="price" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="price">售价 (₽)</Label>
              <Input
                id="price"
                type="number"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              />
            </div>

            <Separator />

            {/* 利润计算器 */}
            <Collapsible open={profitOpen} onOpenChange={setProfitOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    利润计算器
                  </span>
                  {profitOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchaseCost">采购成本 (¥)</Label>
                    <Input
                      id="purchaseCost"
                      type="number"
                      value={purchaseCost}
                      onChange={(e) => setPurchaseCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingCost">运费 (¥)</Label>
                    <Input
                      id="shippingCost"
                      type="number"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exchangeRate">汇率 (₽ → ¥)</Label>
                  <Input
                    id="exchangeRate"
                    type="number"
                    step="0.001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    placeholder="0.08"
                  />
                </div>
                <Button onClick={calculateProfit} disabled={calculating || !price || !purchaseCost}>
                  {calculating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  计算利润
                </Button>

                {profitResult && (
                  <Card className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-sm text-muted-foreground">预计利润</p>
                        <p className="text-2xl font-bold text-green-600">
                          ¥{profitResult.profit.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-muted-foreground">利润率</p>
                        <p className={cn('text-2xl font-bold', getProfitRateColor(profitResult.profitRate))}>
                          {profitResult.profitRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">售价</span>
                        <span>₽{price.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ozon佣金 ({profitResult.breakdown.commissionRate}%)</span>
                        <span>₽{profitResult.breakdown.ozonCommission.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">物流费估算</span>
                        <span>¥{profitResult.breakdown.logisticsCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">汇率</span>
                        <span>{profitResult.breakdown.exchangeRate}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>ROI</span>
                        <span>{profitResult.roi.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground text-xs">
                        <span>建议售价（30%利润率）</span>
                        <span>₽{profitResult.suggestedPrice.toFixed(0)}</span>
                      </div>
                    </div>

                    {profitResult.profitRate < 10 && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        利润率较低，建议调整采购成本或提高售价
                      </div>
                    )}
                  </Card>
                )}
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          {/* 预览 */}
          <TabsContent value="preview" className="space-y-4 mt-4">
            <Card className="p-4">
              <div className="flex gap-6">
                {/* 图片 */}
                <div className="w-48 flex-shrink-0">
                  {images.length > 0 && (
                    <img
                      src={images[0]}
                      alt={title}
                      className="w-full aspect-square object-cover rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                {/* 信息 */}
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold line-clamp-2">{title}</h3>
                  <p className="text-2xl font-bold text-blue-600">
                    ₽{price.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>销量: {item.signal.salesVolume?.toLocaleString() || 0}</span>
                    {item.signal.rating && <span>⭐ {item.signal.rating}</span>}
                  </div>
                  {profitResult && (
                    <div className="flex items-center gap-4 mt-4">
                      <Badge variant="outline">利润: ¥{profitResult.profit.toFixed(2)}</Badge>
                      <Badge variant="outline" className={getProfitRateColor(profitResult.profitRate)}>
                        利润率: {profitResult.profitRate.toFixed(1)}%
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存
          </Button>
          <Button onClick={handleSaveAndPublish} disabled={saving || publishing}>
            {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存并发布
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
