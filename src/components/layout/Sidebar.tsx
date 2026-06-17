'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Package,
  Truck,
  DollarSign,
  BarChart3,
  Settings,
  Users,
  Database,
  Warehouse,
  Tags,
  CreditCard,
  Boxes,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Store,
  Scale,
  Bell,
  Hexagon,
  Scan,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShopStore } from '@/stores/shop-store';
import { TopBar } from './TopBar';

interface Shop { id: string; name: string; platform: string | null; }

interface NavItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
  disabled?: boolean;
  badge?: string;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultExpanded?: boolean;
}

// 导航配置 - 按履约数据流组织
const navGroups: NavGroup[] = [
  {
    label: '仪表盘',
    icon: LayoutDashboard,
    defaultExpanded: true,
    items: [
      { label: '首页概览', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: '订单管理',
    icon: ShoppingCart,
    defaultExpanded: true,
    items: [
      { label: '订单列表', href: '/orders/list', icon: ShoppingCart },
    ],
  },
  {
    label: '采购中心',
    icon: Package,
    defaultExpanded: false,
    items: [
      { label: '采购工作台', href: '/purchase/workspace', icon: Package },
      { label: '货源池', icon: Boxes, disabled: true, badge: '即将上线' },
      { label: '供应商管理', href: '/purchase/vendors', icon: Users },
    ],
  },
  {
    label: '仓储发货',
    icon: Warehouse,
    defaultExpanded: false,
    items: [
      { label: '入库验货', href: '/warehouse/inspection', icon: Truck },
      { label: '打包发货', href: '/warehouse/shipping', icon: Package },
    ],
  },
  {
    label: '财务中心',
    icon: DollarSign,
    defaultExpanded: false,
    items: [
      { label: '利润看板', href: '/finance/profit', icon: BarChart3 },
      { label: '运费核对', href: '/finance/freight', icon: Scale },
    ],
  },
  {
    label: '数据中心',
    icon: Database,
    defaultExpanded: false,
    items: [
      { label: '数据驾驶舱', icon: Hexagon, disabled: true, badge: 'P4' },
      { label: 'SKU管理', href: '/data/sku', icon: Tags },
      { label: '数据报表', icon: BarChart3, disabled: true, badge: 'P4' },
    ],
  },
  {
    label: '系统设置',
    icon: Settings,
    defaultExpanded: false,
    items: [
      { label: '店铺管理', href: '/settings/shops', icon: Store },
      { label: '硬件设备', href: '/settings/devices', icon: Scan },
    ],
  },
];

// 快捷键映射
const shortcutKeys: Record<string, number> = {
  '1': 0, // 仪表盘
  '2': 1, // 订单管理
  '3': 2, // 采购中心
  '4': 3, // 仓储发货
  '5': 4, // 财务中心
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentShopId } = useShopStore();
  const { data: shops } = useSWR<Shop[]>('/api/shops');
  const currentShop = shops?.find(s => s.id === currentShopId);
  const [collapsed, setCollapsed] = useState(false);
  // 初始状态使用默认值，避免 hydration 不匹配
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    navGroups.forEach((group, idx) => {
      initial[idx] = group.defaultExpanded || false;
    });
    return initial;
  });

  // 客户端 hydration 后根据实际路径更新展开状态
  useEffect(() => {
    const newState: Record<number, boolean> = {};
    navGroups.forEach((group, idx) => {
      const hasActiveChild = group.items.some(
        item => item.href && pathname.startsWith(item.href)
      );
      newState[idx] = group.defaultExpanded || hasActiveChild;
    });
    setExpandedGroups(newState);
  }, [pathname]);

  // 检查是否有子项高亮
  const isGroupActive = useCallback((group: NavGroup) => {
    return group.items.some(item => item.href && pathname.startsWith(item.href));
  }, [pathname]);

  // 切换分组展开/折叠
  const toggleGroup = (idx: number) => {
    setExpandedGroups(prev => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // 快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 排除在输入框中
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const groupIdx = shortcutKeys[e.key];
      if (groupIdx !== undefined) {
        e.preventDefault();
        const group = navGroups[groupIdx];
        // 展开分组
        setExpandedGroups(prev => ({ ...prev, [groupIdx]: true }));
        // 跳转到第一个可用子项
        const firstAvailable = group.items.find(item => item.href && !item.disabled);
        if (firstAvailable?.href) {
          router.push(firstAvailable.href);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return (
    <aside
      className={cn(
        'h-full bg-slate-900 text-white flex flex-col transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo区域 */}
      <div className="h-14 flex items-center px-4 border-b border-slate-800 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
            <Store className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm">Ozon ERP</span>
          )}
        </Link>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navGroups.map((group, groupIdx) => {
          const Icon = group.icon;
          const isActive = isGroupActive(group);
          const isExpanded = expandedGroups[groupIdx];

          return (
            <div key={groupIdx} className="mb-1">
              {/* 分组标题 */}
              <button
                onClick={() => toggleGroup(groupIdx)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  collapsed && 'justify-center'
                )}
                title={collapsed ? group.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{group.label}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </>
                )}
              </button>

              {/* 子菜单 */}
              {!collapsed && isExpanded && (
                <div className="mt-1 ml-2 space-y-0.5 overflow-hidden transition-all duration-300">
                  {group.items.map((item, itemIdx) => {
                    const ItemIcon = item.icon;
                    const isItemActive = item.href && pathname.startsWith(item.href);

                    if (item.disabled) {
                      return (
                        <div
                          key={itemIdx}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 cursor-not-allowed"
                          title={item.badge}
                        >
                          {ItemIcon && <ItemIcon className="w-4 h-4 shrink-0" />}
                          <span className="flex-1">{item.label}</span>
                          {item.badge && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={itemIdx}
                        href={item.href || '#'}
                        onClick={(e) => {
                          if (!item.href) e.preventDefault();
                        }}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                          isItemActive
                            ? 'bg-blue-500 text-white'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        )}
                      >
                        {ItemIcon && <ItemIcon className="w-4 h-4 shrink-0" />}
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 店铺信息 + 折叠按钮 */}
      <div className="p-2 border-t border-slate-800 shrink-0">
        {/* 店铺指示器 */}
        {!collapsed && currentShopId && (
          <div className="px-3 py-2 mb-2 text-xs text-slate-400 bg-slate-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Store className="w-3 h-3" />
              <span>店铺筛选: ID {currentShopId}</span>
            </div>
          </div>
        )}

        {/* 折叠按钮 */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          {collapsed ? (
            <PanelLeft className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4 shrink-0" />
              <span>收起菜单</span>
            </>
          )}
        </button>

        {/* 快捷键提示 */}
        {!collapsed && (
          <div className="mt-2 px-3 text-[10px] text-slate-500">
            <div className="flex items-center gap-2 mb-1">
              <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">1-5</kbd>
              <span>切换分组</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">/</kbd>
              <span>全局搜索</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
