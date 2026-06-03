'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, ShoppingCart, Package, ClipboardList, Truck, Calculator, PackageSearch, Warehouse, Database, Users, BarChart3, UserCircle, Shield, Settings, RefreshCw, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/orders', icon: ShoppingCart, label: '订单管理' },
  { href: '/purchase', icon: Package, label: '采购管理' },
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
  { href: '/reports', icon: BarChart3, label: '数据报表', active: true },
  { type: 'divider', label: '系统' },
  { href: '/accounts', icon: UserCircle, label: '账号管理' },
  { href: '/roles', icon: Shield, label: '角色权限' },
  { href: '/settings', icon: Settings, label: '系统设置' },
];

export default function ReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.success) {
        // API返回 data: { orderStats, purchaseStats, profitStats, orderTrend }
        setStats(data.data);
      }
    } catch (error) { console.error('获取报表失败:', error); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <header className="bg-white sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-[#E6EAF2]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center"><BarChart3 className="w-4 h-4 text-white" /></div>
          <span className="font-semibold text-base text-[#152033]">Ozon ERP</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2F6BFF]/10 rounded-full flex items-center justify-center text-[#2F6BFF] font-medium text-sm">管</div>
            <span className="text-sm font-medium text-[#152033]">管理员</span>
          </div>
        </div>
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 3.5rem)' }}>
        <aside className="w-56 shrink-0 bg-white border-r border-[#E6EAF2] overflow-y-auto">
          <div className="p-3 space-y-0.5">
            {navItems.map((item, idx) => {
              if (item.type === 'divider') return <div key={idx} className="pt-3 pb-1"><span className="px-3 text-xs font-medium text-[#637089]/60 uppercase tracking-wider">{item.label}</span></div>;
              const Icon = item.icon!;
              return <Link key={item.href!} href={item.href!} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${item.active ? 'bg-[#2F6BFF]/10 text-[#2F6BFF]' : 'text-[#637089] hover:bg-[#EEF1F6] hover:text-[#152033]'}`}><Icon className="w-4 h-4" />{item.label}</Link>;
            })}
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto bg-[#F6F8FB] p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#152033]">数据报表</h1>
            <p className="text-sm text-[#637089] mt-1">经营报表 · 采购报表 · 效率报表</p>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#637089]">总订单数</span>
                <div className="w-8 h-8 bg-[#2F6BFF]/10 rounded-lg flex items-center justify-center"><BarChart2 className="w-4 h-4 text-[#2F6BFF]" /></div>
              </div>
              <div className="text-2xl font-bold text-[#152033]">{stats?.orderStats?.total || 0}<span className="text-sm font-normal text-[#637089] ml-1">笔</span></div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#637089]">订单总金额</span>
                <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-green-600" /></div>
              </div>
              <div className="text-2xl font-bold text-[#152033]">¥{stats?.orderStats?.totalAmount || '0'}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#637089]">采购总额</span>
                <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center"><TrendingDown className="w-4 h-4 text-red-600" /></div>
              </div>
              <div className="text-2xl font-bold text-[#152033]">¥{stats?.purchaseStats?.totalAmount || '0'}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#637089]">净利润</span>
                <div className="w-8 h-8 bg-[#2F6BFF]/10 rounded-lg flex items-center justify-center"><BarChart3 className="w-4 h-4 text-[#2F6BFF]" /></div>
              </div>
              <div className="text-2xl font-bold text-green-600">¥{stats?.profitStats?.totalProfit || '0'}</div>
            </div>
          </div>

          {/* 图表区域占位 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-[#E6EAF2]">
              <h3 className="text-base font-semibold text-[#152033] mb-4">订单趋势</h3>
              <div className="h-64 flex items-center justify-center text-[#637089]">
                <BarChart2 className="w-16 h-16 opacity-30" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border border-[#E6EAF2]">
              <h3 className="text-base font-semibold text-[#152033] mb-4">利润趋势</h3>
              <div className="h-64 flex items-center justify-center text-[#637089]">
                <TrendingUp className="w-16 h-16 opacity-30" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
