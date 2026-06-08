'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Sparkles,
  Upload,
  Image,
  Plus,
  Trash2,
  CheckCircle,
  Eye,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  { id: 'basic', label: '基本信息' },
  { id: 'attributes', label: '属性编辑' },
  { id: 'variants', label: '变体管理' },
  { id: 'images', label: '图片管理' },
  { id: 'preview', label: '预览提交' },
];

export default function ProductCardEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const isNew = params.id === 'new';
  const opportunityId = searchParams.get('opportunityId');

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: '',
    source1688Url: '',
    referencePrice: '',
    attributes: {} as Record<string, string>,
    variants: [] as any[],
    images: [] as any[],
  });

  // Category tree (mock)
  const categories = [
    { id: '100', name: '服装配饰', children: [
      { id: '101', name: '女装' },
      { id: '102', name: '男装' },
    ]},
    { id: '200', name: '电子产品', children: [
      { id: '201', name: '手机配件' },
      { id: '202', name: '智能设备' },
    ]},
    { id: '300', name: '家居用品', children: [
      { id: '301', name: '厨房用品' },
      { id: '302', name: '收纳整理' },
    ]},
  ];

  // Attributes for selected category (mock)
  const categoryAttributes = [
    { id: 'brand', name: '品牌', type: 'text', required: true },
    { id: 'material', name: '材质', type: 'select', options: ['棉', '涤纶', '尼龙', '羽绒'], required: true },
    { id: 'color', name: '颜色', type: 'multiselect', options: ['黑色', '白色', '红色', '蓝色', '绿色'] },
    { id: 'size', name: '尺码', type: 'multiselect', options: ['S', 'M', 'L', 'XL', 'XXL'] },
    { id: 'weight', name: '重量(kg)', type: 'number' },
    { id: 'origin', name: '产地', type: 'select', options: ['中国', '俄罗斯', '土耳其'] },
  ];

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      // TODO: Save to API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // TODO: Submit to API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setSaving(false);
    }
  };

  const addVariant = () => {
    setFormData({
      ...formData,
      variants: [...formData.variants, {
        id: Date.now(),
        color: '',
        size: '',
        skuCode: '',
        price: '',
        stock: 0,
        images: 0,
      }],
    });
  };

  const updateVariant = (id: number, field: string, value: any) => {
    setFormData({
      ...formData,
      variants: formData.variants.map(v => 
        v.id === id ? { ...v, [field]: value } : v
      ),
    });
  };

  const removeVariant = (id: number) => {
    setFormData({
      ...formData,
      variants: formData.variants.filter(v => v.id !== id),
    });
  };

  return (
    <AppLayout 
      title={isNew ? '新建商品卡' : '编辑商品卡'} 
      subtitle="商品信息编辑"
    >
      <div className="max-w-5xl mx-auto">
        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div 
                key={step.id}
                className="flex items-center"
              >
                <button
                  onClick={() => index <= currentStep && setCurrentStep(index)}
                  disabled={index > currentStep}
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full font-medium transition-colors',
                    index < currentStep && 'bg-green-500 text-white',
                    index === currentStep && 'bg-[#2F6BFF] text-white',
                    index > currentStep && 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  {index < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </button>
                <span className={cn(
                  'ml-2 text-sm',
                  index === currentStep ? 'font-medium' : 'text-muted-foreground'
                )}>
                  {step.label}
                </span>
                {index < steps.length - 1 && (
                  <div className={cn(
                    'w-20 h-0.5 mx-4',
                    index < currentStep ? 'bg-green-500' : 'bg-muted'
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="mb-6">
          <CardContent className="p-6">
            {/* Step 1: Basic Info */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>标题 *</Label>
                    <Button variant="outline" size="sm">
                      <Sparkles className="w-4 h-4 mr-2" />
                      AI生成
                    </Button>
                  </div>
                  <Input 
                    placeholder="输入商品标题..."
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>描述</Label>
                    <Button variant="outline" size="sm">
                      <Sparkles className="w-4 h-4 mr-2" />
                      AI生成
                    </Button>
                  </div>
                  <Textarea 
                    placeholder="输入商品描述..."
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div>
                  <Label>Ozon 类目 *</Label>
                  <Select value={formData.categoryId} onValueChange={(v) => setFormData({...formData, categoryId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择类目" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <div key={cat.id}>
                          <SelectItem value={cat.id}>{cat.name}</SelectItem>
                          {cat.children?.map(child => (
                            <SelectItem key={child.id} value={child.id}>
                              └─ {child.name}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>来源1688链接</Label>
                  <Input 
                    placeholder="https://..."
                    value={formData.source1688Url}
                    onChange={(e) => setFormData({...formData, source1688Url: e.target.value})}
                  />
                </div>

                <div>
                  <Label>参考价格 (₽)</Label>
                  <Input 
                    type="number"
                    placeholder="输入参考价格..."
                    value={formData.referencePrice}
                    onChange={(e) => setFormData({...formData, referencePrice: e.target.value})}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Attributes */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">类目属性</h3>
                  <Button variant="outline" size="sm">
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI智能填充
                  </Button>
                </div>

                {categoryAttributes.map(attr => (
                  <div key={attr.id}>
                    <Label className="flex items-center gap-2">
                      {attr.name}
                      {attr.required && <span className="text-red-500">*</span>}
                    </Label>
                    
                    {attr.type === 'text' && (
                      <Input 
                        className="mt-1"
                        value={formData.attributes[attr.id] || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          attributes: {...formData.attributes, [attr.id]: e.target.value}
                        })}
                      />
                    )}

                    {attr.type === 'number' && (
                      <Input 
                        type="number"
                        className="mt-1"
                        value={formData.attributes[attr.id] || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          attributes: {...formData.attributes, [attr.id]: e.target.value}
                        })}
                      />
                    )}

                    {attr.type === 'select' && (
                      <Select 
                        value={formData.attributes[attr.id] || ''} 
                        onValueChange={(v) => setFormData({
                          ...formData,
                          attributes: {...formData.attributes, [attr.id]: v}
                        })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={`选择${attr.name}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {attr.options?.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {attr.type === 'multiselect' && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {attr.options?.map(opt => (
                          <Badge
                            key={opt}
                            variant={formData.attributes[attr.id]?.includes(opt) ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => {
                              const current = formData.attributes[attr.id]?.split(',') || [];
                              const updated = current.includes(opt)
                                ? current.filter(c => c !== opt)
                                : [...current, opt];
                              setFormData({
                                ...formData,
                                attributes: {...formData.attributes, [attr.id]: updated.join(',')}
                              });
                            }}
                          >
                            {opt}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Step 3: Variants */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">SKU 变体</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      批量设置
                    </Button>
                    <Button size="sm" onClick={addVariant}>
                      <Plus className="w-4 h-4 mr-2" />
                      添加变体
                    </Button>
                  </div>
                </div>

                {formData.variants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无变体，点击"添加变体"创建
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="p-3 text-left text-sm">颜色</th>
                          <th className="p-3 text-left text-sm">尺码</th>
                          <th className="p-3 text-left text-sm">SKU编码</th>
                          <th className="p-3 text-left text-sm">价格(₽)</th>
                          <th className="p-3 text-left text-sm">库存</th>
                          <th className="p-3 text-left text-sm">图片</th>
                          <th className="p-3 text-left text-sm">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.variants.map(v => (
                          <tr key={v.id} className="border-b">
                            <td className="p-3">
                              <Input 
                                value={v.color}
                                onChange={(e) => updateVariant(v.id, 'color', e.target.value)}
                                className="w-20"
                              />
                            </td>
                            <td className="p-3">
                              <Input 
                                value={v.size}
                                onChange={(e) => updateVariant(v.id, 'size', e.target.value)}
                                className="w-16"
                              />
                            </td>
                            <td className="p-3">
                              <Input 
                                value={v.skuCode}
                                onChange={(e) => updateVariant(v.id, 'skuCode', e.target.value)}
                                className="w-24"
                              />
                            </td>
                            <td className="p-3">
                              <Input 
                                type="number"
                                value={v.price}
                                onChange={(e) => updateVariant(v.id, 'price', e.target.value)}
                                className="w-20"
                              />
                            </td>
                            <td className="p-3">
                              <Input 
                                type="number"
                                value={v.stock}
                                onChange={(e) => updateVariant(v.id, 'stock', Number(e.target.value))}
                                className="w-16"
                              />
                            </td>
                            <td className="p-3">
                              <Badge variant="outline">{v.images}</Badge>
                            </td>
                            <td className="p-3">
                              <Button variant="ghost" size="sm" onClick={() => removeVariant(v.id)}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Color x Size Matrix Preview */}
                <div>
                  <h4 className="font-medium mb-3">变体矩阵预览</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {['S', 'M', 'L', 'XL', 'XXL'].map(size => (
                      <div key={size} className="text-center">
                        <div className="font-medium mb-2">{size}</div>
                        {['黑色', '白色'].map(color => (
                          <div 
                            key={`${color}-${size}`}
                            className={cn(
                              'p-2 text-xs mb-1 rounded',
                              formData.variants.some(v => v.color === color && v.size === size)
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-50 text-red-500'
                            )}
                          >
                            {color}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Images */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">商品图片</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      从修图工作台选择
                    </Button>
                    <Button variant="outline" size="sm">
                      <Upload className="w-4 h-4 mr-2" />
                      上传图片
                    </Button>
                  </div>
                </div>

                {formData.images.length === 0 ? (
                  <div className="border-2 border-dashed rounded-lg p-12 text-center">
                    <Image className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">暂无图片</p>
                    <Button variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      上传图片
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    {formData.images.map((img, i) => (
                      <div key={i} className="aspect-square bg-muted rounded-lg relative group">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Image className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div className="absolute bottom-2 left-2 right-2 flex justify-between">
                          <Badge variant="outline" className="text-xs">主图</Badge>
                          <Badge className="bg-green-500 text-xs">合规</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Preview */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <h3 className="font-medium">提交预览</h3>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">基本信息</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">标题</span>
                        <span>{formData.title || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">类目</span>
                        <span>{formData.categoryId || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">参考价格</span>
                        <span>₽{formData.referencePrice || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">统计信息</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">属性数量</span>
                        <span>{Object.keys(formData.attributes).length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">变体数量</span>
                        <span>{formData.variants.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">图片数量</span>
                        <span>{formData.images.length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ 提交后商品将进入Ozon审核流程，审核周期约1-3个工作日
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            保存草稿
          </Button>

          <div className="flex gap-3">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrev}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                上一步
              </Button>
            )}
            
            {currentStep < steps.length - 1 ? (
              <Button onClick={handleNext}>
                下一步
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={saving}>
                <Send className="w-4 h-4 mr-2" />
                提交上架
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
