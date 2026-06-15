'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Plus,
  Trash2,
  CheckCircle,
  Eye,
  Send,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  { id: 'basic', label: '基本信息' },
  { id: 'attributes', label: '属性编辑' },
  { id: 'variants', label: '变体管理' },
  { id: 'images', label: '图片管理' },
  { id: 'preview', label: '预览提交' },
];

interface Category {
  category_id: number;
  category_name: string;
  children?: Category[];
  disabled?: boolean;
}

interface CategoryAttribute {
  attribute_id: number;
  attribute_name: string;
  description?: string;
  type: string;
  required: boolean;
  dictionary?: { id: number; value: string }[];
}

interface Shop {
  id: string;
  name: string;
}

interface LogisticsTemplate {
  id: number;
  name: string;
  type: string;
}

export default function ProductCardEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isNew = params.id === 'new';
  const opportunityId = searchParams.get('opportunityId');
  const cardId = params.id as string;

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingAttributes, setLoadingAttributes] = useState(false);

  // Category tree
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<number[]>([]);

  // Category attributes
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttribute[]>([]);

  // Shops and logistics
  const [shops, setShops] = useState<Shop[]>([]);
  const [logisticsTemplates, setLogisticsTemplates] = useState<LogisticsTemplate[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: '',
    categoryName: '',
    source1688Url: '',
    referencePrice: '',
    attributes: {} as Record<string, string | string[]>,
    variants: [] as {
      id: number;
      color: string;
      size: string;
      skuCode: string;
      price: string;
      stock: number;
      images: number;
    }[],
    images: [] as {
      id: number;
      url: string;
      type: string;
      status: string;
    }[],
    selectedShopId: '',
    logisticsTemplateId: '',
    needEac: false,
    notes: '',
  });

  // Load categories on mount
  useEffect(() => {
    loadCategories();
    loadShops();
  }, []);

  // Load attributes when category changes
  useEffect(() => {
    if (formData.categoryId) {
      loadCategoryAttributes(Number(formData.categoryId));
    }
  }, [formData.categoryId]);

  // Load product card data if editing
  useEffect(() => {
    if (!isNew && cardId) {
      loadProductCard(cardId);
    }
  }, [isNew, cardId]);

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch('/api/selection/categories/tree');
      const data = await res.json();
      if (data.success && data.data) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadCategoryAttributes = async (categoryId: number) => {
    setLoadingAttributes(true);
    try {
      const res = await fetch(`/api/selection/categories/${categoryId}/attributes`);
      const data = await res.json();
      if (data.success && data.data) {
        setCategoryAttributes(data.data);
      }
    } catch (error) {
      console.error('Failed to load attributes:', error);
      // Fallback mock data
      setCategoryAttributes([
        { attribute_id: 1, attribute_name: '品牌', type: 'text', required: true },
        { attribute_id: 2, attribute_name: '材质', type: 'select', required: true, dictionary: [{ id: 1, value: '棉' }, { id: 2, value: '涤纶' }, { id: 3, value: '尼龙' }] },
        { attribute_id: 3, attribute_name: '颜色', type: 'multiselect', required: false, dictionary: [{ id: 1, value: '黑色' }, { id: 2, value: '白色' }, { id: 3, value: '红色' }] },
        { attribute_id: 4, attribute_name: '尺码', type: 'multiselect', required: false, dictionary: [{ id: 1, value: 'S' }, { id: 2, value: 'M' }, { id: 3, value: 'L' }, { id: 4, value: 'XL' }] },
        { attribute_id: 5, attribute_name: '重量(kg)', type: 'number', required: false },
      ]);
    } finally {
      setLoadingAttributes(false);
    }
  };

  const loadShops = async () => {
    try {
      const res = await fetch('/api/shops');
      const data = await res.json();
      if (data.success && data.data) {
        setShops(data.data);
        if (data.data.length > 0) {
          setFormData(prev => ({ ...prev, selectedShopId: data.data[0].id }));
        }
      }
    } catch (error) {
      console.error('Failed to load shops:', error);
      // Fallback
      setShops([{ id: '1', name: 'TIANTAN' }]);
      setFormData(prev => ({ ...prev, selectedShopId: '1' }));
    }
  };

  const loadLogisticsTemplates = async (shopId: string) => {
    try {
      const res = await fetch(`/api/image-listing/logistics/templates?shopId=${shopId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setLogisticsTemplates(data.data);
      }
    } catch (error) {
      console.error('Failed to load logistics templates:', error);
    }
  };

  const loadProductCard = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/selection/product-cards/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        const card = data.data;
        setFormData({
          title: card.title_ru || card.title_zh || '',
          description: card.description_ru || '',
          categoryId: String(card.ozon_category_id || ''),
          categoryName: card.ozon_category_name || '',
          source1688Url: card.source_1688_url || '',
          referencePrice: String(card.suggested_price || ''),
          attributes: card.attributes || {},
          variants: [],
          images: [],
          selectedShopId: card.shop_id || '',
          logisticsTemplateId: '',
          needEac: card.is_eac_required || false,
          notes: '',
        });

        // Load variants
        const variantsRes = await fetch(`/api/selection/product-cards/${id}/variants`);
        const variantsData = await variantsRes.json();
        if (variantsData.success && variantsData.data) {
          setFormData(prev => ({ ...prev, variants: variantsData.data }));
        }
      }
    } catch (error) {
      console.error('Failed to load product card:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        categoryId: Number(formData.categoryId),
        source1688Url: formData.source1688Url,
        referencePrice: Number(formData.referencePrice),
        attributes: formData.attributes,
        shopId: formData.selectedShopId,
        opportunityId: opportunityId,
      };

      if (isNew) {
        const res = await fetch('/api/selection/product-cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success && data.data?.id) {
          router.push(`/selection/editor/${data.data.id}`);
        }
      } else {
        await fetch(`/api/selection/product-cards/${cardId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      handleSaveDraft();
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
      // Create listing task
      const res = await fetch('/api/image-listing/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCardId: cardId,
          shopId: formData.selectedShopId,
          logisticsTemplateId: Number(formData.logisticsTemplateId),
          needEac: formData.needEac,
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        // Submit to Ozon
        await fetch(`/api/image-listing/listings/${data.data.id}/submit`, {
          method: 'POST',
        });
        router.push('/image-listing/listing');
      }
    } catch (error) {
      console.error('Failed to submit:', error);
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
        price: formData.referencePrice,
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

  const generateVariantsFromAttributes = () => {
    const colors = (formData.attributes['3'] as string[]) || [];
    const sizes = (formData.attributes['4'] as string[]) || [];
    
    if (colors.length === 0 || sizes.length === 0) {
      return;
    }

    const newVariants: typeof formData.variants = [];
    colors.forEach(color => {
      sizes.forEach(size => {
        if (!formData.variants.some(v => v.color === color && v.size === size)) {
          newVariants.push({
            id: Date.now() + Math.random() * 1000,
            color,
            size,
            skuCode: '',
            price: formData.referencePrice,
            stock: 0,
            images: 0,
          });
        }
      });
    });

    setFormData({
      ...formData,
      variants: [...formData.variants, ...newVariants],
    });
  };

  // Category tree rendering
  const renderCategoryTree = (cats: Category[], level = 0) => {
    return cats.map(cat => (
      <div key={cat.category_id}>
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted rounded',
            formData.categoryId === String(cat.category_id) && 'bg-primary/10 text-primary'
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => {
            if (!cat.disabled && !cat.children?.length) {
              setFormData({
                ...formData,
                categoryId: String(cat.category_id),
                categoryName: cat.category_name,
              });
            } else if (cat.children?.length) {
              setExpandedCategories(
                expandedCategories.includes(cat.category_id)
                  ? expandedCategories.filter(id => id !== cat.category_id)
                  : [...expandedCategories, cat.category_id]
              );
            }
          }}
        >
          {cat.children && cat.children.length > 0 && (
            <ChevronRight className={cn(
              'w-4 h-4 transition-transform',
              expandedCategories.includes(cat.category_id) && 'rotate-90'
            )} />
          )}
          <span className={cat.disabled ? 'text-muted-foreground' : ''}>
            {cat.category_name}
          </span>
          {cat.disabled && <Badge variant="outline" className="text-xs">禁用</Badge>}
        </div>
        {cat.children && expandedCategories.includes(cat.category_id) && (
          renderCategoryTree(cat.children, level + 1)
        )}
      </div>
    ));
  };

  // Get unique colors and sizes for matrix
  const colors = [...new Set(formData.variants.map(v => v.color).filter(Boolean))];
  const sizes = [...new Set(formData.variants.map(v => v.size).filter(Boolean))];

  return (
    <AppLayout 
      title={isNew ? '新建商品卡' : '编辑商品卡'} 
      subtitle="商品信息编辑"
    >
      <div className="max-w-6xl mx-auto">
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
                    index < currentStep && 'bg-green-500 text-white cursor-pointer',
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

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Step Content */}
            <Card className="mb-6">
              <CardContent className="p-6">
                {/* Step 1: Basic Info */}
                {currentStep === 0 && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>标题 *</Label>
                        <Button variant="outline" size="sm" disabled>
                          <Sparkles className="w-4 h-4 mr-2" />
                          AI生成
                        </Button>
                      </div>
                      <Input 
                        placeholder="输入商品标题（俄语）..."
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>描述</Label>
                        <Button variant="outline" size="sm" disabled>
                          <Sparkles className="w-4 h-4 mr-2" />
                          AI生成
                        </Button>
                      </div>
                      <Textarea 
                        placeholder="输入商品描述（俄语）..."
                        rows={4}
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                      />
                    </div>

                    <div>
                      <Label>Ozon 类目 *</Label>
                      <div className="flex gap-4 mt-2">
                        <div className="flex-1 border rounded-lg max-h-64 overflow-auto">
                          {loadingCategories ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                          ) : categories.length > 0 ? (
                            renderCategoryTree(categories)
                          ) : (
                            <div className="p-4 text-muted-foreground text-center">
                              暂无类目数据
                            </div>
                          )}
                        </div>
                        {formData.categoryId && (
                          <div className="w-64 p-4 bg-muted/30 rounded-lg">
                            <h4 className="font-medium mb-2">已选择</h4>
                            <Badge variant="secondary">{formData.categoryName}</Badge>
                            <p className="text-xs text-muted-foreground mt-2">
                              ID: {formData.categoryId}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>来源1688链接</Label>
                      <Input 
                        placeholder="https://detail.1688.com/offer/..."
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
                      <Button variant="outline" size="sm" disabled>
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI智能填充
                      </Button>
                    </div>

                    {loadingAttributes ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : !formData.categoryId ? (
                      <div className="text-center py-8 text-muted-foreground">
                        请先在"基本信息"步骤选择类目
                      </div>
                    ) : categoryAttributes.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        该类目暂无属性定义
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-6">
                        {categoryAttributes.map(attr => (
                          <div key={attr.attribute_id}>
                            <Label className="flex items-center gap-2">
                              {attr.attribute_name}
                              {attr.required && <span className="text-red-500">*</span>}
                              {attr.description && (
                                <span className="text-xs text-muted-foreground">
                                  ({attr.description})
                                </span>
                              )}
                            </Label>
                            
                            {attr.type === 'text' && (
                              <Input 
                                className="mt-1"
                                value={(formData.attributes[attr.attribute_id] as string) || ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  attributes: {...formData.attributes, [attr.attribute_id]: e.target.value}
                                })}
                              />
                            )}

                            {attr.type === 'number' && (
                              <Input 
                                type="number"
                                className="mt-1"
                                value={(formData.attributes[attr.attribute_id] as string) || ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  attributes: {...formData.attributes, [attr.attribute_id]: e.target.value}
                                })}
                              />
                            )}

                            {(attr.type === 'select' || attr.dictionary) && !attr.type?.includes('multi') && (
                              <Select 
                                value={(formData.attributes[attr.attribute_id] as string) || ''} 
                                onValueChange={(v) => setFormData({
                                  ...formData,
                                  attributes: {...formData.attributes, [attr.attribute_id]: v}
                                })}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder={`选择${attr.attribute_name}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {attr.dictionary?.filter(opt => opt.value).map(opt => (
                                    <SelectItem key={opt.id} value={opt.value}>{opt.value}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {attr.type === 'multiselect' && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {attr.dictionary?.map(opt => {
                                  const selected = (formData.attributes[attr.attribute_id] as string[]) || [];
                                  return (
                                    <Badge
                                      key={opt.id}
                                      variant={selected.includes(opt.value) ? 'default' : 'outline'}
                                      className="cursor-pointer"
                                      onClick={() => {
                                        const updated = selected.includes(opt.value)
                                          ? selected.filter(v => v !== opt.value)
                                          : [...selected, opt.value];
                                        setFormData({
                                          ...formData,
                                          attributes: {...formData.attributes, [attr.attribute_id]: updated}
                                        });
                                      }}
                                    >
                                      {opt.value}
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Variants */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">SKU 变体</h3>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={generateVariantsFromAttributes}>
                          从属性生成
                        </Button>
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
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                        <p>暂无变体</p>
                        <p className="text-sm">点击"从属性生成"或"添加变体"创建</p>
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="p-3 text-left text-sm font-medium">颜色</th>
                              <th className="p-3 text-left text-sm font-medium">尺码</th>
                              <th className="p-3 text-left text-sm font-medium">SKU编码</th>
                              <th className="p-3 text-left text-sm font-medium">价格(₽)</th>
                              <th className="p-3 text-left text-sm font-medium">库存</th>
                              <th className="p-3 text-left text-sm font-medium">图片</th>
                              <th className="p-3 text-left text-sm font-medium">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.variants.map(v => (
                              <tr key={v.id} className="border-b hover:bg-muted/30">
                                <td className="p-3">
                                  <Input 
                                    value={v.color}
                                    onChange={(e) => updateVariant(v.id, 'color', e.target.value)}
                                    className="w-24"
                                  />
                                </td>
                                <td className="p-3">
                                  <Input 
                                    value={v.size}
                                    onChange={(e) => updateVariant(v.id, 'size', e.target.value)}
                                    className="w-20"
                                  />
                                </td>
                                <td className="p-3">
                                  <Input 
                                    value={v.skuCode}
                                    onChange={(e) => updateVariant(v.id, 'skuCode', e.target.value)}
                                    className="w-32"
                                    placeholder="自动生成"
                                  />
                                </td>
                                <td className="p-3">
                                  <Input 
                                    type="number"
                                    value={v.price}
                                    onChange={(e) => updateVariant(v.id, 'price', e.target.value)}
                                    className="w-24"
                                  />
                                </td>
                                <td className="p-3">
                                  <Input 
                                    type="number"
                                    value={v.stock}
                                    onChange={(e) => updateVariant(v.id, 'stock', Number(e.target.value))}
                                    className="w-20"
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
                    {colors.length > 0 && sizes.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">变体矩阵预览</h4>
                        <div className="overflow-auto">
                          <table className="border-collapse">
                            <thead>
                              <tr>
                                <th className="p-2 border bg-muted/30"></th>
                                {sizes.map(size => (
                                  <th key={size} className="p-2 border bg-muted/30 font-medium">{size}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {colors.map(color => (
                                <tr key={color}>
                                  <td className="p-2 border bg-muted/30 font-medium">{color}</td>
                                  {sizes.map(size => {
                                    const exists = formData.variants.some(v => v.color === color && v.size === size);
                                    return (
                                      <td 
                                        key={`${color}-${size}`}
                                        className={cn(
                                          'p-2 border text-center text-xs',
                                          exists ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'
                                        )}
                                      >
                                        {exists ? '✓' : '✗'}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Images */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">商品图片</h3>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              从修图工作台选择
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>选择图片</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-4 gap-4 py-4">
                              {[1,2,3,4,5,6,7,8].map(i => (
                                <div key={i} className="aspect-square bg-muted rounded-lg flex items-center justify-center cursor-pointer hover:ring-2 ring-primary">
                                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                                </div>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button variant="outline" size="sm">
                          <Upload className="w-4 h-4 mr-2" />
                          上传图片
                        </Button>
                      </div>
                    </div>

                    {formData.images.length === 0 ? (
                      <div className="border-2 border-dashed rounded-lg p-12 text-center">
                        <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground mb-4">暂无图片</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          建议上传5-8张图片，包含主图、细节图、场景图
                        </p>
                        <Button variant="outline">
                          <Upload className="w-4 h-4 mr-2" />
                          上传图片
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-4">
                        {formData.images.map((img, i) => (
                          <div key={img.id} className="aspect-square bg-muted rounded-lg relative group">
                            <div className="absolute inset-0 flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <div className="absolute top-2 left-2">
                              <Badge variant={i === 0 ? 'default' : 'outline'} className="text-xs">
                                {i === 0 ? '主图' : `图${i + 1}`}
                              </Badge>
                            </div>
                            <div className="absolute bottom-2 left-2 right-2 flex justify-between">
                              <Badge variant="outline" className="text-xs">{img.type}</Badge>
                              <Badge className={cn(
                                'text-xs',
                                img.status === 'pass' ? 'bg-green-500' : 'bg-yellow-500'
                              )}>
                                {img.status === 'pass' ? '合规' : '待检查'}
                              </Badge>
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="destructive" size="sm" className="h-6 w-6 p-0">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="aspect-square border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary">
                          <Plus className="w-8 h-8 text-muted-foreground" />
                        </div>
                      </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-800 mb-2">图片要求</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• 尺寸：至少 500×500 像素</li>
                        <li>• 格式：JPEG、PNG、WebP</li>
                        <li>• 大小：单张不超过 10MB</li>
                        <li>• 主图建议白底，无水印</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Step 5: Preview */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <h3 className="font-medium">提交预览</h3>
                    
                    <div className="grid grid-cols-2 gap-6">
                      {/* Left: Ozon Preview */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Ozon 前台预览</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
                            <ImageIcon className="w-16 h-16 text-muted-foreground" />
                          </div>
                          <h4 className="font-medium line-clamp-2">{formData.title || '商品标题'}</h4>
                          <p className="text-xl font-bold text-primary mt-2">
                            ₽{formData.referencePrice || '---'}
                          </p>
                          {formData.variants.length > 0 && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {formData.variants.length} 个变体
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Right: Submit Config */}
                      <div className="space-y-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">提交配置</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <Label>目标店铺 *</Label>
                              <Select 
                                value={formData.selectedShopId} 
                                onValueChange={(v) => {
                                  setFormData({...formData, selectedShopId: v});
                                  loadLogisticsTemplates(v);
                                }}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="选择店铺" />
                                </SelectTrigger>
                                <SelectContent>
                                  {shops.map(shop => (
                                    <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label>物流模板 *</Label>
                              <Select 
                                value={formData.logisticsTemplateId} 
                                onValueChange={(v) => setFormData({...formData, logisticsTemplateId: v})}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="选择物流模板" />
                                </SelectTrigger>
                                <SelectContent>
                                  {logisticsTemplates.map(t => (
                                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {logisticsTemplates.length === 0 && formData.selectedShopId && (
                                <Button 
                                  variant="link" 
                                  size="sm" 
                                  className="p-0 h-auto mt-1"
                                  onClick={() => loadLogisticsTemplates(formData.selectedShopId)}
                                >
                                  加载物流模板
                                </Button>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <div>
                                <Label>EAC认证</Label>
                                <p className="text-xs text-muted-foreground">
                                  该商品是否需要EAC认证标识
                                </p>
                              </div>
                              <Switch 
                                checked={formData.needEac}
                                onCheckedChange={(v) => setFormData({...formData, needEac: v})}
                              />
                            </div>

                            <div>
                              <Label>备注</Label>
                              <Textarea 
                                placeholder="内部备注..."
                                rows={2}
                                value={formData.notes}
                                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                              />
                            </div>
                          </CardContent>
                        </Card>

                        {/* Stats */}
                        <Card>
                          <CardContent className="pt-4">
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div>
                                <div className="text-2xl font-bold">{Object.keys(formData.attributes).length}</div>
                                <div className="text-xs text-muted-foreground">属性</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold">{formData.variants.length}</div>
                                <div className="text-xs text-muted-foreground">变体</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold">{formData.images.length}</div>
                                <div className="text-xs text-muted-foreground">图片</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
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
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
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
                  <Button onClick={handleSubmit} disabled={saving || !formData.selectedShopId}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    提交上架
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
