'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
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
  ShoppingBag,
  Link2,
  ClipboardCheck,
  CreditCard,
  TrendingUp,
  Box,
  CheckCircle,
  Clock,
  ChevronRight,
  Bell,
  Zap,
  HardDrive,
  Scale,
  Target,
  Image,
  Activity,
  Server,
  Store,
} from 'lucide-react';

interface DashboardStats {
  totalOrders: number;
  pendingPurchase: number;
  pendingShip: number;
  delivering: number;
  completed: number;
  todaySales: string;
  pendingPurchaseTasks: number;
  purchasedTasks: number;
  pendingInspection: number;
  pendingPackaging: number;
  shopCount: number;
  shops: Array<{ id: string; name: string; lastSyncAt: string | null }>;
  recentOrders: Array<{
    id: string;
    ozonOrderId: string;
    postingNumber: string;
    shopName: string;
    status: string;
    buyerName: string | null;
    totalPrice: string;
    createdAt: string;
  }>;
}

// 市场概览数据类型
interface MarketOverview {
  totalProducts: number;
  newToday: number;
  priceChanges: number;
  hotCategories: Array<{ category: string; productCount: number; avgPrice: number }>;
  salesTrend: Array<{ date: string; sales: number }>;
  topShops: Array<{ name: string; productCount: number }>;
  avgProfitRate: number;
}

// 类目排行数据类型
interface CategoryRanking {
  category: string;
  productCount: number;
  avgPrice: number;
  avgSales: number;
  totalSales: number;
  revenue: number;
  growth: number;
  sellerCount: number;
  avgRating: number;
}

// 搜索飙升数据类型
interface SearchTrending {
  keyword: string;
  searchVolume: number;
  growth: number;
  relatedProducts: number;
}

// 新品榜数据类型
interface NewArrival {
  productTitle: string;
  price: number;
  sales: number;
  rating: number;
  listedDate: string;
  category: string;
}

// 紧急待办数据类型
interface UrgentOrder {
  id: string;
  productName: string;
  deadline: string;
  type: 'purchase' | 'inspection' | 'packaging';
}

// 发货倒计时数据类型
interface CountdownOrder {
  id: string;
  productName: string;
  shipmentDeadline: string;
}

