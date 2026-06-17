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

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘', active: true },
  { href: '/purchase', icon: Package, label: '采购管理' },
  { href: '/quick-entry', icon: ClipboardList, label: '快捷录单' },
  { href: '/logistics', icon: Truck, label: '入库验货' },
  { href: '/packaging', icon: Box, label: '打包发货' },
  { href: '/finance', icon: Calculator, label: '利润核算' },
  { type: 'divider', label: 'AI智能' },
  { href: '/selection', icon: Target, label: 'AI 选品' },
  { href: '/image-listing', icon: Image, label: '修图上架' },
  { type: 'divider', label: '库存管理' },
  { href: '/inventory', icon: PackageSearch, label: '库存管理' },
  { href: '/wms', icon: Warehouse, label: '仓库管理' },
  { type: 'divider', label: '数据中心' },
  { href: '/sku-management', icon: Database, label: 'SKU管理' },
  { href: '/suppliers', icon: Users, label: '供应商管理' },
  { href: '/reports', icon: BarChart3, label: '数据报表' },
  { href: '/data-center/source-health', icon: Activity, label: '数据源健康度' },
  { href: '/data-center/source-management', icon: Server, label: '数据源管理' },
  { href: '/data-center/notifications', icon: Bell, label: '知识库通知' },
  { type: 'divider', label: '系统' },
  { href: '/accounts', icon: UserCircle, label: '账号管理' },
  { href: '/roles', icon: Shield, label: '角色权限' },
  { href: '/settings', icon: Settings, label: '系统设置' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [marketOverview, setMarketOverview] = useState<MarketOverview | null>(null);
  const [categoryRanking, setCategoryRanking] = useState<CategoryRanking[]>([]);
  const [searchTrending, setSearchTrending] = useState<SearchTrending[]>([]);
  const [newArrivals, setNewArrivals] = useState<NewArrival[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketLoading, setMarketLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
    fetchMarketData();
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
          <button className="flex items-center gap-2 text-sm text-[#637089] hover:text-[#152033] transition-colors">
            <Bell className="w-4 h-4" />
          </button>
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
                        href: '/orders',
                        icon: RefreshCw,
                        label: '订单同步',
                        count: stats?.totalOrders || 0,
                        color: 'primary',
                      },
                      {
                        href: '/purchase',
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
        </main>
      </div>
    </div>
  );
}
