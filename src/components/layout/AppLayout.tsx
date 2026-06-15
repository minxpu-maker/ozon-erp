'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Search,
  BarChart2,
  Package,
  Bot,
  Settings,
  ShoppingCart,
  Truck,
  Calculator,
  Box,
  Lock,
  LucideIcon,
  ChevronDown,
  Sparkles,
  ArrowUpDown,
  TrendingUp,
  Library,
} from 'lucide-react';

interface NavItem {
  href?: string;
  icon?: LucideIcon;
  label: string;
  locked?: boolean;
  children?: NavItem[];
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/selection', icon: Search, label: '选品' },
  { 
    href: '/keywords/mining', 
    icon: BarChart2, 
    label: '关键词',
    children: [
      { href: '/keywords/mining', icon: Sparkles, label: '关键词挖掘' },
      { href: '/keywords/reverse', icon: ArrowUpDown, label: '关键词反查' },
      { href: '/keywords/trend', icon: TrendingUp, label: '搜索趋势' },
      { href: '/keywords/library', icon: Library, label: '关键词库' },
    ]
  },
  { href: '/monitor', icon: Package, label: '监控', locked: true },
  { href: '/collection-box', icon: Box, label: '采集箱' },
  { href: '/ai-tools', icon: Bot, label: 'AI工具', locked: true },
  { href: '/operations', icon: Settings, label: '运营', locked: true },
];

const erpNavItems: NavItem[] = [
  { href: '/orders', icon: ShoppingCart, label: '订单管理' },
  { href: '/purchase', icon: Package, label: '采购管理' },
  { href: '/logistics', icon: Truck, label: '物流管理' },
  { href: '/finance', icon: Calculator, label: '财务管理' },
  { href: '/settings', icon: Settings, label: '系统设置' },
];

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const pathname = usePathname();
  const [hoveredLocked, setHoveredLocked] = useState<string | null>(null);
  const [expandedMenu, setExpandedMenu] = useState<string | null>('关键词');

  const renderNavItem = (item: NavItem, index: number) => {
    if (item.locked) {
      return (
        <div
          key={`locked-${index}`}
          className="relative"
          onMouseEnter={() => setHoveredLocked(item.label)}
          onMouseLeave={() => setHoveredLocked(null)}
        >
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm cursor-not-allowed text-[#9CA3AF] hover:bg-[#F3F4F6]"
          >
            {item.icon && <item.icon className="w-4 h-4" />}
            {item.label}
            <Lock className="w-3 h-3 ml-auto opacity-50" />
          </div>
          {hoveredLocked === item.label && (
            <div className="absolute left-0 top-full mt-1 px-3 py-1.5 bg-[#152033] text-white text-xs rounded whitespace-nowrap z-50">
              即将上线
            </div>
          )}
        </div>
      );
    }

    // 有子菜单的项
    if (item.children && item.children.length > 0) {
      const Icon = item.icon!;
      const isExpanded = expandedMenu === item.label;
      const hasActiveChild = item.children.some(
        child => pathname === child.href || pathname?.startsWith(child.href! + '/')
      );
      
      return (
        <div key={item.label}>
          <div
            onClick={() => setExpandedMenu(isExpanded ? null : item.label)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm cursor-pointer transition-colors ${
              hasActiveChild
                ? 'bg-[#1677FF] text-white'
                : 'text-[#637089] hover:bg-[#EEF1F6] hover:text-[#152033]'
            }`}
          >
            <Icon className="w-4 h-4" />
            {item.label}
            <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-[#E6EAF2] pl-3">
              {item.children.map((child, childIndex) => {
                const ChildIcon = child.icon!;
                const isChildActive = pathname === child.href || pathname?.startsWith(child.href! + '/');
                return (
                  <Link
                    key={child.href!}
                    href={child.href!}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isChildActive
                        ? 'bg-[#1677FF]/10 text-[#1677FF] font-medium'
                        : 'text-[#637089] hover:bg-[#EEF1F6] hover:text-[#152033]'
                    }`}
                  >
                    <ChildIcon className="w-3.5 h-3.5" />
                    {child.label}
                  </Link>
                );
              })}
            </div>
          )}
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
            ? 'bg-[#1677FF] text-white'
            : 'text-[#637089] hover:bg-[#EEF1F6] hover:text-[#152033]'
        }`}
      >
        <Icon className="w-4 h-4" />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* 顶部导航 */}
      <header className="bg-white sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-[#E6EAF2]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1677FF] rounded-lg flex items-center justify-center">
            <Box className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base text-[#152033]">选品引擎</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F0F7FF] rounded-full">
            <span className="text-xs text-[#1677FF]">插件已连接</span>
            <div className="w-2 h-2 bg-[#1677FF] rounded-full animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1677FF]/10 rounded-full flex items-center justify-center text-[#1677FF] font-medium text-sm">
              管
            </div>
            <span className="text-sm font-medium text-[#152033]">管理员</span>
          </div>
        </div>
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 3.5rem)' }}>
        {/* 左侧导航 - 精简版 */}
        <aside className="w-56 shrink-0 bg-white border-r border-[#E6EAF2] overflow-y-auto">
          <div className="p-3">
            {/* 主导航区 */}
            <div className="space-y-0.5">
              <div className="px-3 py-2">
                <span className="text-xs font-medium text-[#637089]/60 uppercase tracking-wider">
                  选品工具
                </span>
              </div>
              {mainNavItems.map((item, index) => renderNavItem(item, index))}
            </div>

            {/* 分隔线 */}
            <div className="my-4 border-t border-[#E6EAF2]" />

            {/* ERP保留模块 */}
            <div className="space-y-0.5">
              <div className="px-3 py-2">
                <span className="text-xs font-medium text-[#637089]/60 uppercase tracking-wider">
                  ERP管理
                </span>
              </div>
              {erpNavItems.map((item, index) => renderNavItem(item, index))}
            </div>
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-[#F5F7FA] p-6">
          {/* 页面标题 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#1F2937]">{title}</h1>
            {subtitle && (
              <p className="text-sm text-[#4B5563] mt-1">{subtitle}</p>
            )}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
