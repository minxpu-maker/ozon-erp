'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

import { AppLayout } from '@/components/layout/AppLayout';import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  RefreshCw, 
  Download, 
  Eye, 
  Search, 
  ImageIcon, 
  X,
  Clock,
  ShoppingCart,
  CheckCircle,
  Package,
  MapPin,
  FileText,
  Truck,
  Warehouse,
  Check,
  AlertCircle,
  LayoutDashboard,
  ClipboardList,
  Calculator,
  PackageSearch,
  Database,
  Users,
  BarChart3,
  UserCircle,
  Shield,
  Settings
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/purchase', icon: Package, label: '采购管理', active: true },
  { href: '/logistics', icon: Truck, label: '入库验货' },
  { href: '/packaging', icon: Package, label: '打包发货' },
  { href: '/finance', icon: Calculator, label: '利润核算' },
  { type: 'divider', label: '库存管理' },
  { href: '/inventory', icon: PackageSearch, label: '库存管理' },
  { href: '/wms', icon: Warehouse, label: '仓库管理' },
  { type: 'divider', label: '数据中心' },
  { href: '/sku-management', icon: Database, label: 'SKU管理' },
  { href: '/suppliers', icon: Users, label: '供应商管理' },
  { href: '/reports', icon: BarChart3, label: '数据报表' },
  { type: 'divider', label: '系统' },
  { href: '/accounts', icon: UserCircle, label: '账号管理' },
  { href: '/roles', icon: Shield, label: '角色权限' },
  { href: '/settings', icon: Settings, label: '系统设置' },
];

interface Order {
  id: string;
  ozonOrderId: string;
  postingNumber: string;
  shopId: string;
  shopName: string;
  status: string;
  buyerName: string | null;
  totalPrice: string;
  purchasePrice: string | null;
  ozonCreatedAt: string | null;  // Ozon订单下单时间
  createdAt: string;  // 系统入库时间
  products: Array<{
    name: string;
    sku: string;
    quantity: number;
    price: string;
    image?: string;
  }>;
  purchaseStatus: 'awaiting' | 'purchased' | 'delivered';
}

const statusMap: Record<string, { label: string; color: string }> = {
  'awaiting_deliver': { label: '待采购', color: 'bg-orange-100 text-orange-700' },
  'awaiting_packaging': { label: '待打包', color: 'bg-blue-100 text-blue-700' },
  'awaiting_picking': { label: '待拣货', color: 'bg-purple-100 text-purple-700' },
  'delivered': { label: '已送达', color: 'bg-green-100 text-green-700' },
  'cancelled': { label: '已取消', color: 'bg-red-100 text-red-700' },
  'returned': { label: '已退回', color: 'bg-gray-100 text-gray-700' },
};

const purchaseStatusMap: Record<string, { label: string; color: string }> = {
  'awaiting': { label: '待采购', color: 'bg-orange-100 text-orange-700' },
  'purchased': { label: '已采购', color: 'bg-blue-100 text-blue-700' },
  'delivered': { label: '已送达', color: 'bg-green-100 text-green-700' },
};

// 商品图片组件
function ProductImage({ src, size = 'sm' }: { src: string; size?: 'sm' | 'md' }) {
  const [error, setError] = useState(false);
  const sizeClass = size === 'md' ? 'w-12 h-12' : 'w-10 h-10';
  
  if (error || !src) {
    return (
      <div className={`${sizeClass} rounded bg-gray-100 flex items-center justify-center`}>
        <ImageIcon className="w-4 h-4 text-gray-400" />
      </div>
    );
  }
  
  return (
    <img 
      src={src} 
      alt="商品" 
      className={`${sizeClass} rounded object-cover`}
      onError={() => setError(true)}
    />
  );
}

