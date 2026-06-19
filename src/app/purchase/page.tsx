'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  Search,
  ImageIcon,
  Package,
  Truck,
  PackageSearch,
  Warehouse,
  Database,
  Users,
  BarChart3,
  UserCircle,
  Shield,
  Settings,
  LayoutDashboard,
  Calculator,
  Eye,
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
}

const erpStatusMap: Record<string, { label: string; color: string }> = {
  pending_purchase: { label: '待采购', color: 'bg-orange-100 text-orange-700' },
  pending_inspect: { label: '待验货', color: 'bg-blue-100 text-blue-700' },
  pending_pack: { label: '待打包', color: 'bg-purple-100 text-purple-700' },
  shipped: { label: '已发货', color: 'bg-green-100 text-green-700' },
  delivered: { label: '已送达', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700' },
};

const ozonStatusMap: Record<string, { label: string; color: string }> = {
  awaiting_packaging: { label: '待打包', color: 'bg-blue-100 text-blue-700' },
  awaiting_deliver: { label: '待发货', color: 'bg-yellow-100 text-yellow-700' },
  delivering: { label: '配送中', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: '已送达', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700' },
};

function ProductImage({ src }: { src: string }) {
  const [error, setError] = useState(false);
  if (error || !src) {
    return (
      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
        <ImageIcon className="w-4 h-4 text-gray-400" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="商品"
      className="w-10 h-10 rounded object-cover"
      onError={() => setError(true)}
    />
  );
}

export default function PurchasePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rubToCny, setRubToCny] = useState(0.0923);
  const [notify, setNotify] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selectedTab, setSelectedTab] = useState('pending');

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
        toast(`同步完成`);
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

  // 格式化金额
  const formatCNY = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined) return '¥0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '¥0.00';
    return `¥${num.toFixed(2)}`;
  };

  // Tab配置
  const tabs = [
    { key: 'pending', label: '待采购', filter: 'pending_purchase', erp: true },
    { key: 'inspecting', label: '待验货', filter: 'pending_inspect', erp: true },
    { key: 'packing', label: '待打包', filter: 'pending_pack', erp: true },
    { key: 'all', label: '全部', filter: '', erp: false },
  ];

  const currentFilter = tabs.find(t => t.key === selectedTab)?.filter || '';

  const filteredOrders = orders.filter(order => {
    if (!currentFilter) return true;
    return order.erpStatus === currentFilter;
  }).filter(order => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (order.ozonOrderId || '').toLowerCase().includes(q) ||
      (order.ozonPostingNumber || '').toLowerCase().includes(q) ||
      (order.recipientCity || '').toLowerCase().includes(q) ||
      order.products.some(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
    );
  });

  // 统计数据
  const stats = {
    pending: orders.filter(o => o.erpStatus === 'pending_purchase').length,
    inspecting: orders.filter(o => o.erpStatus === 'pending_inspect').length,
    packing: orders.filter(o => o.erpStatus === 'pending_pack').length,
    shipped: orders.filter(o => o.erpStatus === 'shipped').length,
    total: orders.length,
  };

  return (
    <AppLayout title="采购管理" subtitle="Ozon FBS 订单同步与状态追踪">
      {notify && (
        <div className={`mx-4 mt-2 px-4 py-2 rounded-lg text-sm ${
          notify.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {notify.msg}
        </div>
      )}

      {/* 统计卡片 */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-white rounded-lg border border-[#E6EAF2] p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-[#637089]">待采购</p>
              <p className="text-xl font-bold text-[#152033]">{stats.pending}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-[#E6EAF2] p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[#637089]">待验货</p>
              <p className="text-xl font-bold text-[#152033]">{stats.inspecting}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-[#E6EAF2] p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-[#637089]">待打包</p>
              <p className="text-xl font-bold text-[#152033]">{stats.packing}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-[#E6EAF2] p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Truck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-[#637089]">已发货</p>
              <p className="text-xl font-bold text-[#152033]">{stats.shipped}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-[#E6EAF2] p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Database className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-[#637089]">全部订单</p>
              <p className="text-xl font-bold text-[#152033]">{stats.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="px-4 pb-3 flex items-center gap-3">
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

        {/* Tab切换 */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
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
          className="ml-auto gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '同步中...' : '同步Ozon'}
        </Button>
      </div>

      {/* 订单列表 */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-lg border border-[#E6EAF2] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-[#637089]">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#637089]">
              <Package className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-sm">暂无订单</p>
              <p className="text-xs text-gray-300 mt-1">点击「同步Ozon」获取最新订单</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F6F8FB] border-b border-[#E6EAF2]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[#637089] font-medium">订单号</th>
                    <th className="px-4 py-3 text-left text-[#637089] font-medium">店铺</th>
                    <th className="px-4 py-3 text-left text-[#637089] font-medium">商品</th>
                    <th className="px-4 py-3 text-right text-[#637089] font-medium">订单金额</th>
                    <th className="px-4 py-3 text-center text-[#637089] font-medium">Ozon状态</th>
                    <th className="px-4 py-3 text-center text-[#637089] font-medium">ERP状态</th>
                    <th className="px-4 py-3 text-left text-[#637089] font-medium">收件城市</th>
                    <th className="px-4 py-3 text-left text-[#637089] font-medium">下单时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EAF2]">
                  {filteredOrders.map(order => {
                    const statusInfo = ozonStatusMap[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700' };
                    const erpInfo = erpStatusMap[order.erpStatus] || { label: order.erpStatus, color: 'bg-gray-100 text-gray-700' };
                    const product = order.products[0];
                    return (
                      <tr key={order.id} className="hover:bg-[#F6F8FB]/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#152033] font-mono text-xs">
                            {order.ozonPostingNumber || order.ozonOrderId}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#637089] text-xs">
                          {order.shopName || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {product?.image && <ProductImage src={product.image} />}
                            <div className="min-w-0">
                              <div className="text-[#152033] text-xs truncate max-w-[200px]">
                                {product?.name || '-'}
                              </div>
                              <div className="text-[#637089] text-xs">
                                SKU: {product?.sku || '-'} × {product?.quantity || 1}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-medium text-[#152033]">
                            {formatCNY(parseFloat(order.totalPrice || '0') * rubToCny)}
                          </div>
                          <div className="text-xs text-[#637089]">
                            {order.totalPrice} {order.currency || 'RUB'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={erpInfo.color}>
                            {erpInfo.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-[#637089] text-xs">
                          {order.recipientCity || '-'}
                        </td>
                        <td className="px-4 py-3 text-[#637089] text-xs whitespace-nowrap">
                          {order.ozonCreatedAt ? new Date(order.ozonCreatedAt).toLocaleDateString('zh-CN') : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
