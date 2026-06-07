'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box,
  Bell,
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Package,
  BarChart3,
  Settings,
  Users,
  Database,
  FileText,
  Warehouse,
  Tags,
  CreditCard,
  DollarSign,
  UserCog,
  Shield
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  type?: 'item';
}

interface NavDivider {
  type: 'divider';
  label: string;
}

type NavEntry = NavItem | NavDivider;

const navItems: NavEntry[] = [
  { label: '仪表盘', href: '/dashboard', icon: LayoutDashboard, type: 'item' },
  { type: 'divider', label: '业务管理' },
  { label: '采购管理', href: '/purchase', icon: ShoppingCart, type: 'item' },
  { label: '快捷录单', href: '/quick-entry', icon: FileText, type: 'item' },
  { label: '入库验货', href: '/logistics', icon: Truck, type: 'item' },
  { label: '打包发货', href: '/packaging', icon: Package, type: 'item' },
  { label: '利润核算', href: '/finance', icon: DollarSign, type: 'item' },
  { type: 'divider', label: '数据管理' },
  { label: '库存管理', href: '/inventory', icon: Database, type: 'item' },
  { label: '仓库管理', href: '/wms', icon: Warehouse, type: 'item' },
  { label: 'SKU管理', href: '/sku-management', icon: Tags, type: 'item' },
  { label: '供应商', href: '/suppliers', icon: CreditCard, type: 'item' },
  { type: 'divider', label: '系统管理' },
  { label: '数据报表', href: '/reports', icon: BarChart3, type: 'item' },
  { label: '账号管理', href: '/accounts', icon: Users, type: 'item' },
  { label: '角色权限', href: '/roles', icon: Shield, type: 'item' },
  { label: '系统设置', href: '/settings', icon: Settings, type: 'item' },
];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      {/* 顶部导航 */}
      <header className="bg-white sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-[#E6EAF2]">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center">
              <Box className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-base text-[#152033]">Ozon ERP</span>
          </Link>
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
              const isActive = pathname === item.href;
              return (
                <Link
                  key={idx}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-[#2F6BFF]/10 text-[#2F6BFF] font-medium'
                      : 'text-[#637089] hover:bg-[#F6F8FB] hover:text-[#152033]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