// 导入 recharts
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [marketOverview, setMarketOverview] = useState<MarketOverview | null>(null);
  const [categoryRanking, setCategoryRanking] = useState<CategoryRanking[]>([]);
  const [searchTrending, setSearchTrending] = useState<SearchTrending[]>([]);
  const [newArrivals, setNewArrivals] = useState<NewArrival[]>([]);
  const [urgentOrders, setUrgentOrders] = useState<UrgentOrder[]>([]);
  const [countdownOrders, setCountdownOrders] = useState<CountdownOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketLoading, setMarketLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
    fetchMarketData();
    fetchUrgentAndCountdown();
    // 每30秒刷新紧急数据
    const interval = setInterval(fetchUrgentAndCountdown, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('获取仪表盘数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUrgentAndCountdown = async () => {
    try {
      // 获取紧急待采购订单（24小时内截止）
      const purchaseRes = await fetch('/api/purchase-demands?status=pending');
      const purchaseData = await purchaseRes.json();
      
      // 获取待发货订单
      const shipmentRes = await fetch('/api/shipments');
      const shipmentData = await shipmentRes.json();

      if (purchaseData.success && Array.isArray(purchaseData.data)) {
        const now = Date.now();
        const urgent: UrgentOrder[] = purchaseData.data
          .filter((item: Record<string, unknown>) => {
            const deadline = new Date(item.shipmentDeadline as string).getTime();
            return deadline - now < 24 * 60 * 60 * 1000; // 24小时内
          })
          .slice(0, 5)
          .map((item: Record<string, unknown>) => ({
            id: item.id as string,
            productName: (item.productName || item.product_title || '未知商品') as string,
            deadline: item.shipmentDeadline as string,
            type: 'purchase' as const,
          }));
        setUrgentOrders(urgent);
      }

      if (shipmentData.success && Array.isArray(shipmentData.data)) {
        const now = Date.now();
        const urgent: CountdownOrder[] = shipmentData.data
          .filter((item: Record<string, unknown>) => {
            const deadline = item.shipment_deadline 
              ? new Date(item.shipment_deadline as string).getTime()
              : item.shipmentDeadline
                ? new Date(item.shipmentDeadline as string).getTime()
                : 0;
            return deadline > now && deadline - now < 48 * 60 * 60 * 1000; // 48小时内
          })
          .slice(0, 5)
          .map((item: Record<string, unknown>) => ({
            id: item.id as string,
            productName: (item.productName || item.product_title || '未知商品') as string,
            shipmentDeadline: (item.shipment_deadline || item.shipmentDeadline) as string,
          }));
        setCountdownOrders(urgent);
      }
    } catch (error) {
      console.error('获取紧急数据失败:', error);
    }
  };

  const fetchMarketData = async () => {
    try {
      const [overviewRes, categoryRes, trendingRes, arrivalsRes] = await Promise.all([
        fetch('/api/dashboard/market-overview'),
        fetch('/api/dashboard/category-ranking?limit=5'),
        fetch('/api/dashboard/search-trending?limit=10'),
        fetch('/api/dashboard/new-arrivals?limit=5'),
      ]);
      const [overviewData, categoryData, trendingData, arrivalsData] = await Promise.all([
        overviewRes.json(),
        categoryRes.json(),
        trendingRes.json(),
        arrivalsRes.json(),
      ]);
      if (overviewData.success) setMarketOverview(overviewData.data);
      if (categoryData.success) setCategoryRanking(categoryData.data);
      if (trendingData.success) setSearchTrending(trendingData.data);
      if (arrivalsData.success) setNewArrivals(arrivalsData.data);
    } catch (error) {
      console.error('获取市场数据失败:', error);
    } finally {
      setMarketLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; bg: string; text: string }> = {
      awaiting_packaging: { label: '待打包', bg: 'bg-amber-100', text: 'text-amber-700' },
      awaiting_deliver: { label: '待发货', bg: 'bg-blue-100', text: 'text-blue-700' },
      delivering: { label: '配送中', bg: 'bg-blue-100', text: 'text-blue-700' },
      delivered: { label: '已送达', bg: 'bg-green-100', text: 'text-green-700' },
      cancelled: { label: '已取消', bg: 'bg-gray-100', text: 'text-gray-600' },
    };
    const s = statusMap[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600' };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  return (
    <AppLayout>
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#152033]">仪表盘</h1>
        <p className="text-sm text-[#637089] mt-1">ERP系统首页 · 核心业务指标与流程状态</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 text-[#637089] animate-spin" />
        </div>
      ) : (
        <>
          {/* 业务流程可视化 */}
          <section className="mb-8">
            <h2 className="text-base font-semibold text-[#152033] mb-4">业务流程</h2>
            <div className="bg-white rounded-xl shadow-sm p-5 border border-[#E6EAF2]">
              <div className="flex items-center justify-between flex-wrap gap-4">
                {[
                  {
                    href: '/orders/list',
                    icon: RefreshCw,
                    label: '订单同步',
                    count: stats?.totalOrders || 0,
                    color: 'primary',
                  },
                  {
                    href: '/quick-entry',
                    icon: ShoppingBag,
                    label: '待采购任务',
                    count: stats?.pendingPurchaseTasks || 0,
                    color: 'warning',
                  },
                  {
                    href: '/quick-entry',
                    icon: Link2,
                    label: '待绑定采购',
                    count: stats?.purchasedTasks || 0,
                    color: 'primary',
                  },
                  {
                    href: '/logistics',
                    icon: ClipboardCheck,
                    label: '待入库验货',
                    count: stats?.pendingInspection || 0,
                    color: 'primary',
                  },
                  {
                    href: '/packaging',
                    icon: Package,
                    label: '待打包发货',
                    count: stats?.pendingPackaging || 0,
                    color: 'primary',
                  },
                  {
                    href: '/finance',
                    icon: Calculator,
                    label: '待核算订单',
                    count: stats?.completed || 0,
                    color: 'success',
                  },
                ].map((node, idx) => {
                      const Icon = node.icon;
                      const colorClass =
                        node.color === 'warning'
                          ? 'bg-amber-500/10 hover:bg-amber-500/20'
                          : node.color === 'success'
                          ? 'bg-green-500/10 hover:bg-green-500/20'
                          : 'bg-[#2F6BFF]/5 hover:bg-[#2F6BFF]/10';
                      const iconBg =
                        node.color === 'warning'
                          ? 'bg-amber-500/20'
                          : node.color === 'success'
                          ? 'bg-green-500/20'
                          : 'bg-[#2F6BFF]/20';
                      const textColor =
                        node.color === 'warning'
                          ? 'text-amber-600'
                          : node.color === 'success'
                          ? 'text-green-600'
                          : 'text-[#2F6BFF]';
                      return (
                        <div key={node.href} className="flex items-center gap-2">
                          <Link
                            href={node.href}
                            className={`flex flex-col items-center p-4 rounded-lg ${colorClass} transition-colors cursor-pointer group min-w-[120px]`}
                          >
                            <div
                              className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center mb-2`}
                            >
                              <Icon className={`w-5 h-5 ${textColor}`} />
                            </div>
                            <span className="text-xs text-[#637089] mb-1">{node.label}</span>
                            <span className="text-lg font-bold text-[#152033]">
                              {node.count}
                              <span className="text-xs font-normal text-[#637089]">笔</span>
                            </span>
                          </Link>
                          {idx < 5 && (
                            <ChevronRight className="w-5 h-5 text-[#637089]/30 hidden sm:block" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 核心指标卡片 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2">
                  <h2 className="text-base font-semibold text-[#152033] mb-4">核心指标</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      {
                        icon: CreditCard,
                        label: '今日已付款订单',
                        value: stats?.totalOrders || 0,
                        unit: '笔',
                      },
                      {
                        icon: TrendingUp,
                        label: '今日销售额',
                        value: `¥${Number(stats?.todaySales || 0).toFixed(2)}`,
                        unit: '',
                      },
                      {
                        icon: Package,
                        label: '待发货订单',
                        value: stats?.pendingShip || 0,
                        unit: '笔',
                      },
                      {
                        icon: Truck,
                        label: '配送中订单',
                        value: stats?.delivering || 0,
                        unit: '笔',
                      },
                      {
                        icon: CheckCircle,
                        label: '已完成订单',
                        value: stats?.completed || 0,
                        unit: '笔',
                      },
                      {
                        icon: Clock,
                        label: '待采购订单',
                        value: stats?.pendingPurchase || 0,
                        unit: '笔',
                      },
                    ].map((metric, idx) => {
                      const Icon = metric.icon;
                      return (
                        <div
                          key={idx}
                          className="bg-white rounded-xl shadow-sm p-4 border border-[#E6EAF2]"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-[#2F6BFF]/10 flex items-center justify-center">
                              <Icon className="w-4 h-4 text-[#2F6BFF]" />
                            </div>
                            <span className="text-xs text-[#637089]">{metric.label}</span>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-[#152033]">{metric.value}</span>
                            {metric.unit && (
                              <span className="text-sm text-[#637089]">{metric.unit}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 硬件状态 */}
                <div>
                  <h2 className="text-base font-semibold text-[#152033] mb-4">硬件状态</h2>
                  <div className="bg-white rounded-xl shadow-sm p-4 border border-[#E6EAF2] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[#152033]">扫描枪</div>
                          <div className="text-xs text-green-600">在线</div>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-600">
                        正常
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <Scale className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[#152033]">电子秤</div>
                          <div className="text-xs text-green-600">在线</div>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-600">
                        正常
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#2F6BFF]/10 flex items-center justify-center">
                          <HardDrive className="w-5 h-5 text-[#2F6BFF]" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[#152033]">打印机</div>
                          <div className="text-xs text-[#637089]">待连接</div>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        离线
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 订单处理漏斗 */}
              <section className="mb-8">
                <h2 className="text-base font-semibold text-[#152033] mb-4">订单处理漏斗</h2>
                <div className="bg-white rounded-xl shadow-sm p-5 border border-[#E6EAF2]">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={[
                        { stage: '已同步', count: stats?.totalOrders || 0, fill: '#3b82f6' },
                        { stage: '待采购', count: stats?.pendingPurchaseTasks || 0, fill: '#f59e0b' },
                        { stage: '待验货', count: stats?.pendingInspection || 0, fill: '#60a5fa' },
                        { stage: '待发货', count: stats?.pendingPackaging || 0, fill: '#93c5fd' },
                        { stage: '已完成', count: stats?.completed || 0, fill: '#10b981' },
                      ]}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#637089' }} />
                      <YAxis type="category" dataKey="stage" tick={{ fontSize: 12, fill: '#637089' }} width={60} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #E6EAF2', 
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {[
                          { stage: '已同步', count: stats?.totalOrders || 0, fill: '#3b82f6' },
                          { stage: '待采购', count: stats?.pendingPurchaseTasks || 0, fill: '#f59e0b' },
                          { stage: '待验货', count: stats?.pendingInspection || 0, fill: '#60a5fa' },
                          { stage: '待发货', count: stats?.pendingPackaging || 0, fill: '#93c5fd' },
                          { stage: '已完成', count: stats?.completed || 0, fill: '#10b981' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* 紧急待办 + 发货倒计时 */}
              <section className="mb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 紧急待办列表 */}
                  <div>
                    <h2 className="text-base font-semibold text-[#152033] mb-4">紧急待办</h2>
                    <div className="bg-white rounded-xl shadow-sm p-5 border border-[#E6EAF2]">
                      {urgentOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-[#637089]">
                          <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
                          <span className="text-sm">暂无紧急待办</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {urgentOrders.map((order) => (
                            <div
                              key={order.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm font-bold">
                                  🔴
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-[#152033] truncate max-w-[200px]">
                                    {order.productName}
                                  </p>
                                  <p className="text-xs text-red-500">
                                    截止 {new Date(order.deadline).toLocaleDateString('zh-CN')}
                                  </p>
                                </div>
                              </div>
                              <Link
                                href={order.type === 'purchase' ? '/quick-entry' : order.type === 'inspection' ? '/logistics' : '/packaging'}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                              >
                                去处理
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 发货倒计时预警 */}
                  <div>
                    <h2 className="text-base font-semibold text-[#152033] mb-4">发货倒计时</h2>
                    <div className="bg-white rounded-xl shadow-sm p-5 border border-[#E6EAF2]">
                      {countdownOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-[#637089]">
                          <Clock className="w-8 h-8 mb-2 text-green-500" />
                          <span className="text-sm">暂无超时预警</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {countdownOrders.map((order) => {
                            const hours = Math.max(0, (new Date(order.shipmentDeadline).getTime() - Date.now()) / 3600000);
                            const colorClass = hours < 12 ? 'bg-red-50 border-red-100' : hours < 24 ? 'bg-yellow-50 border-yellow-100' : 'bg-green-50 border-green-100';
                            const textColorClass = hours < 12 ? 'text-red-600' : hours < 24 ? 'text-yellow-600' : 'text-green-600';
                            const badgeClass = hours < 12 ? 'bg-red-100 text-red-600' : hours < 24 ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600';
                            return (
                              <div
                                key={order.id}
                                className={`flex items-center justify-between p-3 rounded-lg border ${colorClass}`}
                              >
                                <div className="flex items-center gap-3">
                                  <Clock className={`w-5 h-5 ${textColorClass}`} />
                                  <p className="text-sm font-medium text-[#152033] truncate max-w-[200px]">
                                    {order.productName}
                                  </p>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${badgeClass}`}>
                                  {hours < 1 ? `${Math.round(hours * 60)}分钟` : `${hours.toFixed(1)}小时`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* 市场数据概览 */}
              {!marketLoading && (marketOverview || categoryRanking.length > 0 || searchTrending.length > 0 || newArrivals.length > 0) && (
                <section className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-[#152033]">市场数据</h2>
                    <Link
                      href="/selection"
                      className="text-sm text-[#2F6BFF] hover:underline flex items-center gap-1"
                    >
                      前往选品 <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                    {/* 市场概览卡片 */}
                    {marketOverview && (
                      <div className="bg-white rounded-xl shadow-sm p-4 border border-[#E6EAF2]">
                        <h3 className="text-sm font-medium text-[#637089] mb-3">市场概览</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[#637089]">采集商品</span>
                            <span className="text-lg font-bold text-[#152033]">{marketOverview.totalProducts}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[#637089]">今日新增</span>
                            <span className="text-sm font-medium text-green-600">+{marketOverview.newToday}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[#637089]">价格变动</span>
                            <span className={`text-sm font-medium ${marketOverview.priceChanges > 0 ? 'text-red-500' : 'text-[#637089]'}`}>
                              {marketOverview.priceChanges > 0 ? `↑${marketOverview.priceChanges}` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[#637089]">平均利润率</span>
                            <span className={`text-sm font-medium ${
                              marketOverview.avgProfitRate > 20 ? 'text-green-600' :
                              marketOverview.avgProfitRate >= 10 ? 'text-amber-600' : 'text-red-500'
                            }`}>
                              {marketOverview.avgProfitRate > 0 ? `${marketOverview.avgProfitRate.toFixed(1)}%` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 热销类目 */}
                    {categoryRanking.length > 0 && (
                      <div className="bg-white rounded-xl shadow-sm p-4 border border-[#E6EAF2]">
                        <h3 className="text-sm font-medium text-[#637089] mb-3">热销类目 TOP5</h3>
                        <div className="space-y-2">
                          {categoryRanking.slice(0, 5).map((cat, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-[#152033] truncate flex-1 mr-2">{cat.category}</span>
                              <span className="text-[#637089]">{cat.productCount}件</span>
                            </div>
                          ))}
                          {categoryRanking.length === 0 && (
                            <span className="text-xs text-[#637089]">暂无数据</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 搜索热词 */}
                    {searchTrending.length > 0 && (
                      <div className="bg-white rounded-xl shadow-sm p-4 border border-[#E6EAF2]">
                        <h3 className="text-sm font-medium text-[#637089] mb-3">搜索飙升词</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {searchTrending.slice(0, 8).map((item, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                idx < 3 ? 'bg-red-100 text-red-600' : 'bg-[#2F6BFF]/10 text-[#2F6BFF]'
                              }`}
                            >
                              {item.keyword}
                              {item.growth > 0 && <span className="ml-1">↑{item.growth}%</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 新品榜 */}
                    {newArrivals.length > 0 && (
                      <div className="bg-white rounded-xl shadow-sm p-4 border border-[#E6EAF2]">
                        <h3 className="text-sm font-medium text-[#637089] mb-3">新品榜</h3>
                        <div className="space-y-2">
                          {newArrivals.slice(0, 4).map((item, idx) => (
                            <div key={idx} className="text-sm">
                              <p className="text-[#152033] truncate">{item.productTitle}</p>
                              <div className="flex items-center gap-2 text-xs text-[#637089]">
                                <span>¥{item.price}</span>
                                <span>⭐{item.rating}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 最近订单 */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-[#152033]">最近订单</h2>
                  <Link
                    href="/orders"
                    className="text-sm text-[#2F6BFF] hover:underline flex items-center gap-1"
                  >
                    查看全部 <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-[#E6EAF2] overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-[#F6F8FB]">
                      <tr>
                        <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">
                          订单号
                        </th>
                        <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">
                          发货单号
                        </th>
                        <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">
                          店铺
                        </th>
                        <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">
                          买家
                        </th>
                        <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">
                          状态
                        </th>
                        <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">
                          下单时间
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats?.recentOrders.map((order) => (
                        <tr key={order.id} className="border-t border-[#E6EAF2]">
                          <td className="px-4 py-3">
                            <Link
                              href={`/orders?id=${order.id}`}
                              className="text-sm text-[#2F6BFF] hover:underline"
                            >
                              {order.ozonOrderId}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#152033]">{order.postingNumber}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-[#2F6BFF]/10 text-[#2F6BFF]">
                              {order.shopName}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#152033]">
                            {order.buyerName || '-'}
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(order.status)}</td>
                          <td className="px-4 py-3 text-sm text-[#637089]">
                            {formatTime(order.createdAt)}
                          </td>
                        </tr>
                      ))}
                      {(!stats || stats.recentOrders.length === 0) && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-[#637089]">
                            暂无订单数据
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
    </AppLayout>
  );
}
