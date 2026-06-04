'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
  Truck,
  Calculator,
  PackageSearch,
  Warehouse,
  Database,
  Users,
  BarChart3,
  UserCircle,
  Shield,
  Settings,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Box,
  Search,
  Link2,
  GitBranch,
  Download,
  ShoppingBag,
  ChevronRight,
  Eye,
} from 'lucide-react';

interface PurchaseTask {
  id: string;
  orderId: string;
  orderItemId: string;
  status: string;
  skuId: string | null;
  skuCode: string;
  quantity: number;
  sourceType: string | null;
  sourceUrl: string | null;
  sourcePrice: string | null;
  purchaseAmount: string | null;
  shippingFee: string | null;
  isBound: boolean;
  domesticTrackingNumber: string | null;
  boundAt: string | null;
  purchasedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  ozonOrderId: string | null;
  postingNumber: string | null;
  buyerName: string | null;
  shopName: string | null;
}

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/orders', icon: ShoppingCart, label: '订单管理' },
  { href: '/purchase', icon: Package, label: '采购管理', active: true },
  { href: '/quick-entry', icon: ClipboardList, label: '快捷录单' },
  { href: '/logistics', icon: Truck, label: '入库验货' },
  { href: '/packaging', icon: Box, label: '打包发货' },
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

export default function PurchasePage() {
  const [tasks, setTasks] = useState<PurchaseTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [binding, setBinding] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [statusFilter, search]);

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/purchase?${params}`);
      const data = await res.json();
      if (data.success) {
        // API返回 data: [{ task: {...}, order: {...} }] 或 data: { tasks: [...] }
        const rawList = Array.isArray(data.data) ? data.data : (data.data?.tasks || []);
        // 扁平化数据结构
        const taskList = rawList.map((item: any) => ({
          id: item.task?.id || item.id,
          orderId: item.task?.order_id || item.orderId,
          orderItemId: item.task?.order_item_id || item.orderItemId,
          status: item.task?.status || item.status,
          skuId: item.task?.sku_id || item.skuId,
          skuCode: item.task?.sku_code || item.skuCode,
          quantity: item.task?.quantity || item.quantity,
          sourceType: item.task?.source_type || item.sourceType,
          sourceUrl: item.task?.source_url || item.sourceUrl,
          sourcePrice: item.task?.source_price || item.sourcePrice,
          purchaseAmount: item.task?.purchase_amount || item.purchaseAmount,
          shippingFee: item.task?.shipping_fee || item.shippingFee,
          isBound: item.task?.is_bound ?? item.isBound ?? false,
          domesticTrackingNumber: item.task?.domestic_tracking_number || item.domesticTrackingNumber,
          boundAt: item.task?.bound_at || item.boundAt,
          purchasedAt: item.task?.purchased_at || item.purchasedAt,
          receivedAt: item.task?.received_at || item.receivedAt,
          createdAt: item.task?.created_at || item.createdAt,
          ozonOrderId: item.order?.ozon_order_id || item.ozonOrderId,
          postingNumber: item.order?.ozon_posting_number || item.postingNumber,
          buyerName: item.order?.buyer_name || item.buyerName,
          shopName: item.order?.shop?.name || item.shopName,
        }));
        setTasks(taskList);
      }
    } catch (error) {
      console.error('获取采购任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 绑定快递单号
  const bindTrackingNumber = async (taskId: string) => {
    if (!trackingInput.trim()) {
      alert('请输入快递单号');
      return;
    }
    
    setBinding(true);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bindTracking',
          taskId,
          trackingNumber: trackingInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setEditingTaskId(null);
        setTrackingInput('');
        fetchTasks(); // 刷新列表
      } else {
        alert(data.error || '绑定失败');
      }
    } catch (error) {
      console.error('绑定快递单号失败:', error);
      alert('绑定失败');
    } finally {
      setBinding(false);
    }
  };

  // 开始编辑快递单号
  const startEditing = (taskId: string) => {
    setEditingTaskId(taskId);
    setTrackingInput('');
  };

  // 取消编辑
  const cancelEditing = () => {
    setEditingTaskId(null);
    setTrackingInput('');
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; bg: string; text: string }> = {
      pending: { label: '待采购', bg: 'bg-amber-100', text: 'text-amber-700' },
      purchased: { label: '已下单', bg: 'bg-blue-100', text: 'text-blue-700' },
      received: { label: '已收货', bg: 'bg-green-100', text: 'text-green-700' },
      cancelled: { label: '已取消', bg: 'bg-gray-100', text: 'text-gray-600' },
    };
    const s = statusMap[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600' };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>
    );
  };

  // 统计数据
  const stats = {
    pending: tasks.filter((t) => t.status === 'pending').length,
    purchased: tasks.filter((t) => t.status === 'purchased').length,
    received: tasks.filter((t) => t.status === 'received').length,
    cancelled: tasks.filter((t) => t.status === 'cancelled').length,
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      {/* 顶部导航 */}
      <header className="bg-white sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-[#E6EAF2]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center">
            <Box className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base text-[#152033]">Ozon ERP</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2F6BFF]/10 rounded-full flex items-center justify-center text-[#2F6BFF] font-medium text-sm">
              管
            </div>
            <span className="text-sm font-medium text-[#152033]">管理员</span>
          </div>
        </div>
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 3.5rem)' }}>
        {/* 左侧导航 */}
        <aside className="w-56 shrink-0 bg-white border-r border-[#E6EAF2] overflow-y-auto">
          <div className="p-3 space-y-0.5">
            {navItems.map((item, idx) => {
              if (item.type === 'divider') {
                return (
                  <div key={idx} className="pt-3 pb-1">
                    <span className="px-3 text-xs font-medium text-[#637089]/60 uppercase tracking-wider">
                      {item.label}
                    </span>
                  </div>
                );
              }
              const Icon = item.icon!;
              return (
                <Link
                  key={item.href!}
                  href={item.href!}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    item.active
                      ? 'bg-[#2F6BFF]/10 text-[#2F6BFF]'
                      : 'text-[#637089] hover:bg-[#EEF1F6] hover:text-[#152033]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-[#F6F8FB] p-6">
          {/* 页面标题 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#152033]">采购管理</h1>
            <p className="text-sm text-[#637089] mt-1">人机协同绑定模式 · 零库存采购流程</p>
          </div>

          {/* 业务流程说明区 */}
          <div className="bg-white rounded-lg shadow-sm p-5 mb-6 border border-[#E6EAF2]">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch className="w-4 h-4 text-[#2F6BFF]" />
              <span className="text-base font-semibold text-[#152033]">业务流程</span>
            </div>
            <div className="flex items-center justify-between bg-[#EEF1F6] rounded-lg p-4 flex-wrap gap-4">
              {[
                { icon: Download, label: '订单同步', sub: 'Ozon已付款订单' },
                { icon: Clock, label: '待采购', sub: '等待人工下单', color: 'warning' },
                { icon: ShoppingBag, label: '人工下单', sub: '1688/拼多多' },
                { icon: Link2, label: '绑定录入', sub: '快递单号关联', color: 'success' },
                { icon: CheckCircle, label: '待入库', sub: '仓库验货' },
              ].map((step, idx) => {
                const Icon = step.icon;
                const bgColor =
                  step.color === 'warning'
                    ? 'bg-amber-500/10'
                    : step.color === 'success'
                    ? 'bg-green-500/10'
                    : 'bg-[#2F6BFF]/10';
                const textColor =
                  step.color === 'warning'
                    ? 'text-amber-600'
                    : step.color === 'success'
                    ? 'text-green-600'
                    : 'text-[#2F6BFF]';
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-10 h-10 ${bgColor} rounded-lg`}>
                        <Icon className={`w-5 h-5 ${textColor}`} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#152033]">{step.label}</div>
                        <div className="text-xs text-[#637089]">{step.sub}</div>
                      </div>
                    </div>
                    {idx < 4 && <ChevronRight className="w-5 h-5 text-[#637089]/50" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: '待采购任务', value: stats.pending, icon: Clock, color: 'warning' },
              { label: '已绑定采购', value: stats.purchased, icon: CheckCircle, color: 'success' },
              { label: '已收货入库', value: stats.received, icon: Package, color: 'primary' },
              { label: '已取消', value: stats.cancelled, icon: XCircle, color: 'gray' },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              const bgColor =
                stat.color === 'warning'
                  ? 'bg-amber-500/10'
                  : stat.color === 'success'
                  ? 'bg-green-500/10'
                  : stat.color === 'primary'
                  ? 'bg-[#2F6BFF]/10'
                  : 'bg-gray-200';
              const textColor =
                stat.color === 'warning'
                  ? 'text-amber-600'
                  : stat.color === 'success'
                  ? 'text-green-600'
                  : stat.color === 'primary'
                  ? 'text-[#2F6BFF]'
                  : 'text-gray-600';
              return (
                <div key={idx} className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[#637089]">{stat.label}</span>
                    <div className={`w-8 h-8 ${bgColor} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${textColor}`} />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-[#152033]">
                    {stat.value}
                    <span className="text-sm font-normal text-[#637089] ml-1">笔</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 筛选栏 */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-[#E6EAF2]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-4 h-4 text-[#637089]" />
                <input
                  type="text"
                  placeholder="搜索SKU编码..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 text-sm text-[#152033] placeholder:text-[#637089]/50 outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#E6EAF2] text-sm text-[#152033] outline-none"
              >
                <option value="all">全部状态</option>
                <option value="pending">待采购</option>
                <option value="purchased">已下单</option>
                <option value="received">已收货</option>
                <option value="cancelled">已取消</option>
              </select>
              <button
                onClick={fetchTasks}
                className="flex items-center gap-2 px-4 py-2 bg-[#2F6BFF] text-white rounded-lg text-sm font-medium hover:bg-[#2F6BFF]/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                刷新
              </button>
            </div>
          </div>

          {/* 任务列表 */}
          <div className="bg-white rounded-xl shadow-sm border border-[#E6EAF2] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#F6F8FB]">
                <tr>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">SKU编码</th>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">数量</th>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">关联订单</th>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">货源平台</th>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">状态</th>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">国内快递单号</th>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#637089]">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#637089]">
                      暂无采购任务
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id} className="border-t border-[#E6EAF2]">
                      <td className="px-4 py-3 text-sm font-medium text-[#152033]">{task.skuCode}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">{task.quantity}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-[#2F6BFF]">{task.ozonOrderId || '-'}</div>
                        <div className="text-xs text-[#637089]">{task.postingNumber || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#152033]">
                        {task.sourceType === '1688' ? '1688' : task.sourceType === 'pdd' ? '拼多多' : '-'}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(task.status)}</td>
                      <td className="px-4 py-3">
                        {task.status === 'pending' && editingTaskId === task.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={trackingInput}
                              onChange={(e) => setTrackingInput(e.target.value)}
                              placeholder="输入快递单号"
                              className="w-32 px-2 py-1 text-sm border border-[#E6EAF2] rounded focus:outline-none focus:ring-1 focus:ring-[#2F6BFF]"
                              autoFocus
                            />
                            <button
                              onClick={() => bindTrackingNumber(task.id)}
                              disabled={binding}
                              className="px-2 py-1 text-xs bg-[#2F6BFF] text-white rounded hover:bg-[#2F6BFF]/90 disabled:opacity-50"
                            >
                              {binding ? '绑定中...' : '确认'}
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="px-2 py-1 text-xs text-[#637089] hover:text-[#152033]"
                            >
                              取消
                            </button>
                          </div>
                        ) : task.status === 'pending' ? (
                          <button
                            onClick={() => startEditing(task.id)}
                            className="text-sm text-[#2F6BFF] hover:underline"
                          >
                            + 录入单号
                          </button>
                        ) : (
                          <span className="text-sm text-[#152033]">{task.domesticTrackingNumber || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button className="p-1.5 rounded hover:bg-[#F6F8FB] transition-colors">
                          <Eye className="w-4 h-4 text-[#637089]" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
