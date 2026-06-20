'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  RefreshCw,
  Search,
  ImageIcon,
  Package,
  Truck,
  PackageSearch,
  Warehouse,
  Database,
  BarChart3,
  Calculator,
  Eye,
  ShoppingCart,
  FileText,
  X,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers,
  ListOrdered,
  Link2,
  Check,
  AlertCircle,
  Loader2,
  Save,
  Trash2,
  Sparkles,
} from 'lucide-react';

// ============ 类型定义 ============
interface Order {
  id: string;
  ozonOrderId: string;
  ozonPostingNumber: string;
  shopId: string;
  shopName: string;
  status: string;
  erpStatus: string;
  buyerName: string | null;
  recipientCity: string | null;
  totalPrice: string;
  currency: string;
  products: Array<{
    name: string;
    sku: string;
    quantity: number;
    price: string;
    image?: string;
  }>;
  ozonCreatedAt: string | null;
  createdAt: string;
  shipmentDeadline?: string | null;
  // 采购相关字段（可能来自API）
  purchaseInfo?: {
    platform?: 'alibaba' | 'pinduoduo';
    productUrl?: string;
    unitPrice?: number;
    quantity?: number;
    supplierNote?: string;
    trackingNumber?: string;
    isDraft?: boolean;
  };
}

interface AggregatedSku {
  sku: string;
  name: string;
  image?: string;
  totalQuantity: number;
  orders: Order[];
  earliestDeadline: string | null;
}

// 采购表单数据
interface PurchaseFormData {
  platform: 'alibaba' | 'pinduoduo';
  productUrl: string;
  unitPrice: string;
  quantity: string;
  supplierNote: string;
  trackingNumber: string;
}

// 批量录入单条记录
interface BatchTrackingItem {
  id: string;
  rawText: string;
  trackingNumber: string;
  orderId: string | null;
  orderPostingNumber: string | null;
  matched: boolean;
  orderSearchQuery: string;
}

