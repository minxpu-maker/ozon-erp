'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
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
  badgeColor?: 'red' | 'yellow' | 'orange' | 'blue' | 'amber' | 'purple';
  badgeCountKey?: string;
  badgeUrgencyKey?: string;
  disabled?: boolean;
  group?: string;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  disabled?: boolean;
}

// 角标数量 key 配置
const BADGE_CONFIG = {
  '/orders/list': { key: 'ordersAwaitingDeliver', urgencyKey: 'ordersAwaitingDeliverUrgency' },
  '/purchase': { key: 'purchasePending', urgencyKey: 'purchasePendingUrgency' },
  '/packaging': { key: 'ordersPendingPackaging', urgencyKey: 'ordersPendingPackagingUrgency' },
};

// 全局角标数量 state
let globalBadgeCounts: Record<string, number> = {};
let globalBadgeErrors: Record<string, boolean> = {};
let globalBadgeUrgency: Record<string, { overdue: number; urgent: number; normal: number }> = {};
let setGlobalBadgeCounts: React.Dispatch<React.SetStateAction<Record<string, number>>> | null = null;
let setGlobalBadgeErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>> | null = null;
let setGlobalBadgeUrgency: React.Dispatch<React.SetStateAction<Record<string, { overdue: number; urgent: number; normal: number }>>> | null = null;

// 角标颜色类型
type BadgeColorType = 'red' | 'orange' | 'blue' | null;

// 根据紧急度获取角标颜色
function getBadgeColor(key: string): BadgeColorType {
  if (globalBadgeErrors[key]) return null;
  const urgency = globalBadgeUrgency[key];
  if (!urgency) {
    // 降级方案：没有urgencyBreakdown时使用总数判断
    const count = globalBadgeCounts[key];
    if (count === undefined || count === 0) return null;
    return 'blue';
  }
  const { overdue, urgent, normal } = urgency;
  const total = overdue + urgent + normal;
  if (total === 0) return null;
  if (overdue > 0) return 'red';
  if (urgent > 0) return 'orange';
  return 'blue';
}

// 获取角标数字显示
function getBadgeDisplay(key: string): string | null {
  if (globalBadgeErrors[key]) return '-';
  const count = globalBadgeCounts[key];
  if (count === undefined || count === 0) return null;
  if (count > 99) return '99+';
  return String(count);
}

// fetcher for SWR
const fetcher = (url: string) => fetch(url).then(async (r) => {
  if (!r.ok) throw new Error('请求失败');
  return r.json();
});

