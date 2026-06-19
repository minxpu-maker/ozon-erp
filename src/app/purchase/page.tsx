'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
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
  Users,
  BarChart3,
  UserCircle,
  Shield,
  Settings,
  LayoutDashboard,
  Calculator,
  Eye,
  ShoppingCart,
  FileText,
  X,
} from 'lucide-react';

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
      <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
        <ImageIcon className="w-5 h-5 text-gray-400" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="商品"
      className="w-12 h-12 rounded object-cover flex-shrink-0"
      onError={() => setError(true)}
    />
  );
}

// 计算发货倒计时
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

export default function PurchasePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rubToCny, setRubToCny] = useState(0.0923);
  const [notify, setNotify] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selectedTab, setSelectedTab] = useState('pending');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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

  // 选中订单处理
  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(prev => prev?.id === order.id ? null : order);
  };

  // 清空选中
  const handleClearSelection = () => {
    setSelectedOrder(null);
  };

  return (
    <AppLayout title="采购中心" subtitle="采购工作台">
      {/* Toast 通知 */}
      {notify && (
        <div className={`mx-4 mt-2 px-4 py-2 rounded-lg text-sm ${
          notify.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {notify.msg}
        </div>
      )}

      {/* 左右分栏布局 */}
      <div className="flex h-[calc(100vh-140px)]">
        {/* 左栏 - 任务列表 (60%) */}
        <div className="w-3/5 border-r border-[#E6EAF2] flex flex-col overflow-hidden">
          {/* 统计卡片 */}
          <div className="p-4 border-b border-[#E6EAF2] bg-white flex-shrink-0">
            <div className="grid grid-cols-5 gap-2">
              <div className="bg-orange-50 rounded-lg p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-[#637089]">待采购</p>
                  <p className="text-lg font-bold text-[#152033]">{stats.pending}</p>
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Eye className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-[#637089]">待验货</p>
                  <p className="text-lg font-bold text-[#152033]">{stats.inspecting}</p>
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-[#637089]">待打包</p>
                  <p className="text-lg font-bold text-[#152033]">{stats.packing}</p>
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-[#637089]">已发货</p>
                  <p className="text-lg font-bold text-[#152033]">{stats.shipped}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Database className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-[#637089]">全部</p>
                  <p className="text-lg font-bold text-[#152033]">{stats.total}</p>
                </div>
              </div>
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

              {/* Tab切换 */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                {tabs.map(tab => (
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
          </div>

          {/* 订单列表 */}
          <div className="flex-1 overflow-y-auto bg-white">
            {loading ? (
              <div className="flex items-center justify-center h-full text-[#637089]">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                加载中...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#637089]">
                <Package className="w-12 h-12 mb-3 text-gray-300" />
                <p className="text-sm">暂无订单</p>
                <p className="text-xs text-gray-300 mt-1">点击「同步」获取最新订单</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E6EAF2]">
                {filteredOrders.map(order => {
                  const statusInfo = ozonStatusMap[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700' };
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
                          ? 'bg-blue-50 border-l-4 border-l-[#2F6BFF]' 
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

        {/* 右栏 - 详情/表单区 (40%) */}
        <div className="w-2/5 flex flex-col overflow-hidden bg-[#F6F8FB]">
          {selectedOrder ? (
            <>
              {/* 右栏头部 */}
              <div className="p-4 bg-white border-b border-[#E6EAF2] flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[#152033]">订单详情</h3>
                    <p className="text-xs text-[#637089] mt-0.5 font-mono">
                      {selectedOrder.ozonPostingNumber || selectedOrder.ozonOrderId}
                    </p>
                  </div>
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

              {/* 右栏内容 - 可滚动 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* 商品信息 */}
                <div className="bg-white rounded-lg border border-[#E6EAF2] p-4">
                  <h4 className="text-sm font-medium text-[#152033] mb-3">商品信息</h4>
                  <div className="flex items-start gap-3">
                    <ProductImage src={selectedOrder.products[0]?.image || ''} />
                    <div className="flex-1">
                      <div className="text-sm text-[#152033]">
                        {selectedOrder.products[0]?.name || '-'}
                      </div>
                      <div className="text-xs text-[#637089] mt-1">
                        SKU: {selectedOrder.products[0]?.sku || '-'}
                      </div>
                      <div className="text-xs text-[#637089]">
                        数量: {selectedOrder.products[0]?.quantity || 1}
                      </div>
                    </div>
                  </div>
                  {selectedOrder.products.length > 1 && (
                    <div className="mt-3 pt-3 border-t border-[#E6EAF2]">
                      <p className="text-xs text-[#637089]">
                        还有 {selectedOrder.products.length - 1} 个商品...
                      </p>
                    </div>
                  )}
                </div>

                {/* 订单信息 */}
                <div className="bg-white rounded-lg border border-[#E6EAF2] p-4">
                  <h4 className="text-sm font-medium text-[#152033] mb-3">订单信息</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#637089]">店铺</span>
                      <span className="text-[#152033]">{selectedOrder.shopName || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">订单金额</span>
                      <span className="text-[#152033] font-medium">
                        {formatCNY(parseFloat(selectedOrder.totalPrice || '0') * rubToCny)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">Ozon状态</span>
                      <Badge className={ozonStatusMap[selectedOrder.status]?.color || 'bg-gray-100 text-gray-700'}>
                        {ozonStatusMap[selectedOrder.status]?.label || selectedOrder.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">ERP状态</span>
                      <Badge className={erpStatusMap[selectedOrder.erpStatus]?.color || 'bg-gray-100 text-gray-700'}>
                        {erpStatusMap[selectedOrder.erpStatus]?.label || selectedOrder.erpStatus}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">收件城市</span>
                      <span className="text-[#152033]">{selectedOrder.recipientCity || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">下单时间</span>
                      <span className="text-[#152033]">
                        {selectedOrder.ozonCreatedAt 
                          ? new Date(selectedOrder.ozonCreatedAt).toLocaleDateString('zh-CN')
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 采购表单占位 */}
                <div className="bg-white rounded-lg border border-[#E6EAF2] p-4">
                  <h4 className="text-sm font-medium text-[#152033] mb-3">采购操作</h4>
                  <div className="text-center py-8 text-[#637089]">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">采购表单开发中</p>
                    <p className="text-xs text-gray-400 mt-1">敬请期待</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* 未选中状态 */
            <div className="flex-1 flex flex-col items-center justify-center text-[#637089]">
              <FileText className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-sm">请从左侧选择一个采购任务</p>
              <p className="text-xs text-gray-400 mt-1">点击任务卡片查看详情</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
