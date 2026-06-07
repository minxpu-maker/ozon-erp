'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  { href: '/quick-entry', icon: ClipboardList, label: '快捷录单' },
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
  createdAt: string;
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

  // 统计数据
  const stats = {
    awaiting: orders.filter(o => o.purchaseStatus === 'awaiting').length,
    purchased: orders.filter(o => o.purchaseStatus === 'purchased').length,
    delivered: orders.filter(o => o.purchaseStatus === 'delivered').length,
    total: orders.length,
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
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data.orders || []);
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

  // 打开详情
  const openDetail = (order: Order) => {
    setDetailOrder(order);
    setEditingPurchasePrice(order.purchasePrice || '');
  };

  // 筛选订单
  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    return order.ozonOrderId.includes(searchQuery) || 
           order.postingNumber.includes(searchQuery);
  });

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex">
      {/* 左侧导航栏 */}
      <aside className="w-56 bg-white border-r border-[#E6EAF2] flex flex-col fixed left-0 top-0 bottom-0 z-20">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-[#E6EAF2]">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#2F6BFF] flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-[#152033]">Ozon ERP</span>
          </Link>
        </div>
        
        {/* 导航菜单 */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map((item, index) => {
            if (item.type === 'divider') {
              return (
                <div key={`divider-${index}`} className="px-5 py-2">
                  <div className="text-[10px] font-medium text-[#637089] uppercase tracking-wider">
                    {item.label}
                  </div>
                </div>
              );
            }
            const Icon = item.icon!;
            return (
              <Link
                key={item.href!}
                href={item.href!}
                className={`flex items-center gap-2.5 px-5 py-2 text-sm transition-colors ${
                  item.active
                    ? 'text-[#2F6BFF] bg-[#2F6BFF]/5 font-medium'
                    : 'text-[#637089] hover:text-[#152033] hover:bg-[#F6F8FB]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 ml-56 flex flex-col">
        {/* 顶部导航栏 */}
        <header className="h-14 bg-white border-b border-[#E6EAF2] flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-[#152033]">采购管理</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings">系统设置</Link>
            </Button>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 p-6 overflow-auto">

      {/* 统计卡片 - 紧凑布局 */}
      <div className="px-6 py-3">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-7 h-7 text-orange-500" />
            <div>
              <div className="text-xs text-[#637089]">待采购</div>
              <div className="text-lg font-semibold text-[#152033]">{stats.awaiting}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-blue-500" />
            <div>
              <div className="text-xs text-[#637089]">已采购</div>
              <div className="text-lg font-semibold text-[#152033]">{stats.purchased}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-7 h-7 text-green-500" />
            <div>
              <div className="text-xs text-[#637089]">已送达</div>
              <div className="text-lg font-semibold text-[#152033]">{stats.delivered}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Package className="w-7 h-7 text-gray-400" />
            <div>
              <div className="text-xs text-[#637089]">订单总数</div>
              <div className="text-lg font-semibold text-[#152033]">{stats.total}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="px-6 py-3 bg-white border-y border-[#E6EAF2]">
        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#637089]" />
              <input
                type="text"
                placeholder="搜索订单号..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-[#E6EAF2] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-[#E6EAF2] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">全部状态</option>
              <option value="awaiting_deliver">待采购</option>
              <option value="awaiting_packaging">已采购</option>
              <option value="delivered">已送达</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={syncOrders} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              同步订单
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              导出
            </Button>
          </div>
        </div>
      </div>

      {/* 订单列表 */}
      <div className="px-6 py-4">
        <div className="bg-white rounded-lg border border-[#E6EAF2] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F6F8FB] text-left text-xs text-[#637089]">
                <th className="w-12"></th>
                <th className="px-4 py-3 font-medium">订单号</th>
                <th className="px-4 py-3 font-medium">发货单号</th>
                <th className="px-4 py-3 font-medium">商品</th>
                <th className="px-4 py-3 font-medium">店铺</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">销售金额</th>
                <th className="px-4 py-3 font-medium">采购价</th>
                <th className="px-4 py-3 font-medium">下单时间</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF2]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-[#637089]">
                    加载中...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-[#637089]">
                    暂无订单
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[#152033]">
                      {order.ozonOrderId}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#637089]">
                      {order.postingNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {order.products?.[0]?.image ? (
                          <ProductImage src={order.products[0].image} />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <span className="text-sm text-[#152033] truncate max-w-[120px]">
                          {order.products?.[0]?.name || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{order.shopName}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusMap[order.status]?.color || 'bg-gray-100 text-gray-700'}>
                        {statusMap[order.status]?.label || order.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[#152033]">
                      ¥{(parseFloat(order.totalPrice || '0') * rubToCny).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {order.purchasePrice ? (
                        <span className="text-[#16A37B]">¥{(parseFloat(String(order.purchasePrice)) || 0).toFixed(2)}</span>
                      ) : (
                        <span className="text-[#637089]">未录入</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#637089]">
                      {new Date(order.createdAt).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).replace(/\//g, '/')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openDetail(order)}
                        className="p-1.5 rounded-full hover:bg-gray-100"
                      >
                        <Eye className="w-4 h-4 text-[#637089]" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 订单详情弹窗 - 居中铺满 */}
      <Dialog open={!!detailOrder} onOpenChange={(open) => !open && setDetailOrder(null)}>
        <DialogContent className="w-[130vw] h-screen max-w-none p-0 gap-0 grid-cols-1 [&>button]:hidden overflow-hidden">
          {detailOrder && (
            <div className="w-full h-full flex flex-col">
              {/* 顶部标题栏 */}
              <div className="px-6 py-4 border-b border-[#E6EAF2] flex items-center justify-between shrink-0">
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
              <div className="flex-1 min-h-0 p-6 overflow-hidden flex flex-col">
                {/* 基础信息区 */}
                <div className="bg-white rounded-lg border border-[#E6EAF2] p-4 mb-4">
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-[#637089] mb-1">买家信息</div>
                      <div className="font-medium text-[#152033]">{detailOrder.buyerName || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[#637089] mb-1">店铺</div>
                      <div className="font-medium text-[#152033]">{detailOrder.shopName}</div>
                    </div>
                    <div>
                      <div className="text-[#637089] mb-1">包裹总额</div>
                      <div className="font-medium text-[#152033]">
                        CNY {(parseFloat(detailOrder.totalPrice || '0') * rubToCny).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#637089] mb-1">采购状态</div>
                      <Badge className={purchaseStatusMap[detailOrder.purchaseStatus]?.color || 'bg-gray-100 text-gray-700'}>
                        {purchaseStatusMap[detailOrder.purchaseStatus]?.label || '未知'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* 订单流程进度条 */}
                <div className="bg-white rounded-lg border border-[#E6EAF2] p-4 mb-4">
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
                      <div className="p-3 bg-[#F6F8FB] border-b border-[#E6EAF2] text-sm font-medium text-[#152033]">
                        订单信息
                      </div>
                      <div className="divide-y divide-[#E6EAF2]">
                        <div className="p-3 flex items-center gap-2 text-sm bg-blue-50 text-[#2F6BFF]">
                          <MapPin className="w-4 h-4" />
                          <span>订单详情</span>
                        </div>
                        <div className="p-3 flex items-center gap-2 text-sm text-[#637089]">
                          <FileText className="w-4 h-4" />
                          <span>采购信息</span>
                        </div>
                        <div className="p-3 flex items-center gap-2 text-sm text-[#637089]">
                          <Truck className="w-4 h-4" />
                          <span>物流信息</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 右侧详情 */}
                  <div className="flex-1">
                    {/* 订单详情卡片 */}
                    <div className="bg-white rounded-lg border border-[#E6EAF2] mb-4">
                      <div className="p-3 bg-[#F6F8FB] border-b border-[#E6EAF2] flex items-center justify-between">
                        <span className="text-sm font-medium text-[#152033]">订单详情</span>
                        <span className="text-xs text-[#637089]">订单号: {detailOrder.postingNumber}</span>
                      </div>
                      <div className="p-4 space-y-4">
                        {/* 订单基本信息 */}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-[#637089] mb-1">Ozon订单号</div>
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
      </main>
      </div>
    </div>
  );
}