// 角标数量获取 Hook
function useBadgeCounts() {
  // 订单列表角标 - awaiting_deliver 状态（带紧急度分类）
  const { data: ordersData } = useSWR(
    '/api/orders?status=awaiting_deliver&pageSize=1&includeUrgencyBreakdown=true',
    fetcher,
    { refreshInterval: 30000 }
  );

  // 采购工作台角标 - purchasing 状态
  const { data: purchaseData } = useSWR(
    '/api/purchase?status=purchasing&pageSize=1',
    fetcher,
    { refreshInterval: 30000 }
  );

  // 打包发货角标 - packing 状态
  const { data: packagingData } = useSWR(
    '/api/orders?erpStatus=packing&pageSize=1&includeUrgencyBreakdown=true',
    fetcher,
    { refreshInterval: 30000 }
  );

  // 更新全局角标数量
  useEffect(() => {
    const newCounts: Record<string, number> = {};
    const newErrors: Record<string, boolean> = {};
    const newUrgency: Record<string, { overdue: number; urgent: number; normal: number }> = {};

    // 订单列表
    if (ordersData?.pagination?.total !== undefined) {
      newCounts.ordersAwaitingDeliver = ordersData.pagination.total;
      // 收集紧急度分类
      if (ordersData.urgencyBreakdown) {
        newUrgency.ordersAwaitingDeliverUrgency = ordersData.urgencyBreakdown;
      }
    } else if (ordersData?.success === false) {
      newErrors.ordersAwaitingDeliver = true;
    }

    // 采购工作台
    if (purchaseData?.total !== undefined) {
      newCounts.purchasePending = purchaseData.total;
    } else if (purchaseData?.success === false) {
      newErrors.purchasePending = true;
    }

    // 打包发货
    if (packagingData?.pagination?.total !== undefined) {
      newCounts.ordersPendingPackaging = packagingData.pagination.total;
      // 收集紧急度分类
      if (packagingData.urgencyBreakdown) {
        newUrgency.ordersPendingPackagingUrgency = packagingData.urgencyBreakdown;
      }
    } else if (packagingData?.success === false) {
      newErrors.ordersPendingPackaging = true;
    }

    globalBadgeCounts = { ...globalBadgeCounts, ...newCounts };
    globalBadgeErrors = { ...globalBadgeErrors, ...newErrors };
    globalBadgeUrgency = { ...globalBadgeUrgency, ...newUrgency };

    if (setGlobalBadgeCounts) {
      setGlobalBadgeCounts(prev => ({ ...prev, ...newCounts }));
    }
    if (setGlobalBadgeErrors) {
      setGlobalBadgeErrors(prev => ({ ...prev, ...newErrors }));
    }
    if (setGlobalBadgeUrgency) {
      setGlobalBadgeUrgency(prev => ({ ...prev, ...newUrgency }));
    }
  }, [ordersData, purchaseData, packagingData]);
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
    label: '订单管理',
    icon: FileText,
    items: [
      { name: '订单列表', href: '/orders/list', icon: FileText, badgeCountKey: 'ordersAwaitingDeliver', badgeUrgencyKey: 'ordersAwaitingDeliverUrgency' },
    ],
  },
  {
    label: '采购中心',
    icon: ShoppingCart,
    items: [
      { name: '采购工作台', href: '/purchase', icon: ShoppingCart, badgeCountKey: 'purchasePending', badgeUrgencyKey: 'purchasePendingUrgency' },
      { name: '货源池', href: '/purchase/source-pool', icon: ShoppingCart, disabled: true, badge: '即将上线' },
      { name: '供应商管理', href: '/suppliers', icon: Building2 },
    ],
  },
  {
    label: '仓储发货',
    icon: Package,
    items: [
      { name: '入库验货', href: '/logistics', icon: Truck },
      { name: '打包发货', href: '/packaging', icon: Package, badgeCountKey: 'ordersPendingPackaging', badgeUrgencyKey: 'ordersPendingPackagingUrgency' },
      { name: '库存管理', href: '/inventory', icon: Database },
      { name: '仓库管理', href: '/wms', icon: Building2, disabled: true, badge: '即将上线' },
    ],
  },
  {
    label: '财务中心',
    icon: Calculator,
    items: [
      { name: '利润看板', href: '/finance/profit', icon: BarChart3, disabled: true, badge: '即将上线' },
      { name: '运费核对', href: '/finance/freight', icon: FileText, disabled: true, badge: '即将上线' },
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
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [badgeErrors, setBadgeErrors] = useState<Record<string, boolean>>({});
  const [badgeUrgency, setBadgeUrgency] = useState<Record<string, { overdue: number; urgent: number; normal: number }>>({});

  // 设置全局引用
  useEffect(() => {
    setGlobalBadgeCounts = setBadgeCounts;
    setGlobalBadgeErrors = setBadgeErrors;
    setGlobalBadgeUrgency = setBadgeUrgency;
  }, []);

  // 加载角标数量
  useBadgeCounts();

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

                // 获取角标数字
                const badgeDisplay = item.badgeCountKey ? getBadgeDisplay(item.badgeCountKey) : null;
                // 动态计算角标颜色
                const urgencyKey = item.badgeUrgencyKey;
                const computedColor = urgencyKey ? getBadgeColor(urgencyKey) : null;
                const badgeColorClass = computedColor === 'red' ? 'bg-red-500'
                  : computedColor === 'orange' ? 'bg-amber-500'
                  : computedColor === 'blue' ? 'bg-blue-500'
                  : 'bg-gray-500';

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
                        {badgeDisplay && (
                          <span className={`ml-auto min-w-[18px] h-[18px] ${badgeColorClass} rounded-full flex items-center justify-center text-[10px] font-bold text-white`}>
                            {badgeDisplay}
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
        <div className="flex-1 p-6 overflow-auto bg-slate-50">
          {children}
        </div>
      </main>
    </div>
  );
}