export default function PurchasePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('awaiting_deliver');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [editingPurchasePrice, setEditingPurchasePrice] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [rubToCny, setRubToCny] = useState(0.0923);
  const [viewMode, setViewMode] = useState<'list' | 'sku'>('list');
  const [trackingNo, setTrackingNo] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchasePlatform, setPurchasePlatform] = useState('1688');
  const [supplierName, setSupplierName] = useState('');
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  // 批量录入（表格形式）
  const [batchItems, setBatchItems] = useState<any[]>([]);
  const [selectedSkuOrders, setSelectedSkuOrders] = useState<any[]>([]);
  const [batchPlatform, setBatchPlatform] = useState('1688');
  const [batchSupplier, setBatchSupplier] = useState('');
  const [batchPurchaseUrl, setBatchPurchaseUrl] = useState('');
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [notify, setNotify] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  // 同SKU历史采购
  const [lastPurchase, setLastPurchase] = useState<any>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // 采购链接（选填）
  const [purchaseUrl, setPurchaseUrl] = useState('');

  // 提示函数
  const toast = (opt: { title: string; variant?: 'default' | 'destructive' }) => {
    setNotify({ msg: opt.title, type: opt.variant === 'destructive' ? 'error' : 'success' });
    setTimeout(() => setNotify(null), 3000);
  };

  // 统计数据
  const stats = {
    awaiting: orders.filter(o => o.purchaseStatus === 'awaiting').length,
    purchased: orders.filter(o => o.purchaseStatus === 'purchased').length,
    delivered: orders.filter(o => o.purchaseStatus === 'delivered').length,
    total: orders.length,
  };

  // 紧急度边框颜色
  const getBorderColor = (order: Order) => {
    if (!order.ozonCreatedAt) return 'border-l-4 border-l-gray-200';
    const hours = (new Date(order.ozonCreatedAt).getTime() - Date.now()) / 3600000;
    if (hours < 24) return 'border-l-4 border-l-red-500';
    if (hours < 72) return 'border-l-4 border-l-yellow-400';
    return 'border-l-4 border-l-gray-200';
  };

  // SKU聚合视图数据
  const skuGroups: Record<string, { sku: string; name: string; image?: string; count: number; orders: any[] }> = (orders as any[]).reduce((acc, order) => {
    const key = order.products?.[0]?.sku || order.postingNumber || order.ozonPostingNumber || String(Math.random());
    if (!acc[key]) {
      acc[key] = {
        sku: key,
        name: order.products?.[0]?.name,
        image: order.products?.[0]?.image,
        count: 0,
        orders: [],
      };
    }
    acc[key].count++;
    acc[key].orders.push(order);
    return acc;
  }, {});

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
      const res = await fetch(`/api/orders?status=pending_purchase`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data.orders || data.orders || data.data || []);
      }
    } catch (error) {
      console.error('获取订单失败:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // 选中订单变化时，查询该SKU的历史采购记录
  useEffect(() => {
    if (!selectedOrder) {
      setLastPurchase(null);
      setHistoryList([]);
      return;
    }
    // 重置表单 + 查询历史
    setTrackingNo('');
    setPurchasePrice('');
    setPurchasePlatform('1688');
    setSupplierName('');
    setPurchaseUrl('');

    const orderSku = (selectedOrder as any).sku || (selectedOrder as any).productName || (selectedOrder as any).postingNumber;
    if (!orderSku) return;

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/purchase/history?sku=${encodeURIComponent(orderSku)}`);
        const data = await res.json();
        const history = data.records || [];
        setHistoryList(history);
        if (history.length > 0) {
          const last = history[0];
          setLastPurchase(last);
          setPurchasePrice(last.purchasePrice?.toString() || '');
          setPurchasePlatform(last.supplierSource || '1688');
          setSupplierName(last.supplierName || '');
        } else {
          setLastPurchase(null);
        }
      } catch {
        setHistoryList([]);
        setLastPurchase(null);
      }
    };
    fetchHistory();
  }, [selectedOrder]);

  // 同步订单
  const syncOrders = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
      }
    } catch (error) {
      console.error('同步失败:', error);
    } finally {
      setSyncing(false);
    }
  };

  // 更新采购价
  const updatePurchasePrice = async (orderId: string, price: number) => {
    setSavingPrice(true);
    try {
      const res = await fetch('/api/orders/purchase-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, purchasePrice: price }),
      });
      const data = await res.json();
      if (data.success) {
        setDetailOrder(prev => prev ? { ...prev, purchasePrice: String(price) } : null);
        fetchOrders();
      }
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setSavingPrice(false);
    }
  };

  // 统一采购提交
  const handlePurchaseSubmit = async (goNext: boolean) => {
    if (!selectedOrder || !trackingNo || !purchasePrice) return;
    setSubmitting(true);
    try {
      await fetch('/api/purchase-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demandId: selectedOrder.id,
          domesticTrackingNo: trackingNo,
          purchasePrice: parseFloat(purchasePrice),
          supplierSource: purchasePlatform,
          supplierName,
          purchaseUrl,
        }),
      });
      toast({ title: '采购记录已保存' });

      // 从列表移除已采购的
      setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));

      if (goNext) {
        const currentIdx = orders.findIndex(o => o.id === selectedOrder.id);
        const next = orders[currentIdx + 1];
        if (next) {
          setSelectedOrder(next);
          trackingInputRef.current?.focus();
        } else {
          setSelectedOrder(null);
        }
      } else {
        setSelectedOrder(null);
      }
    } catch {
      toast({ title: '保存失败，请重试', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // 打开批量录入Dialog
  const openBatchDialog = (skuOrders?: any[]) => {
    const items = skuOrders || orders;
    setBatchItems(items.map((o: any) => ({
      orderId: o.id,
      orderNo: o.postingNumber || o.orderNo,
      productName: o.products?.[0]?.productName || o.productName || o.sku,
      sku: o.products?.[0]?.sku || o.sku,
      quantity: o.products?.[0]?.quantity || o.quantity || 1,
      expressNo: '',
      purchasePrice: '',
    })));
    setSelectedSkuOrders(skuOrders || []);
    setBatchPlatform('1688');
    setBatchSupplier('');
    setBatchPurchaseUrl('');
    setShowBatchDialog(true);
  };

  // 批量提交
  const handleBatchSubmit = async () => {
    const readyItems = batchItems.filter(i => i.expressNo && i.purchasePrice);
    if (readyItems.length === 0) return;

    setBatchSubmitting(true);
    try {
      await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: readyItems.map((item: any) => ({
            orderId: item.orderId,
            expressNo: item.expressNo,
            purchasePrice: parseFloat(item.purchasePrice),
            purchasePlatform: selectedSkuOrders.length > 0 ? batchPlatform : '1688',
            supplierName: selectedSkuOrders.length > 0 ? batchSupplier : '',
            purchaseUrl: selectedSkuOrders.length > 0 ? batchPurchaseUrl : '',
          })),
        }),
      });

      const submittedIds = new Set(readyItems.map((i: any) => i.orderId));
      setOrders((prev: any[]) => prev.filter(o => !submittedIds.has(o.id)));
      setShowBatchDialog(false);
      setSelectedOrder(null);
    } finally {
      setBatchSubmitting(false);
    }
  };

  // 打开详情
  const openDetail = (order: Order) => {
    setDetailOrder(order);
    setEditingPurchasePrice(order.purchasePrice || '');
  };

  // 筛选订单
  const filteredOrders = (orders as any[]).filter(order => {
    if (!searchQuery) return true;
    return (order.ozonOrderId || '').includes(searchQuery) ||
           (order.postingNumber || '').includes(searchQuery);
  });

  // 格式化人民币
  const formatCNY = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined) return '¥0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '¥0.00';
    return `¥${num.toFixed(2)}`;
  };

  // 倒计时格式化
  const formatCountdown = (hoursLeft: number): string => {
    if (hoursLeft < 0) return '已超时';
    if (hoursLeft < 1) return `${Math.round(hoursLeft * 60)}m`;
    if (hoursLeft < 24) return `${Math.round(hoursLeft)}h`;
    return `${Math.floor(hoursLeft / 24)}d`;
  };

  // 统计
  const pendingCount = orders.length;
  const todayDoneCount = orders.filter(o => o.purchaseStatus === 'purchased' || o.purchaseStatus === 'delivered').length;
  const overdueCount = (orders as any[]).filter(o => {
    if (!o.shippingDeadline) return false;
    return new Date(o.shippingDeadline) < new Date();
  }).length;

  
return (
    <AppLayout title="采购管理" subtitle="Ozon FBS 订单采购管理">

      {/* === 左右分栏布局 === */}
      <div className="flex gap-4 p-4 h-[calc(100vh-8rem)] overflow-hidden">

        {/* 左栏：采购列表 (60%) */}
        <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">

          {/* 统计卡片 */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="grid grid-cols-3 gap-3">
              {/* 待采购 */}
              <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-600 text-base">📦</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">待采购</p>
                  <p className="text-xl font-bold text-gray-800">{pendingCount}</p>
                </div>
              </div>
              {/* 今日已办 */}
              <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 text-base">✅</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">今日已办</p>
                  <p className="text-xl font-bold text-gray-800">{todayDoneCount}</p>
                </div>
              </div>
              {/* 超时预警 */}
              <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-red-600 text-base">⚠️</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">超时预警</p>
                  <p className="text-xl font-bold text-red-600">{overdueCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 操作栏：视图切换 + 批量录入 */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索订单号..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* 视图切换 */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                列表
              </button>
              <button
                onClick={() => setViewMode('sku')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'sku' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                SKU聚合
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={syncOrders}
                disabled={syncing}
                className="gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                同步Ozon
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => openBatchDialog()}
              >
                批量录入
              </Button>
            </div>
          </div>

          {/* 订单视图 */}
          <div className="flex-1 overflow-auto">
            {viewMode === 'list' ? (
              /* 列表模式 */
              <div className="p-3 space-y-2">
                {filteredOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-4xl mb-2">📋</p>
                    <p className="text-gray-400">暂无待采购订单</p>
                    <p className="text-xs text-gray-300 mt-1">Ozon新订单将自动同步到此处</p>
                  </div>
                ) : (filteredOrders as any[]).map((order) => {
                  const deadline = (order as any).shippingDeadline ? new Date((order as any).shippingDeadline) : null;
                  const hoursLeft = deadline ? (deadline.getTime() - Date.now()) / 3600000 : null;
                  const urgency = hoursLeft !== null
                    ? hoursLeft < 12 ? 'urgent' : hoursLeft < 24 ? 'warning' : 'normal'
                    : 'normal';
                  return (
                    <div key={order.id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                        selectedOrder?.id === order.id
                          ? 'border-blue-500 bg-blue-50'
                          : urgency === 'urgent'
                            ? 'border-red-200 bg-red-50/50 hover:border-red-300'
                            : urgency === 'warning'
                              ? 'border-orange-200 bg-orange-50/50 hover:border-orange-300'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* 紧迫度badge */}
                          {urgency !== 'normal' && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              urgency === 'urgent' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                            }`}>
                              {hoursLeft !== null ? formatCountdown(hoursLeft) : '紧急'}
                            </span>
                          )}
                          <div>
                            <p className="font-medium text-sm text-gray-800">{order.postingNumber || order.ozonOrderId}</p>
                            <p className="text-xs text-gray-500">{order.products[0]?.name || order.products[0]?.sku || '-'} × {order.products[0]?.quantity || 1}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm text-gray-800">{formatCNY(Number(order.totalPrice) * rubToCny)}</p>
                          {urgency === 'normal' && hoursLeft !== null && (
                            <p className="text-xs text-gray-400">{formatCountdown(hoursLeft)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* SKU聚合模式 */
              <div className="p-3 space-y-3">
                {Object.keys(skuGroups).length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-4xl mb-2">📋</p>
                    <p className="text-gray-400">暂无待采购订单</p>
                  </div>
                ) : Object.entries(skuGroups).map(([key, group]: [string, any]) => {
                  const minDeadline = Math.min(...(group.orders as any[]).map((i: any) =>
                    i.shippingDeadline ? new Date(i.shippingDeadline).getTime() : Infinity
                  ));
                  const hoursLeft = minDeadline === Infinity ? null : (minDeadline - Date.now()) / 3600000;
                  const urgency = hoursLeft !== null
                    ? hoursLeft < 12 ? 'urgent' : hoursLeft < 24 ? 'warning' : 'normal'
                    : 'normal';
                  return (
                    <div key={key} className={`p-4 rounded-lg border-2 transition-all ${
                      urgency === 'urgent' ? 'border-red-200 bg-red-50/50'
                        : urgency === 'warning' ? 'border-orange-200 bg-orange-50/50'
                        : 'border-gray-200 bg-white'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {group.image && (
                            <img src={group.image} className="w-10 h-10 rounded object-cover" />
                          )}
                          <div>
                            <p className="font-medium text-sm text-gray-800">{group.name || key}</p>
                            <p className="text-xs text-gray-400">{key} · {group.count}单待采购</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {urgency !== 'normal' && hoursLeft !== null && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              urgency === 'urgent' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                            }`}>
                              {formatCountdown(hoursLeft)}
                            </span>
                          )}
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => openBatchDialog(group.orders as any[])}>
                            一键全采购 →
                          </Button>
                        </div>
                      </div>
                      {/* 子订单列表 */}
                      <div className="space-y-1 mt-2">
                        {(group.orders as any[]).map((item: any) => {
                          const itemDeadline = (item as any).shippingDeadline ? new Date((item as any).shippingDeadline) : null;
                          const itemHours = itemDeadline ? (itemDeadline.getTime() - Date.now()) / 3600000 : null;
                          return (
                            <div key={item.id}
                              className="flex items-center justify-between text-xs py-1 px-2 bg-white/50 rounded hover:bg-white cursor-pointer"
                              onClick={() => setSelectedOrder(item)}>
                              <span className="text-gray-600">{item.postingNumber || item.ozonOrderId} × {item.products[0]?.quantity || 1}</span>
                              <span className={`font-medium ${
                                itemHours !== null && itemHours < 12 ? 'text-red-600' : itemHours !== null && itemHours < 24 ? 'text-orange-600' : 'text-gray-400'
                              }`}>
                                {itemHours !== null ? formatCountdown(itemHours) : '-'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 右栏：采购录入 (40%) */}
        <div className="w-[40%] bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          {/* 通知提示 */}
          {notify && (
            <div className={`mx-4 mt-3 px-4 py-2 rounded-lg text-sm ${
              notify.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {notify.msg}
            </div>
          )}

          {selectedOrder ? (
            <>
              {/* 选中订单信息 */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {selectedOrder.products[0]?.image && (
                    <img
                      src={selectedOrder.products[0].image}
                      alt={selectedOrder.products[0]?.name}
                      className="w-12 h-12 rounded object-cover border border-gray-200"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#152033] truncate">
                      {selectedOrder.products[0]?.name || selectedOrder.postingNumber}
                    </div>
                    <div className="text-xs text-[#637089]">
                      SKU: {selectedOrder.products[0]?.sku || '-'}
                    </div>
                    <div className="text-xs font-medium text-orange-500 mt-0.5">
                      {(Number(selectedOrder.totalPrice) * rubToCny).toFixed(2)} ¥
                    </div>
                  </div>
                </div>
              </div>

              {/* 表单区域 */}
              <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* 快递单号 */}
                <div>
                  <label className="block text-xs font-medium text-[#637089] mb-1.5">快递单号 *</label>
                  <div className="relative">
                    <Input
                      ref={trackingInputRef}
                      placeholder="扫描或输入快递单号"
                      value={trackingNo}
                      onChange={(e) => setTrackingNo(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && trackingNo) {
                          handlePurchaseSubmit(false);
                        }
                      }}
                      className="font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      title="扫码枪输入"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 采购价 */}
                <div>
                  <label className="block text-xs font-medium text-[#637089] mb-1.5">采购价 (¥) *</label>
                  <Input
                    ref={priceInputRef}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && purchasePrice && trackingNo) {
                        handlePurchaseSubmit(false);
                      }
                    }}
                    className="text-sm font-medium"
                  />
                  {lastPurchase?.purchasePrice && (
                    <p className="text-xs text-green-600 mt-1">
                      ↑ 上次: {formatCNY(lastPurchase.purchasePrice)} ← 自动填充
                    </p>
                  )}
                </div>

                {/* 采购平台 */}
                <div>
                  <label className="block text-xs font-medium text-[#637089] mb-1.5">采购平台</label>
                  <select
                    value={purchasePlatform}
                    onChange={(e) => setPurchasePlatform(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="1688">1688</option>
                    <option value="pinduoduo">拼多多</option>
                    <option value="taobao">淘宝</option>
                    <option value="manual">手动录入</option>
                  </select>
                </div>

                {/* 供应商名称 */}
                <div>
                  <label className="block text-xs font-medium text-[#637089] mb-1.5">供应商名称</label>
                  <Input
                    placeholder="选填"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="text-sm"
                  />
                  {lastPurchase?.supplierName && (
                    <p className="text-xs text-green-600 mt-1">
                      ↑ 上次: {lastPurchase.supplierName} ← 自动填充
                    </p>
                  )}
                </div>

                {/* 采购链接（选填） */}
                <div>
                  <label className="block text-xs font-medium text-[#637089] mb-1.5">采购链接 <span className="text-gray-300">选填</span></label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={purchaseUrl}
                    onChange={(e) => setPurchaseUrl(e.target.value)}
                    className="text-sm font-mono"
                  />
                </div>

                {/* 同SKU历史采购 */}
                {historyList.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-400 text-center mb-2">── 该SKU历史采购 ──</p>
                    <div className="space-y-1 max-h-32 overflow-auto">
                      {historyList.slice(0, 5).map((h, i) => (
                        <div key={i} className="flex items-center justify-between text-xs px-2 py-1 bg-gray-50 rounded">
                          <span className="text-gray-500">{h.date || h.createdAt?.slice(0, 10)}</span>
                          <span className="text-gray-600 truncate mx-1">{h.supplierName}</span>
                          <span className="text-gray-700 font-medium shrink-0">{formatCNY(h.purchasePrice)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="px-4 py-3 border-t border-gray-200 flex gap-2">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => handlePurchaseSubmit(false)}
                  disabled={!purchasePrice || !trackingNo || submitting}
                >
                  {submitting ? '提交中...' : '确认采购'}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                  onClick={() => handlePurchaseSubmit(true)}
                  disabled={!purchasePrice || !trackingNo || submitting}
                >
                  确认并下一单 →
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm">
              <Package className="w-12 h-12 mb-2 opacity-30" />
              <p className="mb-1">← 请从左侧选择订单</p>
              <p className="text-xs text-gray-300">或使用扫码枪扫描快递单号</p>
            </div>
          )}

          {/* 批量录入入口 */}
          <div className="px-4 py-3 border-t border-gray-200">
            <Button
              variant="ghost"
              className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs"
              onClick={() => openBatchDialog()}
            >
              <ClipboardList className="w-4 h-4 mr-1.5" />
              批量录入快递号
            </Button>
          </div>
        </div>

      </div>

          {/* 批量录入弹窗 - 表格形式 */}
          <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader className="shrink-0">
                <div className="flex items-center justify-between pr-8">
                  <div>
                    <DialogTitle>{selectedSkuOrders.length > 0 ? 'SKU批量采购' : '批量录入'}</DialogTitle>
                    <p className="text-xs text-[#637089] mt-1">{batchItems.length}笔订单待录入</p>
                  </div>
                </div>
              </DialogHeader>

              {/* 公共采购信息区（仅SKU批量时显示） */}
              {selectedSkuOrders.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 grid grid-cols-3 gap-3 shrink-0">
                  <p className="col-span-3 text-xs font-medium text-blue-700 mb-1">公共采购信息（将应用到所有订单）</p>
                  <select
                    value={batchPlatform}
                    onChange={(e) => setBatchPlatform(e.target.value)}
                    className="px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white focus:outline-none"
                  >
                    <option value="1688">1688</option>
                    <option value="pinduoduo">拼多多</option>
                    <option value="taobao">淘宝</option>
                    <option value="manual">手动录入</option>
                  </select>
                  <input
                    value={batchSupplier}
                    onChange={(e) => setBatchSupplier(e.target.value)}
                    placeholder="公共供应商"
                    className="px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white focus:outline-none"
                  />
                  <input
                    value={batchPurchaseUrl}
                    onChange={(e) => setBatchPurchaseUrl(e.target.value)}
                    placeholder="采购链接（可选）"
                    className="px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white focus:outline-none"
                  />
                </div>
              )}

              {/* 逐行录入表格 */}
              <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-[#637089] font-medium w-8"></th>
                      <th className="px-3 py-2 text-left text-[#637089] font-medium">订单号</th>
                      <th className="px-3 py-2 text-left text-[#637089] font-medium">商品</th>
                      <th className="px-3 py-2 text-left text-[#637089] font-medium w-40">快递单号 *</th>
                      <th className="px-3 py-2 text-left text-[#637089] font-medium w-28">采购价(¥) *</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchItems.map((item: any, idx: number) => {
                      const isFilled = item.expressNo && item.purchasePrice;
                      return (
                        <tr key={item.orderId || idx} className={`border-t border-gray-100 ${isFilled ? 'bg-green-50/50' : ''}`}>
                          <td className="px-3 py-2">
                            {isFilled && <span className="text-green-500 font-bold">✓</span>}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-[#152033]">{item.orderNo}</td>
                          <td className="px-3 py-2 text-[#637089] text-xs">{item.productName} ×{item.quantity}</td>
                          <td className="px-3 py-2">
                            <input
                              value={item.expressNo}
                              onChange={(e) => {
                                const newItems = [...batchItems];
                                newItems[idx] = { ...newItems[idx], expressNo: e.target.value };
                                setBatchItems(newItems);
                              }}
                              placeholder="快递单号"
                              className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={item.purchasePrice}
                              onChange={(e) => {
                                const newItems = [...batchItems];
                                newItems[idx] = { ...newItems[idx], purchasePrice: e.target.value };
                                setBatchItems(newItems);
                              }}
                              placeholder="¥"
                              className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 统一采购价快捷填充（仅SKU批量时） */}
              {selectedSkuOrders.length > 0 && (
                <div className="mt-3 flex items-center gap-3 text-xs text-[#637089] shrink-0">
                  <span>统一采购价:</span>
                  <input
                    placeholder="输入后回车批量填充"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value;
                        setBatchItems((prev: any[]) => prev.map(item => ({ ...item, purchasePrice: val })));
                      }
                    }}
                    className="w-32 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                  />
                  <span className="text-gray-400">回车填充所有行</span>
                </div>
              )}

              {/* 底部操作栏 */}
              <div className="flex items-center justify-between pt-4 shrink-0">
                <p className="text-sm text-[#637089]">
                  已填写 {batchItems.filter((i: any) => i.expressNo && i.purchasePrice).length} / {batchItems.length} 笔
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowBatchDialog(false)}>取消</Button>
                  <Button
                    disabled={
                      batchItems.filter((i: any) => i.expressNo && i.purchasePrice).length === 0
                      || batchSubmitting
                    }
                    onClick={handleBatchSubmit}
                  >
                    {batchSubmitting ? '提交中...' : `确认提交 (${batchItems.filter((i: any) => i.expressNo && i.purchasePrice).length}笔)`}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* 订单详情弹窗 - 居中铺满 */}
          <Dialog open={!!detailOrder} onOpenChange={(open) => !open && setDetailOrder(null)}>
            <DialogContent className="w-screen h-screen max-w-none !max-w-none p-0 gap-0 grid-cols-1 [&>button]:hidden overflow-hidden">
              {detailOrder && (
     <div className="w-full h-full flex flex-col">
       {/* 顶部标题栏 */}
       <div className="px-8 py-4 border-b border-[#E6EAF2] flex items-center justify-between shrink-0 bg-white">
         <div className="text-lg font-semibold text-[#152033]">
           包裹「{detailOrder.postingNumber}」详情 - 来源于「Ozon」
         </div>
         <button 
           onClick={() => setDetailOrder(null)}
           className="p-2 rounded-full hover:bg-gray-100 transition-colors"
         >
           <X className="w-5 h-5 text-[#637089]" />
         </button>
       </div>

       {/* 内容区域 - 铺满剩余空间 */}
       <div className="flex-1 min-h-0 p-4 overflow-auto bg-[#F6F8FB]">
         {/* 基础信息区 */}
         <div className="bg-white rounded-lg border border-[#E6EAF2] p-6 mb-6">
           <div className="grid grid-cols-4 gap-6 text-sm">
             <div>
               <div className="text-[#637089] mb-2">买家信息</div>
               <div className="font-medium text-[#152033]">{detailOrder.buyerName || '-'}</div>
             </div>
             <div>
               <div className="text-[#637089] mb-2">店铺</div>
               <div className="font-medium text-[#152033]">{detailOrder.shopName}</div>
             </div>
             <div>
               <div className="text-[#637089] mb-1">包裹总额</div>
               <div className="font-medium text-[#152033]">
                 CNY {(parseFloat(detailOrder.totalPrice || '0') * rubToCny).toFixed(2)}
               </div>
             </div>
             <div>
               <div className="text-[#637089] mb-2">采购状态</div>
               <Badge className={purchaseStatusMap[detailOrder.purchaseStatus]?.color || 'bg-gray-100 text-gray-700'}>
                 {purchaseStatusMap[detailOrder.purchaseStatus]?.label || '未知'}
               </Badge>
             </div>
           </div>
         </div>

         {/* 订单流程进度条 */}
         <div className="bg-white rounded-lg border border-[#E6EAF2] p-6 mb-6">
           <div className="flex items-center justify-between text-sm">
             {[
               { label: '待采购', status: detailOrder.purchaseStatus === 'awaiting' },
               { label: '已采购', status: detailOrder.purchaseStatus === 'purchased' },
               { label: '待发货', status: false },
               { label: '已发货', status: false },
               { label: '已送达', status: detailOrder.purchaseStatus === 'delivered' },
             ].map((step, idx, arr) => (
               <div key={idx} className="flex items-center">
                 <div className={`flex items-center gap-2 ${step.status ? 'text-[#2F6BFF]' : 'text-[#637089]'}`}>
                   {step.status ? (
                     <Check className="w-5 h-5" />
                   ) : (
                     <AlertCircle className="w-5 h-5" />
                   )}
                   <span className={step.status ? 'font-medium' : ''}>{step.label}</span>
                 </div>
                 {idx < arr.length - 1 && (
                   <div className="w-12 h-px bg-[#E6EAF2] mx-4" />
                 )}
               </div>
             ))}
           </div>
         </div>

         {/* 左右分栏布局 - 占据剩余空间 */}
         <div className="flex gap-4 flex-1 min-h-0">
           {/* 左侧导航 */}
           <div className="w-48 flex-shrink-0">
             <div className="bg-white rounded-lg border border-[#E6EAF2] overflow-hidden">
               <div className="p-4 bg-[#F6F8FB] border-b border-[#E6EAF2] text-sm font-medium text-[#152033]">
                 订单信息
               </div>
               <div className="divide-y divide-[#E6EAF2]">
                 <div className="p-4 flex items-center gap-3 text-sm bg-blue-50 text-[#2F6BFF]">
                   <MapPin className="w-5 h-5" />
                   <span>订单详情</span>
                 </div>
                 <div className="p-4 flex items-center gap-3 text-sm text-[#637089]">
                   <FileText className="w-5 h-5" />
                   <span>采购信息</span>
                 </div>
                 <div className="p-4 flex items-center gap-3 text-sm text-[#637089]">
                   <Truck className="w-5 h-5" />
                   <span>物流信息</span>
                 </div>
               </div>
             </div>
           </div>

           {/* 右侧详情 */}
           <div className="flex-1">
             {/* 订单详情卡片 */}
             <div className="bg-white rounded-lg border border-[#E6EAF2] mb-6">
               <div className="p-4 bg-[#F6F8FB] border-b border-[#E6EAF2] flex items-center justify-between">
                 <span className="text-sm font-medium text-[#152033]">订单详情</span>
                 <span className="text-xs text-[#637089]">订单号: {detailOrder.postingNumber}</span>
               </div>
               <div className="p-6 space-y-6">
                 {/* 订单基本信息 */}
                 <div className="grid grid-cols-3 gap-6 text-sm">
                   <div>
                     <div className="text-[#637089] mb-2">Ozon订单号</div>
                     <div className="font-medium text-[#152033]">{detailOrder.ozonOrderId}</div>
                   </div>
                   <div>
                     <div className="text-[#637089] mb-1">发货单号</div>
                     <div className="font-medium text-[#152033]">{detailOrder.postingNumber}</div>
                   </div>
                   <div>
                     <div className="text-[#637089] mb-1">订单状态</div>
                     <Badge className={statusMap[detailOrder.status]?.color || 'bg-gray-100 text-gray-700'}>
                       {statusMap[detailOrder.status]?.label || detailOrder.status}
                     </Badge>
                   </div>
                 </div>

                 {/* 商品信息 */}
                 <div className="border-t border-[#E6EAF2] pt-4">
                   <div className="text-sm font-medium text-[#152033] mb-3">订单产品</div>
                   {detailOrder.products?.map((product, idx) => (
                     <div key={idx} className="flex items-start gap-4 p-3 bg-[#F6F8FB] rounded-lg mb-2">
                       {product.image ? (
                         <ProductImage src={product.image} size="md" />
                       ) : (
                         <div className="w-12 h-12 rounded bg-white flex items-center justify-center">
                           <ImageIcon className="w-6 h-6 text-[#637089]" />
                         </div>
                       )}
                       <div className="flex-1">
                         <div className="text-sm font-medium text-[#152033]">{product.name}</div>
                         <div className="text-xs text-[#637089] mt-1">
                           SKU: {product.sku} | 数量: ×{product.quantity} | 单价: {product.price} 卢布
                         </div>
                       </div>
                       <div className="text-right">
                         <div className="text-sm font-medium text-[#152033]">
                           CNY {(parseFloat(product.price || '0') * rubToCny).toFixed(2)}
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             </div>

             {/* 采购信息卡片 */}
             <div className="bg-white rounded-lg border border-[#E6EAF2]">
               <div className="p-3 bg-[#F6F8FB] border-b border-[#E6EAF2]">
                 <span className="text-sm font-medium text-[#152033]">采购信息</span>
               </div>
               <div className="p-4 space-y-4">
                 <div className="grid grid-cols-3 gap-4 text-sm">
                   <div>
                     <div className="text-[#637089] mb-1">销售金额</div>
                     <div className="font-medium text-[#152033]">
                       CNY {(parseFloat(detailOrder.totalPrice || '0') * rubToCny).toFixed(2)}
                     </div>
                   </div>
                   <div>
                     <div className="text-[#637089] mb-2">采购价 (CNY)</div>
                     <div className="flex items-center gap-2">
                       <Input
                         type="number"
                         step="0.01"
                         value={editingPurchasePrice}
                         onChange={(e) => setEditingPurchasePrice(e.target.value)}
                         placeholder="输入采购价"
                         className="w-28 h-8"
                       />
                       <Button
                         size="sm"
                         onClick={() => {
                           const price = parseFloat(editingPurchasePrice);
                           if (!isNaN(price) && price >= 0) {
                             updatePurchasePrice(detailOrder.id, price);
                           }
                         }}
                         disabled={savingPrice || !editingPurchasePrice}
                       >
                         {savingPrice ? '保存中...' : '保存'}
                       </Button>
                     </div>
                   </div>
                   <div>
                     <div className="text-[#637089] mb-1">预估利润</div>
                     {detailOrder.purchasePrice ? (
                       <div className={`font-bold text-lg ${(parseFloat(detailOrder.totalPrice || '0') * rubToCny - (parseFloat(String(detailOrder.purchasePrice)) || 0)) >= 0 ? 'text-[#16A37B]' : 'text-red-500'}`}>
                         CNY {(parseFloat(detailOrder.totalPrice || '0') * rubToCny - (parseFloat(String(detailOrder.purchasePrice)) || 0)).toFixed(2)}
                       </div>
                     ) : (
                       <div className="text-[#637089]">请先录入采购价</div>
                     )}
                   </div>
                 </div>

                 {/* 利润明细 */}
                 {detailOrder.purchasePrice && (
                   <div className="border-t border-[#E6EAF2] pt-4">
                     <div className="text-sm font-medium text-[#152033] mb-3">利润明细</div>
                     <div className="bg-[#ECFDF5] rounded-lg p-4 space-y-2 text-sm">
                       <div className="flex justify-between">
                         <span className="text-[#637089]">销售收入</span>
                         <span className="font-medium">CNY {(parseFloat(detailOrder.totalPrice || '0') * rubToCny).toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between">
                         <span className="text-[#637089]">采购成本</span>
                         <span className="font-medium text-red-500">-CNY {(parseFloat(String(detailOrder.purchasePrice)) || 0).toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between pt-2 border-t border-[#E6EAF2]">
                         <span className="font-medium">预估利润</span>
                         <span className={`font-bold ${(parseFloat(detailOrder.totalPrice || '0') * rubToCny - (parseFloat(String(detailOrder.purchasePrice)) || 0)) >= 0 ? 'text-[#16A37B]' : 'text-red-500'}`}>
                           CNY {(parseFloat(detailOrder.totalPrice || '0') * rubToCny - (parseFloat(String(detailOrder.purchasePrice)) || 0)).toFixed(2)}
                         </span>
                       </div>
                     </div>
                   </div>
                 )}
               </div>
             </div>
           </div>
         </div>
       </div>

       {/* 底部操作栏 */}
       <div className="px-6 py-4 border-t border-[#E6EAF2] bg-[#F6F8FB] flex items-center justify-end gap-3">
         <Button 
           variant="outline" 
           className="border-orange-500 text-orange-500 hover:bg-orange-50"
           onClick={() => {
             // 标记为已采购
             const price = parseFloat(editingPurchasePrice);
             if (!isNaN(price) && price >= 0) {
               updatePurchasePrice(detailOrder.id, price);
             }
           }}
         >
           <CheckCircle className="w-4 h-4 mr-2" />
           标记已采购
         </Button>
         <Button onClick={() => setDetailOrder(null)}>
           关闭
         </Button>
       </div>
     </div>
              )}
            </DialogContent>
          </Dialog>
    </AppLayout>
  );
}