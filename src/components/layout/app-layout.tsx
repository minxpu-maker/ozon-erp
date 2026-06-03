'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
  Truck,
  Box,
  Calculator,
  PackageSearch,
  Warehouse,
  Database,
  Users,
  BarChart3,
  UserCircle,
  Shield,
  Settings,
  Bell,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/orders', icon: ShoppingCart, label: '订单管理' },
  { href: '/purchase', icon: Package, label: '采购管理' },
  { href: '/quick-entry', icon: ClipboardList, label: '快捷录单' },
  { href: '/logistics', icon: Truck, label: '物流追踪' },
  { href: '/packaging', icon: Box, label: '打包流程' },
  { href: '/finance', icon: Calculator, label: '财务核算' },
];

const inventoryItems = [
  { href: '/inventory', icon: PackageSearch, label: '库存管理' },
  { href: '/wms', icon: Warehouse, label: '仓库管理' },
];

const dataItems = [
  { href: '/sku-management', icon: Database, label: 'SKU管理' },
  { href: '/suppliers', icon: Users, label: '供应商管理' },
  { href: '/reports', icon: BarChart3, label: '数据报表' },
];

const systemItems = [
  { href: '/accounts', icon: UserCircle, label: '账号管理' },
  { href: '/roles', icon: Shield, label: '角色权限' },
  { href: '/settings', icon: Settings, label: '系统设置' },
];

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: typeof LayoutDashboard; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="pt-3 pb-1">
        <span className="px-3 text-xs font-medium text-on-surface-variant/60 uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans">
      {/* 顶部导航栏 */}
      <header className="bg-surface sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-outline/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Box className="w-4 h-4 text-on-primary" />
          </div>
          <span className="font-semibold text-base">Ozon ERP</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
            <Bell className="w-4 h-4" />
            <span className="bg-error text-white text-xs px-1.5 py-0.5 rounded-full font-medium">3</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-medium text-sm">初</div>
            <span className="text-sm font-medium">小初</span>
          </div>
        </div>
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 3.5rem)' }}>
        {/* 侧边栏 */}
        <aside className="w-56 shrink-0 bg-surface border-r border-outline/50 overflow-y-auto">
          <div className="p-3 space-y-0.5">
            {navItems.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={pathname === item.href}
              />
            ))}
            
            <NavSection title="库存管理">
              {inventoryItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={pathname === item.href}
                />
              ))}
            </NavSection>

            <NavSection title="数据中心">
              {dataItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={pathname === item.href}
                />
              ))}
            </NavSection>

            <NavSection title="系统">
              {systemItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={pathname === item.href}
                />
              ))}
            </NavSection>
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
