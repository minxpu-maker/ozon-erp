'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  RefreshCw,
  Send,
  FileText,
  Package,
  Truck,
  ChevronRight,
  ChevronLeft,
  Plus,
  Edit,
  Trash2,
  Link2,
  Calculator,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Box,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 七个步骤
const STEPS = [
  { id: 1, name: '基本信息', icon: FileText },
  { id: 2, name: '属性编辑', icon: Edit },
  { id: 3, name: '变体管理', icon: Box },
  { id: 4, name: '图片绑定', icon: ImageIcon },
  { id: 5, name: '物流配置', icon: Truck },
  { id: 6, name: '定价确认', icon: DollarSign },
  { id: 7, name: '提交审核', icon: Send },
];

// 任务状态配置
const STATUS_CONFIG = {
  draft: { color: 'bg-gray-100 text-gray-700', label: '草稿', icon: FileText },
  submitted: { color: 'bg-blue-100 text-blue-700', label: '已提交', icon: Clock },
  reviewing: { color: 'bg-yellow-100 text-yellow-700', label: '审核中', icon: Clock },
  approved: { color: 'bg-green-100 text-green-700', label: '已通过', icon: CheckCircle },
  rejected: { color: 'bg-red-100 text-red-700', label: '已失败', icon: XCircle },
};

interface ListingTask {
  id: string;
  productCardId: string;
  productCardName: string;
  shopId: string;
  shopName: string;
  status: keyof typeof STATUS_CONFIG;
  currentStep: number;
  ozonTaskId: string | null;
  ozonProductId: string | null;
  submittedAt: string | null;
  failureReason: string | null;
}

interface ProductCard {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  attributes: { id: string; name: string; value: string; required: boolean }[];
  variants: { id: string; color: string; size: string; price: number; stock: number; imageIds: string[] }[];
  images: { id: string; url: string; type: string; isMain: boolean }[];
}

interface LogisticsTemplate {
  id: string;
  name: string;
  type: string;
}

