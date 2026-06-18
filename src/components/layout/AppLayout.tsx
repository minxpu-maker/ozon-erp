'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  BarChart2,
  Package,
  Bot,
  Settings,
  ShoppingCart,
  Truck,
  Calculator,
  Lock,
  LucideIcon,
  ChevronDown,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Scale,
  Building2,
  Users,
  Cpu,
  BarChart3,
  Database,
  Bell,
} from 'lucide-react';
import { TopBar } from './TopBar';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
  group?: string;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  disabled?: boolean;
}

// 完整导航配置 - 合并新功能到旧导航
const navigationGroups: NavGroup[] = [
  {
    label: '仪表盘',
    icon: LayoutDashboard,
    items: [
      { name: '首页概览', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: '采购管理',
    icon: ShoppingCart,
    items: [
      { name: '订单列表', href: '/orders/list', icon: FileText },
      { name: '采购任务', href: '/purchase', icon: ShoppingCart },
      { name: '货源池', href: '/purchase/suppliers', icon: ShoppingCart, disabled: true, badge: '即将上线' },
      { name: '供应商管理', href: '/suppliers', icon: Building2 },
    ],
  },
  {
    label: '仓储发货',
    icon: Package,
    items: [
      { name: '入库验货', href: '/logistics', icon: Truck },
      { name: '打包发货', href: '/packaging', icon: Package },
      { name: '库存管理', href: '/inventory', icon: Database },
      { name: '仓库管理', href: '/wms', icon: Building2, disabled: true, badge: '即将上线' },
    ],
  },
  {
    label: '利润核算',
    icon: Calculator,
    items: [
      { name: '财务统计', href: '/finance', icon: Scale },
    ],
  },
  {
    label: 'AI智能',
    icon: Bot,
    items: [
      { name: 'AI选品', href: '/selection', icon: Sparkles },
      { name: '修图上架', href: '/image-listing', icon: ImageIcon, disabled: true, badge: '即将上线' },
    ],
  },
  {
    label: '数据中心',
    icon: BarChart3,
    items: [
      { name: 'SKU管理', href: '/sku-management', icon: BarChart2 },
      { name: '数据报表', href: '/reports', icon: BarChart3, disabled: true, badge: '即将上线' },
    ],
  },
  {
    label: '系统设置',
    icon: Settings,
    items: [
      { name: '店铺管理', href: '/settings/shops', icon: Building2 },
      { name: '硬件设备', href: '/settings/devices', icon: Cpu },
      { name: '账号管理', href: '/accounts', icon: Users },
      { name: '角色权限', href: '/roles', icon: Lock },
    ],
  },
];

// 添加 AI 相关菜单到 AppLayout
const aiNavItems = [
  { name: 'AI选品', href: '/selection', icon: Sparkles },
  { name: '修图上架', href: '/image-listing', icon: ImageIcon, disabled: true },
];

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F6F8FB]" suppressHydrationWarning>
      {/* 左侧导航栏 */}
      <aside
        className={`${collapsed ? 'w-[60px]' : 'w-[220px]'} bg-white border-r border-[#E6EAF2] flex flex-col transition-all duration-300`}
      >
        {/* Logo区域 */}
        <div className="h-[48px] border-b border-[#E6EAF2] flex items-center px-4">
          <div className="w-8 h-8 bg-[#2F6BFF] rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          {!collapsed && (
            <span className="ml-2 font-semibold text-[#152033]">Ozon ERP</span>
          )}
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {navigationGroups.map((group, groupIdx) => (
            <div key={group.label} className="mb-1">
              {/* 分组标题 */}
              <div className={`px-3 py-2 text-xs font-medium text-[#637089] uppercase tracking-wider ${collapsed ? 'text-center' : ''}`}>
                {!collapsed && group.label}
              </div>

              {/* 分组菜单项 */}
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;

                if (item.disabled) {
                  return (
                    <div
                      key={item.href}
                      className={`mx-2 mb-0.5 px-3 py-2 rounded-lg text-sm text-[#637089]/50 cursor-not-allowed flex items-center ${collapsed ? 'justify-center' : ''}`}
                      title={item.badge || '即将上线'}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="ml-2 flex-1">{item.name}</span>
                          {item.badge && (
                            <span className="text-[10px] bg-[#F6F8FB] px-1.5 py-0.5 rounded">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mx-2 mb-0.5 px-3 py-2 rounded-lg text-sm flex items-center transition-colors ${
                      isActive
                        ? 'bg-[#2F6BFF] text-white'
                        : 'text-[#637089] hover:bg-[#F6F8FB] hover:text-[#152033]'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="ml-2 flex-1">{item.name}</span>
                        {item.badge && (
                          <span className="text-[10px] bg-[#F6F8FB] text-[#637089] px-1.5 py-0.5 rounded">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* 折叠按钮 */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="border-t border-[#E6EAF2] p-3 text-sm text-[#637089] hover:text-[#152033] transition-colors text-center"
        >
          {collapsed ? '展开 →' : '← 收起'}
        </button>
      </aside>

      {/* 右侧主内容区 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* TopBar */}
        <TopBar />

        {/* 顶部统计栏（如果有标题） */}
        {(title || actions) && (
          <header className="h-[48px] bg-white border-b border-[#E6EAF2] flex items-center justify-between px-6">
            <div>
              {title && <h1 className="text-base font-semibold text-[#152033]">{title}</h1>}
              {subtitle && <p className="text-xs text-[#637089]">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </header>
        )}

        {/* 页面内容 */}
        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
