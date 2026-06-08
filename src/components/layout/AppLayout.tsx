'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Bell,
  Box,
  Target,
  Image,
  Activity,
  FolderOpen,
  LucideIcon,
} from 'lucide-react';

interface NavItem {
  href?: string;
  icon?: LucideIcon;
  label: string;
  type?: 'divider' | 'link';
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/purchase', icon: Package, label: '采购管理' },
  { href: '/quick-entry', icon: ClipboardList, label: '快捷录单' },
  { href: '/logistics', icon: Truck, label: '入库验货' },
  { href: '/packaging', icon: Box, label: '打包发货' },
  { href: '/finance', icon: Calculator, label: '利润核算' },
  { type: 'divider', label: 'AI 选品' },
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
  { href: '/data-center/source-management', icon: FolderOpen, label: '数据源管理' },
  { href: '/data-center/notifications', icon: Bell, label: '知识库通知中心' },
  { type: 'divider', label: '系统' },
  { href: '/accounts', icon: UserCircle, label: '账号管理' },
  { href: '/roles', icon: Shield, label: '角色权限' },
  { href: '/settings', icon: Settings, label: '系统设置' },
  { href: '/settings/shop-config', icon: ShoppingCart, label: '店铺配置' },
];

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const pathname = usePathname();

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
              const isActive = pathname === item.href || pathname?.startsWith(item.href! + '/');
              return (
                <Link
                  key={item.href!}
                  href={item.href!}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    isActive
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
            <h1 className="text-2xl font-bold text-[#152033]">{title}</h1>
            {subtitle && (
              <p className="text-sm text-[#637089] mt-1">{subtitle}</p>
            )}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