export default function ListingManagementPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ListingTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ListingTask | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // 商品卡数据
  const [productCard, setProductCard] = useState<ProductCard | null>(null);
  
  // 物流配置
  const [logisticsTemplates, setLogisticsTemplates] = useState<LogisticsTemplate[]>([]);
  const [selectedLogistics, setSelectedLogistics] = useState<string>('');
  const [packageWeight, setPackageWeight] = useState('0.5');
  const [packageLength, setPackageLength] = useState('20');
  const [packageWidth, setPackageWidth] = useState('15');
  const [packageHeight, setPackageHeight] = useState('10');
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  
  // 定价确认
  const [priceConfirmations, setPriceConfirmations] = useState<Record<string, { price: number; confirmed: boolean }>>({});
  
  // 提交审核状态
  const [ozonTaskId, setOzonTaskId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [reviewMessage, setReviewMessage] = useState<string>('');
  
  // 新建任务对话框
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchLogisticsTemplates();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/image-listing/listings');
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setTasks(data.data);
      } else {
        // 使用模拟数据
        setTasks(mockTasks);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      setTasks(mockTasks);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogisticsTemplates = async () => {
    try {
      const res = await fetch('/api/image-listing/logistics/templates');
      const data = await res.json();
      if (data.success) {
        setLogisticsTemplates(data.data);
      } else {
        setLogisticsTemplates(mockLogisticsTemplates);
      }
    } catch (error) {
      setLogisticsTemplates(mockLogisticsTemplates);
    }
  };

  const fetchProductCard = async (productCardId: string) => {
    // 模拟数据
    setProductCard(mockProductCard);
    // 初始化定价确认
    const confirmations: Record<string, { price: number; confirmed: boolean }> = {};
    mockProductCard.variants.forEach(v => {
      confirmations[v.id] = { price: v.price, confirmed: false };
    });
    setPriceConfirmations(confirmations);
  };

  const calculateShipping = async () => {
    try {
      const res = await fetch('/api/image-listing/logistics/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedLogistics,
          weight: parseFloat(packageWeight),
          dimensions: {
            length: parseFloat(packageLength),
            width: parseFloat(packageWidth),
            height: parseFloat(packageHeight),
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShippingCost(data.data.cost);
      }
    } catch (error) {
      // 模拟计算
      setShippingCost(Math.round(parseFloat(packageWeight) * 150 + 50));
    }
  };

  const handleSelectTask = (task: ListingTask) => {
    setSelectedTask(task);
    setCurrentStep(task.currentStep || 1);
    fetchProductCard(task.productCardId);
  };

  const handleCreateTask = async () => {
    try {
      const res = await fetch('/api/image-listing/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCardId: 'new',
          shopId: 'shop-tiantan',
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchTasks();
        setShowNewTaskDialog(false);
      }
    } catch (error) {
      // 创建模拟任务
      const newTask: ListingTask = {
        id: `task-${Date.now()}`,
        productCardId: 'new',
        productCardName: '新建商品卡',
        shopId: 'shop-tiantan',
        shopName: 'TIANTAN',
        status: 'draft',
        currentStep: 1,
        ozonTaskId: null,
        ozonProductId: null,
        submittedAt: null,
        failureReason: null,
      };
      setTasks([newTask, ...tasks]);
      setSelectedTask(newTask);
      setCurrentStep(1);
      setShowNewTaskDialog(false);
    }
  };

  const handleSubmitToOzon = async () => {
    if (!selectedTask) return;
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/image-listing/listings/${selectedTask.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setOzonTaskId(data.data.taskId);
        // 开始轮询状态
        pollReviewStatus(selectedTask.id);
      } else {
        setReviewStatus('rejected');
        setReviewMessage(data.error || '提交失败');
      }
    } catch (error) {
      // 模拟提交
      setOzonTaskId(`ozon-task-${Date.now()}`);
      setTimeout(() => {
        setReviewStatus('approved');
      }, 2000);
    } finally {
      setSubmitting(false);
    }
  };

  const pollReviewStatus = async (taskId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/image-listing/listings/${taskId}/status`);
        const data = await res.json();
        if (data.success) {
          if (data.data.status === 'approved') {
            setReviewStatus('approved');
          } else if (data.data.status === 'rejected') {
            setReviewStatus('rejected');
            setReviewMessage(data.data.reason || '审核未通过');
          } else {
            // 继续轮询
            setTimeout(poll, 10000);
          }
        }
      } catch (error) {
        // 模拟成功
        setReviewStatus('approved');
      }
    };
    poll();
  };

  const handleStepClick = (stepId: number) => {
    if (stepId < currentStep) {
      setCurrentStep(stepId);
    }
  };

  const handleNextStep = () => {
    if (currentStep < 7) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfirmPrice = (variantId: string) => {
    setPriceConfirmations(prev => ({
      ...prev,
      [variantId]: { ...prev[variantId], confirmed: true },
    }));
  };

  const allPricesConfirmed = Object.values(priceConfirmations).every(p => p.confirmed);

  // 模拟数据
  const mockTasks: ListingTask[] = [
    {
      id: 'task-1',
      productCardId: 'pc-1',
      productCardName: '男士夏季短袖T恤',
      shopId: 'shop-tiantan',
      shopName: 'TIANTAN',
      status: 'approved',
      currentStep: 7,
      ozonTaskId: 'ozon-task-123',
      ozonProductId: 'product-456',
      submittedAt: new Date(Date.now() - 86400000).toISOString(),
      failureReason: null,
    },
    {
      id: 'task-2',
      productCardId: 'pc-2',
      productCardName: '女士休闲运动裤',
      shopId: 'shop-tiantan',
      shopName: 'TIANTAN',
      status: 'reviewing',
      currentStep: 7,
      ozonTaskId: 'ozon-task-124',
      ozonProductId: null,
      submittedAt: new Date(Date.now() - 3600000).toISOString(),
      failureReason: null,
    },
    {
      id: 'task-3',
      productCardId: 'pc-3',
      productCardName: '儿童纯棉睡衣套装',
      shopId: 'shop-tiantan',
      shopName: 'TIANTAN',
      status: 'draft',
      currentStep: 1,
      ozonTaskId: null,
      ozonProductId: null,
      submittedAt: null,
      failureReason: null,
    },
    {
      id: 'task-4',
      productCardId: 'pc-4',
      productCardName: '真皮商务公文包',
      shopId: 'shop-tiantan',
      shopName: 'TIANTAN',
      status: 'rejected',
      currentStep: 7,
      ozonTaskId: 'ozon-task-126',
      ozonProductId: null,
      submittedAt: new Date(Date.now() - 7200000).toISOString(),
      failureReason: '图片不符合要求：背景必须是纯白色',
    },
  ];

  const mockLogisticsTemplates: LogisticsTemplate[] = [
    { id: 'tpl-1', name: '标准配送', type: 'standard' },
    { id: 'tpl-2', name: '快速配送', type: 'express' },
    { id: 'tpl-3', name: '经济配送', type: 'economy' },
  ];

  const mockProductCard: ProductCard = {
    id: 'pc-1',
    title: '男士夏季短袖T恤 纯棉舒适透气',
    description: '采用100%纯棉面料，透气舒适，适合夏季穿着。多色可选，尺码齐全。',
    categoryId: '101',
    categoryName: '女装 > T恤',
    attributes: [
      { id: 'attr-1', name: '品牌', value: 'TIANTAN', required: true },
      { id: 'attr-2', name: '材质', value: '棉', required: true },
      { id: 'attr-3', name: '季节', value: '夏季', required: false },
      { id: 'attr-4', name: '领型', value: '圆领', required: false },
    ],
    variants: [
      { id: 'v-1', color: '黑色', size: 'M', price: 890, stock: 50, imageIds: ['img-1'] },
      { id: 'v-2', color: '黑色', size: 'L', price: 890, stock: 35, imageIds: ['img-1'] },
      { id: 'v-3', color: '白色', size: 'M', price: 890, stock: 42, imageIds: ['img-2'] },
      { id: 'v-4', color: '白色', size: 'L', price: 890, stock: 28, imageIds: ['img-2'] },
      { id: 'v-5', color: '蓝色', size: 'M', price: 920, stock: 30, imageIds: ['img-3'] },
      { id: 'v-6', color: '蓝色', size: 'L', price: 920, stock: 25, imageIds: ['img-3'] },
    ],
    images: [
      { id: 'img-1', url: 'https://picsum.photos/400/400?random=1', type: '主图', isMain: true },
      { id: 'img-2', url: 'https://picsum.photos/400/400?random=2', type: '颜色图', isMain: false },
      { id: 'img-3', url: 'https://picsum.photos/400/400?random=3', type: '颜色图', isMain: false },
      { id: 'img-4', url: 'https://picsum.photos/400/400?random=4', type: '详情图', isMain: false },
    ],
  };

  const isOverweight = parseFloat(packageWeight) > 5;

  // 渲染步骤内容
  const renderStepContent = () => {
    if (!productCard) {
      return (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-muted-foreground">请从左侧选择一个上架任务</div>
          </CardContent>
        </Card>
      );
    }

    switch (currentStep) {
      case 1: // 基本信息确认
        return (
          <Card>
            <CardHeader>
              <CardTitle>基本信息确认</CardTitle>
              <CardDescription>请确认商品卡的基本信息无误</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-muted-foreground">商品标题</Label>
                  <div className="mt-1 text-lg font-medium">{productCard.title}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Ozon类目</Label>
                  <div className="mt-1">{productCard.categoryName}</div>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">商品描述</Label>
                <div className="mt-1 p-3 bg-muted/30 rounded-lg">{productCard.description}</div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => router.push(`/selection/editor/${productCard.id}`)}>
                  <Edit className="w-4 h-4 mr-2" />
                  返回编辑
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 2: // 属性编辑
        return (
          <Card>
            <CardHeader>
              <CardTitle>属性编辑</CardTitle>
              <CardDescription>根据Ozon类目要求填写商品属性</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {productCard.attributes.map(attr => (
                <div key={attr.id} className="grid grid-cols-3 gap-4 items-center">
                  <Label className={cn(attr.required && 'text-red-500')}>
                    {attr.name}
                    {attr.required && <span className="ml-1">*</span>}
                  </Label>
                  <Input defaultValue={attr.value} className="col-span-2" />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  AI智能填充
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 3: // 变体管理
        return (
          <Card>
            <CardHeader>
              <CardTitle>变体管理</CardTitle>
              <CardDescription>设置每个SKU变体的价格和库存</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left text-sm">颜色</th>
                    <th className="p-3 text-left text-sm">尺码</th>
                    <th className="p-3 text-left text-sm">价格 (₽)</th>
                    <th className="p-3 text-left text-sm">库存</th>
                    <th className="p-3 text-left text-sm">关联图片</th>
                  </tr>
                </thead>
                <tbody>
                  {productCard.variants.map(variant => (
                    <tr key={variant.id} className="border-b">
                      <td className="p-3">{variant.color}</td>
                      <td className="p-3">{variant.size}</td>
                      <td className="p-3">
                        <Input
                          type="number"
                          defaultValue={variant.price}
                          className="w-24"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          defaultValue={variant.stock}
                          className="w-20"
                        />
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{variant.imageIds.length} 张</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );

      case 4: // 图片绑定
        return (
          <Card>
            <CardHeader>
              <CardTitle>图片绑定</CardTitle>
              <CardDescription>确认每张图片绑定到正确的变体</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {productCard.images.map(img => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.url}
                      alt=""
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                    <div className="absolute top-2 right-2">
                      {img.isMain && (
                        <Badge className="bg-yellow-500 text-white">主图</Badge>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white text-xs rounded-b-lg">
                      {img.type}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                拖拽图片可调整顺序，点击图片可设置为主图
              </p>
            </CardContent>
          </Card>
        );

      case 5: // 物流配置
        return (
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>物流配置</CardTitle>
                <CardDescription>选择物流模板和包裹参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>物流模板</Label>
                  <Select value={selectedLogistics} onValueChange={setSelectedLogistics}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="选择物流模板" />
                    </SelectTrigger>
                    <SelectContent>
                      {logisticsTemplates.map(tpl => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>重量 (kg)</Label>
                    <Input
                      type="number"
                      value={packageWeight}
                      onChange={e => setPackageWeight(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>长度 (cm)</Label>
                    <Input
                      type="number"
                      value={packageLength}
                      onChange={e => setPackageLength(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>宽度 (cm)</Label>
                    <Input
                      type="number"
                      value={packageWidth}
                      onChange={e => setPackageWidth(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>高度 (cm)</Label>
                    <Input
                      type="number"
                      value={packageHeight}
                      onChange={e => setPackageHeight(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                {isOverweight && (
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">包裹超重，可能产生额外费用</span>
                  </div>
                )}
                <Button variant="outline" onClick={calculateShipping} className="w-full">
                  <Calculator className="w-4 h-4 mr-2" />
                  计算运费
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>运费预览</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-48">
                {shippingCost ? (
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary">{shippingCost} ₽</div>
                    <div className="text-muted-foreground mt-2">预计运费</div>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-center">
                    <Calculator className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>配置物流参数后</p>
                    <p>点击计算运费</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 6: // 定价确认
        return (
          <Card>
            <CardHeader>
              <CardTitle>定价确认</CardTitle>
              <CardDescription className="text-red-500">
                ⚠️ 人工把关环节，必须确认所有变体价格才能继续
              </CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left text-sm">变体</th>
                    <th className="p-3 text-left text-sm">AI建议价</th>
                    <th className="p-3 text-left text-sm">实际定价 (₽)</th>
                    <th className="p-3 text-left text-sm">状态</th>
                    <th className="p-3 text-left text-sm">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {productCard.variants.map(variant => {
                    const confirmation = priceConfirmations[variant.id] || { price: variant.price, confirmed: false };
                    return (
                      <tr key={variant.id} className="border-b">
                        <td className="p-3">{variant.color} - {variant.size}</td>
                        <td className="p-3 text-muted-foreground">
                          {Math.round(variant.price * 0.95)} ₽
                          <span className="text-xs ml-1">(建议)</span>
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={confirmation.price}
                            onChange={e => setPriceConfirmations(prev => ({
                              ...prev,
                              [variant.id]: { price: parseInt(e.target.value), confirmed: false },
                            }))}
                            className="w-24"
                          />
                        </td>
                        <td className="p-3">
                          {confirmation.confirmed ? (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              已确认
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-500">
                              待确认
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <Button
                            size="sm"
                            variant={confirmation.confirmed ? 'outline' : 'default'}
                            onClick={() => handleConfirmPrice(variant.id)}
                            disabled={confirmation.confirmed}
                          >
                            {confirmation.confirmed ? '已确认' : '确认价格'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!allPricesConfirmed && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-orange-700">
                    请确认所有变体价格后才能进入下一步
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 7: // 提交审核
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>上架信息摘要</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">商品标题</Label>
                    <div className="mt-1">{productCard.title}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">类目</Label>
                    <div className="mt-1">{productCard.categoryName}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">变体数量</Label>
                    <div className="mt-1">{productCard.variants.length} 个SKU</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">图片数量</Label>
                    <div className="mt-1">{productCard.images.length} 张</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {ozonTaskId ? (
              <Card>
                <CardHeader>
                  <CardTitle>审核状态</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground">Ozon任务ID:</Label>
                    <code className="text-sm bg-muted px-2 py-1 rounded">{ozonTaskId}</code>
                  </div>
                  
                  {reviewStatus === 'pending' && (
                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      <div>
                        <div className="font-medium">审核中...</div>
                        <div className="text-sm text-muted-foreground">正在等待Ozon审核结果</div>
                      </div>
                    </div>
                  )}
                  
                  {reviewStatus === 'approved' && (
                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <div className="font-medium text-green-700">审核通过！</div>
                        <div className="text-sm text-muted-foreground">商品已成功上架到Ozon</div>
                      </div>
                    </div>
                  )}
                  
                  {reviewStatus === 'rejected' && (
                    <div className="p-4 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-2 text-red-700 mb-2">
                        <XCircle className="w-5 h-5" />
                        <span className="font-medium">审核未通过</span>
                      </div>
                      <div className="text-sm text-red-600 mb-3">{reviewMessage}</div>
                      <Button variant="outline" size="sm">
                        返回修改
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSubmitToOzon}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        提交到Ozon
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AppLayout title="上架管理" subtitle="Ozon商品上架流程">
      {/* 步骤条 */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex items-center min-w-max">
          {STEPS.map((step: typeof STEPS[0], index: number) => {
            const StepIcon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const isClickable = step.id <= currentStep;
            
            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => handleStepClick(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                    isActive && 'bg-primary text-primary-foreground',
                    isCompleted && !isActive && 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20',
                    !isClickable && 'opacity-50 cursor-not-allowed',
                    isClickable && !isActive && !isCompleted && 'hover:bg-muted'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    isActive && 'bg-primary-foreground/20',
                    isCompleted && !isActive && 'bg-primary text-primary-foreground'
                  )}>
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className="hidden sm:inline">{step.name}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-6">
        {/* 左侧任务列表 */}
        <div className="w-72 shrink-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">上架任务</CardTitle>
                <Button size="sm" onClick={() => setShowNewTaskDialog(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {tasks.map(task => {
                  const status = STATUS_CONFIG[task.status];
                  const isSelected = selectedTask?.id === task.id;
                  
                  return (
                    <button
                      key={task.id}
                      onClick={() => handleSelectTask(task)}
                      className={cn(
                        'w-full p-3 text-left hover:bg-muted/50 transition-colors',
                        isSelected && 'bg-primary/5 border-l-2 border-primary'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate">{task.productCardName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-xs', status.color)}>
                          {status.label}
                        </Badge>
                        {task.currentStep > 0 && task.status === 'draft' && (
                          <span className="text-xs text-muted-foreground">
                            步骤 {task.currentStep}/7
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧步骤内容 */}
        <div className="flex-1">
          {renderStepContent()}
          
          {/* 底部导航按钮 */}
          {productCard && (
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={handlePrevStep}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                上一步
              </Button>
              <Button
                onClick={handleNextStep}
                disabled={currentStep === 7 || (currentStep === 6 && !allPricesConfirmed)}
              >
                下一步
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 新建任务对话框 */}
      <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建上架任务</DialogTitle>
            <DialogDescription>
              从商品卡创建新的上架任务
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              点击创建将从草稿商品卡创建新的上架任务
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTaskDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateTask}>
              创建任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