// 状态映射 - 根据Ozon官方API严格定义
const erpStatusMap: Record<string, { label: string; color: string }> = {
  pending_purchase: { label: '待采购', color: 'bg-blue-100 text-blue-700' },  // 已准备发运
  pending_packaging: { label: '待打包', color: 'bg-orange-100 text-orange-700' },  // 等待打包
  pending: { label: '待处理', color: 'bg-gray-100 text-gray-600' },  // 未知状态
  purchasing: { label: '采购中(旧)', color: 'bg-amber-100 text-amber-700' },  // 旧状态
  purchased: { label: '已采购', color: 'bg-green-100 text-green-700' },
  shipped_domestic: { label: '运输中', color: 'bg-purple-100 text-purple-700' },
  received: { label: '已到货', color: 'bg-teal-100 text-teal-700' },
  qc_passed: { label: '验货通过', color: 'bg-teal-100 text-teal-700' },
  packing: { label: '打包中', color: 'bg-purple-100 text-purple-700' },
  pending_inspect: { label: '待验货', color: 'bg-blue-100 text-blue-700' },
  pending_pack: { label: '待打包', color: 'bg-purple-100 text-purple-700' },
  shipped: { label: '已发货', color: 'bg-gray-100 text-gray-600' },
  delivered: { label: '已完成', color: 'bg-gray-100 text-gray-600' },
  settled: { label: '已结算', color: 'bg-gray-100 text-gray-500' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700' },
};

const ozonStatusMap: Record<string, { label: string; color: string }> = {
  awaiting_packaging: { label: '待打包', color: 'bg-blue-100 text-blue-700' },
  awaiting_deliver: { label: '待发货', color: 'bg-yellow-100 text-yellow-700' },
  delivering: { label: '配送中', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: '已送达', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700' },
};

// ============ 工具函数 ============
function ProductImage({ src, className = '' }: { src: string; className?: string }) {
  const [error, setError] = useState(false);
  if (error || !src) {
    return (
      <div className={`w-12 h-12 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 ${className}`}>
        <ImageIcon className="w-5 h-5 text-gray-400" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="商品"
      className={`w-12 h-12 rounded object-cover flex-shrink-0 ${className}`}
      onError={() => setError(true)}
    />
  );
}

function getDeadlineDisplay(deadline: string | null | undefined) {
  if (!deadline) return null;
  const deadlineTime = new Date(deadline).getTime();
  const now = Date.now();
  const diff = deadlineTime - now;

  if (diff < 0) {
    return { text: '已超时', color: 'text-red-600 font-bold', urgent: true };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (hours < 12) {
    return { text: `${hours}h`, color: 'text-red-600 font-bold', urgent: true };
  }
  if (hours < 48) {
    return { text: `${hours}h`, color: 'text-yellow-600 font-semibold', urgent: false };
  }
  if (days > 0) {
    return { text: `${days}d ${remainingHours}h`, color: 'text-green-600', urgent: false };
  }
  return { text: `${hours}h`, color: 'text-green-600', urgent: false };
}

function formatCNY(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '¥0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '¥0.00';
  return `¥${num.toFixed(2)}`;
}

function aggregateBySku(orders: Order[]): AggregatedSku[] {
  const skuMap = new Map<string, AggregatedSku>();

  orders.forEach(order => {
    const products = order.products || [];
    products.forEach(product => {
      const sku = product.sku || 'unknown';
      const existing = skuMap.get(sku);
      if (existing) {
        existing.totalQuantity += product.quantity;
        existing.orders.push(order);
        if (order.shipmentDeadline) {
          if (!existing.earliestDeadline || order.shipmentDeadline < existing.earliestDeadline) {
            existing.earliestDeadline = order.shipmentDeadline;
          }
        }
      } else {
        skuMap.set(sku, {
          sku,
          name: product.name || '-',
          image: product.image,
          totalQuantity: product.quantity,
          orders: [order],
          earliestDeadline: order.shipmentDeadline || null,
        });
      }
    });
  });

  return Array.from(skuMap.values()).sort((a, b) => {
    if (!a.earliestDeadline) return 1;
    if (!b.earliestDeadline) return -1;
    return a.earliestDeadline.localeCompare(b.earliestDeadline);
  });
}

// ============ 主组件 ============
export default function PurchasePage() {
  // 基础状态
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rubToCny, setRubToCny] = useState(0.0923);
  const [notify, setNotify] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  // 流水线Tab配置
  type PipelineTab = 'all' | 'pending' | 'purchasing' | 'purchased' | 'received' | 'completed';
  
  const [pipelineTab, setPipelineTab] = useState<PipelineTab>('pending');
  const [selectedTab, setSelectedTab] = useState('pending');
  
  // 流水线Tab定义
  const pipelineTabs: { key: PipelineTab; label: string; erpStatus: string[]; emptyMsg: string; hasLink?: boolean }[] = [
    { key: 'all', label: '全部', erpStatus: [], emptyMsg: '暂无采购任务' },
    { key: 'pending', label: '待采购', erpStatus: ['pending_purchase'], emptyMsg: '暂无待采购任务，去订单列表看看', hasLink: true },
    { key: 'purchasing', label: '运输中', erpStatus: ['shipped_domestic'], emptyMsg: '暂无运输中订单' },
    { key: 'purchased', label: '已采购', erpStatus: ['purchased'], emptyMsg: '暂无已采购任务' },
    { key: 'received', label: '已到货', erpStatus: ['received', 'pending_inspect'], emptyMsg: '暂无到货待验任务' },
    { key: 'completed', label: '已完成', erpStatus: ['shipped', 'delivered'], emptyMsg: '暂无已完成任务' },
  ];

  // 统计数据
  const pipelineStats = useMemo(() => {
    const stats: Record<PipelineTab, number> = {
      all: orders.length,
      pending: 0,
      purchasing: 0,
      purchased: 0,
      received: 0,
      completed: 0,
    };
    
    orders.forEach(order => {
      const status = order.erpStatus;
      if (status === 'pending_purchase') stats.pending++;
      else if (status === 'shipped_domestic') stats.purchasing++;
      else if (status === 'purchased') stats.purchased++;
      else if (status === 'received' || status === 'pending_inspect') stats.received++;
      else if (status === 'shipped' || status === 'delivered') stats.completed++;
    });
    
    return stats;
  }, [orders]);

  // 切换流水线Tab
  const handlePipelineTabChange = (tab: PipelineTab) => {
    setPipelineTab(tab);
    // 切换Tab时清空选中状态
    setSelectedOrder(null);
    setSelectedSkuOrder(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  // 视图相关
  const [viewMode, setViewMode] = useState<'byProduct' | 'byOrder'>('byProduct');
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedSkuOrder, setSelectedSkuOrder] = useState<AggregatedSku | null>(null);

  // 表单相关
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 初始表单数据
  const initialFormData: PurchaseFormData = {
    platform: 'alibaba',
    productUrl: '',
    unitPrice: '',
    quantity: '',
    supplierNote: '',
    trackingNumber: '',
  };
  const [formData, setFormData] = useState<PurchaseFormData>(initialFormData);

  // 批量录入快递相关状态
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchItems, setBatchItems] = useState<BatchTrackingItem[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // URL参数定位相关状态
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // 解析批量文本为记录
  const parseBatchText = useCallback((text: string, allOrders: Order[]) => {
    const lines = text.split('\n').filter(line => line.trim());
    
    const items: BatchTrackingItem[] = lines.map((line, idx) => {
      const trimmed = line.trim();
      const parts = trimmed.split(/\s+/);
      
      let trackingNumber = '';
      let orderId: string | null = null;
      let orderPostingNumber: string | null = null;
      let matched = false;
      
      if (parts.length >= 2) {
        // 可能是 "订单号 快递号" 格式
        const potentialOrderNum = parts[0];
        const potentialTracking = parts[1];
        
        // 查找匹配的订单
        const matchedOrder = allOrders.find(o => 
          o.ozonPostingNumber === potentialOrderNum || 
          o.ozonOrderId === potentialOrderNum
        );
        
        if (matchedOrder) {
          trackingNumber = potentialTracking;
          orderId = matchedOrder.id;
          orderPostingNumber = matchedOrder.ozonPostingNumber || matchedOrder.ozonOrderId;
          matched = true;
        } else {
          // 纯快递号格式
          trackingNumber = trimmed;
        }
      } else {
        // 纯快递号
        trackingNumber = trimmed;
      }
      
      return {
        id: `batch-${idx}-${Date.now()}`,
        rawText: trimmed,
        trackingNumber,
        orderId,
        orderPostingNumber,
        matched,
        orderSearchQuery: '',
      };
    });
    
    return items;
  }, []);

  // 更新批量文本时自动解析
  const handleBatchTextChange = useCallback((text: string) => {
    setBatchText(text);
    const parsed = parseBatchText(text, orders);
    setBatchItems(parsed);
  }, [orders, parseBatchText]);

  // 手动匹配订单
  const handleMatchOrder = useCallback((itemId: string, order: Order) => {
    setBatchItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          orderId: order.id,
          orderPostingNumber: order.ozonPostingNumber || order.ozonOrderId,
          matched: true,
          orderSearchQuery: '',
        };
      }
      return item;
    }));
  }, []);

  // 切换批量录入模式
  const toggleBatchMode = useCallback(() => {
    if (batchMode && batchItems.length > 0) {
      if (!confirm('确定退出批量录入模式？未提交的内容将丢失。')) {
        return;
      }
    }
    setBatchMode(false);
    setBatchText('');
    setBatchItems([]);
  }, [batchMode, batchItems]);

  // 批量提交 - 稍后在 toast 和 fetchOrders 之后定义

  // 判断是否为已采购状态
  const isAlreadyPurchased = useMemo(() => {
    if (selectedOrder) {
      return ['shipped_domestic', 'purchased', 'pending_inspect', 'pending_pack', 'shipped'].includes(selectedOrder.erpStatus);
    }
    return false;
  }, [selectedOrder]);

  // 检查是否有采购记录
  const hasPurchaseRecord = useMemo(() => {
    return isAlreadyPurchased && selectedOrder?.purchaseInfo;
  }, [isAlreadyPurchased, selectedOrder]);

  // Toast提示
  const toast = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotify({ msg, type });
    setTimeout(() => setNotify(null), 3000);
  };

  // 获取汇率
  useEffect(() => {
    fetch('/api/exchange-rate')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.rate) {
          setRubToCny(data.data.rate);
        }
      })
      .catch(() => {});
  }, []);

  // 获取订单列表
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders?page=1&pageSize=100');
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('获取订单失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载订单列表
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // 同步订单
  const syncOrders = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync/orders', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast('同步完成');
        fetchOrders();
      } else {
        toast(`同步失败: ${data.message || data.error || ''}`, 'error');
      }
    } catch (error) {
      console.error('同步失败:', error);
      toast('同步失败', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // 批量提交
  const handleBatchSubmit = useCallback(async () => {
    const unmatchedItems = batchItems.filter(item => !item.matched);
    if (unmatchedItems.length > 0) {
      toast('请先匹配所有未识别的快递号', 'error');
      return;
    }

    setBatchSubmitting(true);
    try {
      const res = await fetch('/api/purchase/batch-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: batchItems.map(item => ({
            orderId: item.orderId,
            trackingNumber: item.trackingNumber,
          })),
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast(`提交成功：${data.data?.success || batchItems.length}条`);
        setBatchMode(false);
        setBatchText('');
        setBatchItems([]);
        fetchOrders();
      } else {
        toast(`提交失败: ${data.message || '未知错误'}`, 'error');
      }
    } catch (error) {
      console.error('批量提交失败:', error);
      toast('提交失败', 'error');
    } finally {
      setBatchSubmitting(false);
    }
  }, [batchItems, toast, fetchOrders]);

  // 计算总金额
  const totalAmount = useMemo(() => {
    const price = parseFloat(formData.unitPrice) || 0;
    const qty = parseInt(formData.quantity) || 0;
    return price * qty;
  }, [formData.unitPrice, formData.quantity]);

  // 根据流水线Tab筛选订单
  const pipelineFilter = useMemo(() => {
    const tab = pipelineTabs.find(t => t.key === pipelineTab);
    return tab?.erpStatus || [];
  }, [pipelineTab]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // 如果erpStatus为空或不在列表中，排除
      if (pipelineFilter.length === 0) return true;
      return pipelineFilter.includes(order.erpStatus);
    }).filter(order => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (order.ozonOrderId || '').toLowerCase().includes(q) ||
        (order.ozonPostingNumber || '').toLowerCase().includes(q) ||
        (order.recipientCity || '').toLowerCase().includes(q) ||
        (order.products || []).some(p => 
          (p.name || '').toLowerCase().includes(q) || 
          (p.sku || '').toLowerCase().includes(q)
        )
      );
    });
  }, [orders, pipelineFilter, searchQuery]);

  const aggregatedSkus = useMemo(() => aggregateBySku(filteredOrders), [filteredOrders]);

  // ========== URL参数定位处理 ==========
  const handleUrlParamsLocation = useCallback(() => {
    const orderId = searchParams.get('orderId');
    const orderIds = searchParams.get('orderIds');
    const action = searchParams.get('action');

    // 如果没有参数，不做任何处理
    if (!orderId && !orderIds && !action) {
      return;
    }

    // 清除URL参数
    router.replace('/purchase');

    // 单个订单处理
    if (orderId) {
      const targetOrder = orders.find(o => o.id === orderId || o.ozonOrderId === orderId || o.ozonPostingNumber === orderId);
      
      if (targetOrder) {
        if (action === 'view') {
          // 查看采购 - 切换到按订单视图，选中订单
          setViewMode('byOrder');
          setSelectedOrder(targetOrder);
          setSelectedSkuOrder(null);
          // 回填表单数据
          if (targetOrder.purchaseInfo) {
            setFormData({
              platform: targetOrder.purchaseInfo.platform || 'alibaba',
              productUrl: targetOrder.purchaseInfo.productUrl || '',
              unitPrice: targetOrder.purchaseInfo.unitPrice?.toString() || '',
              quantity: targetOrder.purchaseInfo.quantity?.toString() || '',
              supplierNote: targetOrder.purchaseInfo.supplierNote || '',
              trackingNumber: targetOrder.purchaseInfo.trackingNumber || '',
            });
          }
        } else {
          // 去采购/批量采购 - 切换到按订单视图，选中订单
          setViewMode('byOrder');
          setSelectedOrder(targetOrder);
          setSelectedSkuOrder(null);
          // 重置表单
          setFormData({
            ...initialFormData,
            quantity: targetOrder.products.reduce((sum, p) => sum + p.quantity, 0).toString(),
          });
        }
        // 高亮选中行
        setHighlightedId(targetOrder.id);
        setTimeout(() => setHighlightedId(null), 1500);
      } else {
        setNotFoundMessage('未找到对应采购任务，可能已处理或订单不存在');
        setTimeout(() => setNotFoundMessage(null), 5000);
      }
    }

    // 批量订单处理
    if (orderIds && action === 'batch') {
      const idList = orderIds.split(',');
      const targetOrders = orders.filter(o => idList.includes(o.id) || idList.includes(o.ozonOrderId) || idList.includes(o.ozonPostingNumber));
      
      if (targetOrders.length > 0) {
        // 切换到按商品视图（多订单按SKU聚合）
        setViewMode('byProduct');
        // 找到第一个SKU对应的聚合项并选中
        const firstSku = targetOrders[0].products[0]?.sku;
        if (firstSku) {
          const targetSku = aggregatedSkus.find(a => a.sku === firstSku);
          if (targetSku) {
            setSelectedSkuOrder(targetSku);
            setSelectedOrder(null);
            // 重置表单
            setFormData({
              ...initialFormData,
              quantity: targetSku.totalQuantity.toString(),
            });
            // 高亮选中行
            setHighlightedId(`sku-${targetSku.sku}`);
            setTimeout(() => setHighlightedId(null), 1500);
          }
        }
      } else {
        setNotFoundMessage('未找到对应采购任务，可能已处理或订单不存在');
        setTimeout(() => setNotFoundMessage(null), 5000);
      }
    }
  }, [searchParams, router, orders, aggregatedSkus, initialFormData]);

  // 订单加载完成后处理URL参数定位
  useEffect(() => {
    if (orders.length > 0) {
      handleUrlParamsLocation();
    }
  }, [handleUrlParamsLocation]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      if (!a.shipmentDeadline) return 1;
      if (!b.shipmentDeadline) return -1;
      return a.shipmentDeadline.localeCompare(b.shipmentDeadline);
    });
  }, [filteredOrders]);

  // 选中处理
  const handleViewChange = (mode: 'byProduct' | 'byOrder') => {
    setViewMode(mode);
    setSelectedOrder(null);
    setSelectedSkuOrder(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const handleSelectOrder = (order: Order) => {
    const isDeselect = selectedOrder?.id === order.id;
    setSelectedOrder(isDeselect ? null : order);
    setSelectedSkuOrder(null);
    
    if (!isDeselect) {
      // 回填已有采购记录
      if (order.purchaseInfo) {
        setFormData({
          platform: order.purchaseInfo.platform || 'alibaba',
          productUrl: order.purchaseInfo.productUrl || '',
          unitPrice: order.purchaseInfo.unitPrice?.toString() || '',
          quantity: order.purchaseInfo.quantity?.toString() || order.products[0]?.quantity.toString() || '1',
          supplierNote: order.purchaseInfo.supplierNote || '',
          trackingNumber: order.purchaseInfo.trackingNumber || '',
        });
      } else {
        setFormData({
          ...initialFormData,
          quantity: order.products[0]?.quantity.toString() || '1',
        });
      }
      setFormErrors({});
    } else {
      setFormData(initialFormData);
    }
  };

  const handleSelectSku = (sku: AggregatedSku) => {
    const isDeselect = selectedSkuOrder?.sku === sku.sku;
    setSelectedSkuOrder(isDeselect ? null : sku);
    setSelectedOrder(null);
    
    if (!isDeselect) {
      setFormData({
        ...initialFormData,
        quantity: sku.totalQuantity.toString(),
      });
      setFormErrors({});
    } else {
      setFormData(initialFormData);
    }
  };

  const toggleSkuExpand = (sku: string) => {
    setExpandedSkus(prev => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedOrder(null);
    setSelectedSkuOrder(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  // 表单处理
  const handleFormChange = (field: keyof PurchaseFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // 表单校验
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.platform) {
      errors.platform = '请选择采购平台';
    }
    
    const unitPrice = parseFloat(formData.unitPrice);
    if (!formData.unitPrice || isNaN(unitPrice) || unitPrice <= 0) {
      errors.unitPrice = '请输入有效的采购单价';
    }

    const quantity = parseInt(formData.quantity);
    if (!formData.quantity || isNaN(quantity) || quantity <= 0) {
      errors.quantity = '请输入有效的采购数量';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 提交表单
  const handleSubmit = async (isDraft: boolean = false) => {
    if (!isDraft && !validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // 获取关联的订单ID
      const orderIds = selectedSkuOrder 
        ? selectedSkuOrder.orders.map(o => o.id)
        : selectedOrder 
          ? [selectedOrder.id] 
          : [];

      const payload = {
        orderIds,
        platform: formData.platform,
        productUrl: formData.productUrl,
        unitPrice: parseFloat(formData.unitPrice) || 0,
        quantity: parseInt(formData.quantity) || 0,
        supplierNote: formData.supplierNote,
        trackingNumber: formData.trackingNumber,
        isDraft,
      };

      const res = await fetch('/api/purchase/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast(isDraft ? '草稿已保存' : '采购信息已提交');
        
        // 更新本地订单状态
        setOrders(prev => prev.map(order => {
          if (orderIds.includes(order.id)) {
            return {
              ...order,
              erpStatus: isDraft ? order.erpStatus : 'shipped_domestic',
              purchaseInfo: {
                platform: formData.platform,
                productUrl: formData.productUrl,
                unitPrice: parseFloat(formData.unitPrice),
                quantity: parseInt(formData.quantity),
                supplierNote: formData.supplierNote,
                trackingNumber: formData.trackingNumber,
                isDraft,
              },
            };
          }
          return order;
        }));

        // 写入跨页面联动标记（订单列表会监听此标记刷新）
        if (!isDraft) {
          localStorage.setItem('erp_purchase_action', JSON.stringify({
            action: 'purchase_confirmed',
            orderIds,
            timestamp: Date.now(),
          }));
        }

        if (!isDraft) {
          // 成功提交后2秒清空表单
          setTimeout(() => {
            setFormData(initialFormData);
            handleClearSelection();
          }, 2000);
        }
      } else {
        toast(data.message || '提交失败', 'error');
      }
    } catch (error) {
      console.error('提交失败:', error);
      toast('提交失败，请重试', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 是否有选中
  const hasSelection = selectedOrder !== null || selectedSkuOrder !== null;

  // 获取当前选中项的默认数量
  const defaultQuantity = selectedSkuOrder 
    ? selectedSkuOrder.totalQuantity 
    : selectedOrder 
      ? selectedOrder.products[0]?.quantity || 1 
      : 1;

  return (
    <AppLayout title="采购中心" subtitle="采购工作台">
      {/* Toast 通知 */}
      {notify && (
        <div className={`mx-4 mt-2 px-4 py-2 rounded-lg text-sm ${
          notify.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {notify.msg}
        </div>
      )}

      {/* 左右分栏布局 */}
      <div className="flex h-[calc(100vh-140px)]">
        {/* ========== 左栏 - 任务列表 (60%) ========== */}
        <div className="w-3/5 border-r border-[#E6EAF2] flex flex-col overflow-hidden">
          {/* 流水线状态Tab栏 */}
          <div className="px-4 py-3 border-b border-[#E6EAF2] bg-white flex-shrink-0">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
              {pipelineTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => handlePipelineTabChange(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    pipelineTab === tab.key
                      ? 'bg-white shadow text-[#2F6BFF]'
                      : 'text-[#637089] hover:text-[#152033]'
                  }`}
                >
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    pipelineTab === tab.key
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {pipelineStats[tab.key]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 工具栏 */}
          <div className="px-4 py-3 border-b border-[#E6EAF2] bg-white flex-shrink-0">
            <div className="flex items-center gap-3">
              {/* 搜索 */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索订单号、商品名称、SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-[#E6EAF2] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* 视图切换Tab */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                {[
                  { key: 'pending', label: '待采购' },
                  { key: 'inspecting', label: '待验货' },
                  { key: 'packing', label: '待打包' },
                  { key: 'all', label: '全部' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setSelectedTab(tab.key)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selectedTab === tab.key
                        ? 'bg-white shadow text-[#152033]'
                        : 'text-[#637089] hover:text-[#152033]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={syncOrders}
                disabled={syncing}
                className="gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? '同步中...' : '同步'}
              </Button>
            </div>

            {/* 视图切换Tab */}
            <div className="flex items-center gap-1 mt-3 bg-gray-100 rounded-lg p-0.5 w-fit">
              <button
                onClick={() => handleViewChange('byProduct')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  viewMode === 'byProduct'
                    ? 'bg-white shadow text-[#2F6BFF]'
                    : 'text-[#637089] hover:text-[#152033]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                按商品
              </button>
              <button
                onClick={() => handleViewChange('byOrder')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  viewMode === 'byOrder'
                    ? 'bg-white shadow text-[#2F6BFF]'
                    : 'text-[#637089] hover:text-[#152033]'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                按订单
              </button>
              {viewMode === 'byOrder' && (
                <button
                  onClick={() => setBatchMode(true)}
                  className="ml-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 bg-[#2F6BFF] text-white hover:bg-[#2558e0]"
                >
                  <Truck className="w-3.5 h-3.5" />
                  批量录快递
                </button>
              )}
            </div>
          </div>

          {/* 列表区域 */}
          <div className="flex-1 overflow-y-auto bg-white">
            {loading ? (
              <div className="flex items-center justify-center h-full text-[#637089]">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                加载中...
              </div>
            ) : (viewMode === 'byProduct' ? aggregatedSkus : sortedOrders).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#637089]">
                <Package className="w-12 h-12 mb-3 text-gray-300" />
                <p className="text-sm">{pipelineTabs.find(t => t.key === pipelineTab)?.emptyMsg || '暂无数据'}</p>
                {pipelineTabs.find(t => t.key === pipelineTab)?.hasLink && (
                  <button
                    onClick={() => router.push('/orders')}
                    className="mt-2 text-sm text-[#2F6BFF] hover:underline"
                  >
                    去订单列表看看 →
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#E6EAF2]">
                {/* ========== 按商品视图 ========== */}
                {viewMode === 'byProduct' && aggregatedSkus.map(skuItem => {
                  const isSkuSelected = selectedSkuOrder?.sku === skuItem.sku;
                  const isExpanded = expandedSkus.has(skuItem.sku);
                  const deadline = getDeadlineDisplay(skuItem.earliestDeadline);

                  return (
                    <div key={skuItem.sku}>
                      <div
                        onClick={() => handleSelectSku(skuItem)}
                        className={`p-4 cursor-pointer transition-all ${
                          isSkuSelected
                            ? `bg-blue-50 border-l-4 border-l-[#2F6BFF] ${highlightedId === `sku-${skuItem.sku}` ? 'animate-pulse-blue' : ''}`
                            : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <ProductImage src={skuItem.image || ''} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-[#152033] text-sm truncate">
                                {skuItem.name}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {deadline && (
                                  <span className={`text-xs ${deadline.color}`}>
                                    {deadline.text}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-sm font-bold">
                                  ×{skuItem.totalQuantity}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs text-[#637089] mt-0.5">
                              SKU: {skuItem.sku}
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleSkuExpand(skuItem.sku); }}
                                className="flex items-center gap-1 text-xs text-[#2F6BFF] hover:text-blue-700 transition-colors"
                              >
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                涉及 {skuItem.orders.length} 个订单
                              </button>
                              <div className="text-xs text-[#637089]">
                                {skuItem.orders[0]?.shopName || '-'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 展开的订单列表 */}
                      {isExpanded && (
                        <div className="bg-gray-50 border-l-4 border-l-[#2F6BFF]">
                          {skuItem.orders.map(order => {
                            const orderDeadline = getDeadlineDisplay(order.shipmentDeadline);
                            const erpInfo = erpStatusMap[order.erpStatus] || { label: order.erpStatus, color: 'bg-gray-100 text-gray-700' };
                            const product = order.products.find(p => p.sku === skuItem.sku) || order.products[0];

                            return (
                              <div key={order.id} className="px-4 py-2.5 border-b border-gray-200 last:border-b-0 hover:bg-white transition-colors">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="text-xs font-mono text-[#637089] truncate">
                                      {order.ozonPostingNumber}
                                    </div>
                                    {order.status && order.status !== order.erpStatus && (
                                      <span className="text-[10px] px-1 py-0.5 bg-gray-200 text-gray-500 rounded">
                                        {order.status}
                                      </span>
                                    )}
                                    <Badge className={`${erpInfo.color} text-[10px]`}>
                                      {erpInfo.label}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {orderDeadline && (
                                      <span className={`text-xs ${orderDeadline.color}`}>
                                        {orderDeadline.text}
                                      </span>
                                    )}
                                    <span className="text-xs text-[#637089]">
                                      ×{product?.quantity || 1}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* ========== 按订单视图 ========== */}
                {viewMode === 'byOrder' && sortedOrders.map(order => {
                  const erpInfo = erpStatusMap[order.erpStatus] || { label: order.erpStatus, color: 'bg-gray-100 text-gray-700' };
                  const product = order.products[0];
                  const isSelected = selectedOrder?.id === order.id;
                  const deadline = getDeadlineDisplay(order.shipmentDeadline);

                  return (
                    <div
                      key={order.id}
                      onClick={() => handleSelectOrder(order)}
                      className={`p-4 cursor-pointer transition-all ${
                        isSelected
                          ? `bg-blue-50 border-l-4 border-l-[#2F6BFF] ${highlightedId === order.id ? 'animate-pulse-blue' : ''}`
                          : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <ProductImage src={product?.image || ''} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium text-[#152033] font-mono text-xs truncate">
                              {order.ozonPostingNumber || order.ozonOrderId}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {deadline && (
                                <span className={`text-xs ${deadline.color}`}>
                                  {deadline.text}
                                </span>
                              )}
                              <Badge className={erpInfo.color}>
                                {erpInfo.label}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-xs text-[#637089] mt-0.5">
                            {order.shopName || '-'}
                            {order.status && order.status !== order.erpStatus && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                Ozon: {order.status}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-[#152033] mt-1 truncate">
                            {product?.name || '-'}
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <div className="text-xs text-[#637089]">
                              SKU: {product?.sku || '-'} × {product?.quantity || 1}
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-[#152033] text-sm">
                                {formatCNY(parseFloat(order.totalPrice || '0') * rubToCny)}
                              </div>
                              <div className="text-xs text-[#637089]">
                                {order.totalPrice} {order.currency || 'RUB'}
                              </div>
                            </div>
                          </div>
                          {order.recipientCity && (
                            <div className="text-xs text-[#637089] mt-1">
                              收货城市: {order.recipientCity}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ========== 右栏 - 详情/表单区 (40%) ========== */}
        <div className="w-2/5 flex flex-col overflow-hidden bg-[#F6F8FB]">
          {/* 未找到提示 */}
          {notFoundMessage && (
            <div className="mx-4 mt-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <span className="text-sm text-yellow-700">{notFoundMessage}</span>
            </div>
          )}
          {batchMode ? (
            <>
              {/* 批量录入模式头部 */}
              <div className="p-4 bg-white border-b border-[#E6EAF2] flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[#152033]">批量录入快递号</h3>
                    <p className="text-xs text-[#637089] mt-0.5">已识别 {batchItems.filter(i => i.matched).length} / {batchItems.length} 条</p>
                  </div>
                  <button
                    onClick={toggleBatchMode}
                    className="text-sm text-[#2F6BFF] hover:underline"
                  >
                    返回单条录入
                  </button>
                </div>
              </div>

              {/* 批量录入内容 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* 输入说明 */}
                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                  每行一个快递号，格式：订单号+空格+快递号，或纯快递号（需手动匹配）
                </div>

                {/* 文本输入 */}
                <div className="bg-white rounded-lg border border-[#E6EAF2] p-4">
                  <textarea
                    value={batchText}
                    onChange={(e) => handleBatchTextChange(e.target.value)}
                    placeholder={"粘贴示例：\nO-20260619-001 SF1234567890\nSF9876543210"}
                    className="w-full h-32 px-3 py-2 text-sm border border-[#E6EAF2] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />
                </div>

                {/* 解析预览 */}
                {batchItems.length > 0 && (
                  <div className="bg-white rounded-lg border border-[#E6EAF2] p-4">
                    <h4 className="text-sm font-medium text-[#152033] mb-3">识别结果</h4>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {batchItems.map((item, idx) => (
                        <div key={item.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${item.matched ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span className="text-xs font-mono text-[#152033] truncate">{item.trackingNumber}</span>
                            </div>
                            {item.matched && item.orderPostingNumber && (
                              <div className="text-xs text-green-600 mt-0.5 ml-4">
                                → {item.orderPostingNumber}
                              </div>
                            )}
                            {!item.matched && (
                              <div className="mt-1 ml-4">
                                <input
                                  type="text"
                                  placeholder="输入订单号搜索..."
                                  value={item.orderSearchQuery}
                                  onChange={(e) => {
                                    const query = e.target.value;
                                    setBatchItems(prev => prev.map(it => 
                                      it.id === item.id ? { ...it, orderSearchQuery: query } : it
                                    ));
                                  }}
                                  className="w-full px-2 py-1 text-xs border border-[#E6EAF2] rounded focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                                />
                                {item.orderSearchQuery && (
                                  <div className="mt-1 border border-[#E6EAF2] rounded bg-white max-h-32 overflow-y-auto">
                                    {orders.filter(o => {
                                      const q = item.orderSearchQuery.toLowerCase();
                                      return (
                                        (o.ozonPostingNumber || '').toLowerCase().includes(q) ||
                                        (o.ozonOrderId || '').toLowerCase().includes(q)
                                      );
                                    }).slice(0, 5).map(order => (
                                      <button
                                        key={order.id}
                                        onClick={() => handleMatchOrder(item.id, order)}
                                        className="w-full px-2 py-1.5 text-xs text-left hover:bg-blue-50 border-b last:border-b-0"
                                      >
                                        <div className="font-mono">{order.ozonPostingNumber || order.ozonOrderId}</div>
                                        <div className="text-[#637089] truncate">{order.products[0]?.name}</div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 提交按钮 */}
                <div className="sticky bottom-0 pt-4 bg-[#F6F8FB]">
                  <Button
                    onClick={handleBatchSubmit}
                    disabled={batchSubmitting || batchItems.filter(i => i.matched).length !== batchItems.length || batchItems.length === 0}
                    className="w-full bg-[#2F6BFF] hover:bg-[#2558e0] disabled:bg-gray-300"
                  >
                    {batchSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        确认提交 ({batchItems.filter(i => i.matched).length}/{batchItems.length})
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : hasSelection ? (
            <>
              {/* 右栏头部 */}
              <div className="p-4 bg-white border-b border-[#E6EAF2] flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[#152033]">
                      {selectedSkuOrder ? '商品采购' : '订单采购'}
                    </h3>
                    <p className="text-xs text-[#637089] mt-0.5 font-mono">
                      {selectedSkuOrder
                        ? `${selectedSkuOrder.sku} · ${selectedSkuOrder.orders.length}个订单`
                        : (selectedOrder?.ozonPostingNumber || selectedOrder?.ozonOrderId || '-')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setFormCollapsed(!formCollapsed)}
                      className="h-8 px-2"
                    >
                      {formCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleClearSelection}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* 右栏内容 - 可滚动 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* ========== 表单顶部信息区（可折叠）========== */}
                {!formCollapsed && (
                  <div className="bg-white rounded-lg border border-[#E6EAF2] p-4">
                    <h4 className="text-sm font-medium text-[#152033] mb-3">采购对象</h4>
                    <div className="flex items-start gap-3">
                      <ProductImage 
                        src={(selectedSkuOrder?.image || selectedOrder?.products[0]?.image) || ''} 
                        className="w-16 h-16"
                      />
                      <div className="flex-1">
                        <div className="text-sm text-[#152033] font-medium">
                          {selectedSkuOrder?.name || selectedOrder?.products[0]?.name || '-'}
                        </div>
                        <div className="text-xs text-[#637089] mt-1">
                          SKU: {selectedSkuOrder?.sku || selectedOrder?.products[0]?.sku || '-'}
                        </div>
                        <div className="text-xs text-[#637089] mt-1">
                          {selectedSkuOrder
                            ? `涉及 ${selectedSkuOrder.orders.length} 个订单，合并采购 ×${selectedSkuOrder.totalQuantity}`
                            : `订单数量 ×${selectedOrder?.products[0]?.quantity || 1}`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ========== 采购录入表单 ========== */}
                <div className="bg-white rounded-lg border border-[#E6EAF2] p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-[#152033]">采购信息</h4>
                    {isAlreadyPurchased && (
                      <Badge className="bg-yellow-100 text-yellow-700">
                        {hasPurchaseRecord ? '已有采购记录' : '已采购'}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* 采购平台 */}
                    <div>
                      <label className="block text-xs text-[#637089] mb-1.5">采购平台 <span className="text-red-500">*</span></label>
                      <select
                        value={formData.platform}
                        onChange={(e) => handleFormChange('platform', e.target.value)}
                        className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                          formErrors.platform ? 'border-red-500' : 'border-[#E6EAF2]'
                        }`}
                      >
                        <option value="alibaba">1688</option>
                        <option value="pinduoduo">拼多多</option>
                      </select>
                      {formErrors.platform && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {formErrors.platform}
                        </p>
                      )}
                    </div>

                    {/* 商品链接 */}
                    <div>
                      <label className="block text-xs text-[#637089] mb-1.5">
                        {formData.platform === 'alibaba' ? '1688' : '拼多多'}商品链接
                      </label>
                      <div className="relative">
                        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="粘贴商品详情页URL"
                          value={formData.productUrl}
                          onChange={(e) => handleFormChange('productUrl', e.target.value)}
                          className="w-full pl-9 pr-4 py-2 text-sm border border-[#E6EAF2] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>

                    {/* 采购单价和数量 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#637089] mb-1.5">采购单价 <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#637089]">¥</span>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={formData.unitPrice}
                            onChange={(e) => handleFormChange('unitPrice', e.target.value)}
                            className={`w-full pl-7 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                              formErrors.unitPrice ? 'border-red-500' : 'border-[#E6EAF2]'
                            }`}
                          />
                        </div>
                        {formErrors.unitPrice && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {formErrors.unitPrice}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-[#637089] mb-1.5">采购数量 <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          placeholder="1"
                          value={formData.quantity}
                          onChange={(e) => handleFormChange('quantity', e.target.value)}
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                            formErrors.quantity ? 'border-red-500' : 'border-[#E6EAF2]'
                          }`}
                        />
                        {formErrors.quantity && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {formErrors.quantity}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 总金额 */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#637089]">总金额</span>
                        <span className="text-lg font-bold text-[#152033]">
                          {formatCNY(totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* 供应商备注 */}
                    <div>
                      <label className="block text-xs text-[#637089] mb-1.5">供应商备注</label>
                      <textarea
                        placeholder="记录供应商名称或特殊要求"
                        value={formData.supplierNote}
                        onChange={(e) => handleFormChange('supplierNote', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-[#E6EAF2] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    {/* 快递单号 */}
                    <div>
                      <label className="block text-xs text-[#637089] mb-1.5">快递单号</label>
                      <input
                        type="text"
                        placeholder="到货后填写"
                        value={formData.trackingNumber}
                        onChange={(e) => handleFormChange('trackingNumber', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[#E6EAF2] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* ========== 底部操作区 ========== */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="flex-1 bg-[#2F6BFF] hover:bg-blue-600 text-white gap-1.5"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    {hasPurchaseRecord ? '更新采购' : '确认采购'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSubmit(true)}
                    disabled={submitting}
                    className="gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    暂存草稿
                  </Button>
                </div>
                <p className="text-xs text-[#637089] text-center">
                  暂存草稿不会改变订单状态，方便稍后继续填写
                </p>
              </div>
            </>
          ) : (
            /* 未选中状态 */
            <div className="flex-1 flex flex-col items-center justify-center text-[#637089]">
              <FileText className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-sm">请从左侧选择一个采购任务</p>
              <p className="text-xs text-gray-400 mt-1">点击任务卡片开始采购录入</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
