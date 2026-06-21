'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Package,
  Truck,
  Calculator,
  BarChart3,
  Target,
  Image,
  PackageSearch,
  Warehouse,
  Database,
  Users,
  Activity,
  Server,
  Bell,
  UserCircle,
  Shield,
  Settings,
  Store,
  ChevronDown,
  Lock,
  Search,
  TrendingUp,
  ArrowUpDown,
  Library,
  Eye,
  LineChart,
  Building2,
  Box,
  Bot,
} from 'lucide-react';
import { TopBar } from './TopBar';

interface NavItem {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  locked?: boolean;
}

interface NavGroup {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultExpanded?: boolean;
}

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});

  const navGroups: NavGroup[] = [
    {
      label: '仪表盘',
      icon: LayoutDashboard,
      items: [
        { name: '首页概览', href: '/dashboard' },
      ],
    },
    {
      label: '订单管理',
      icon: ClipboardList,
      items: [
        { name: '订单列表', href: '/orders/list' },
      ],
    },
    {
      label: '采购中心',
      icon: ShoppingCart,
      items: [
        { name: '采购工作台', href: '/purchase' },
        { name: '货源池', href: '/purchase/source-pool', locked: true },
        { name: '供应商管理', href: '/suppliers' },
      ],
    },
    {
      label: '仓储发货',
      icon: Package,
      items: [
        { name: '入库验货', href: '/logistics' },
        { name: '打包发货', href: '/packaging' },
        { name: '库存管理', href: '/inventory' },
        { name: '仓库管理', href: '/wms' },
      ],
    },
    {
      label: '财务中心',
      icon: Calculator,
      items: [
        { name: '利润核算', href: '/finance' },
        { name: '运费核对', href: '/finance/freight', locked: true },
      ],
    },
    {
      label: '选品中心',
      icon: Target,
      items: [
        { name: '选品列表', href: '/selection' },
        { name: '商品卡管理', href: '/selection/cards' },
        { name: '趋势分析', href: '/selection/trends' },
        { name: '选品规则', href: '/selection/rules' },
        { name: '选品复盘', href: '/selection/retrospective' },
      ],
    },
    {
      label: '关键词工具',
      icon: Search,
      items: [
        { name: '关键词库', href: '/keywords/library' },
        { name: '关键词挖掘', href: '/keywords/mining' },
        { name: '反查关键词', href: '/keywords/reverse' },
        { name: '趋势分析', href: '/keywords/trend' },
      ],
    },
    {
      label: '监控中心',
      icon: Activity,
      items: [
        { name: '监控概览', href: '/monitor/overview' },
        { name: '商品监控', href: '/monitor/products' },
        { name: '关键词监控', href: '/monitor/keywords' },
        { name: '店铺监控', href: '/monitor/shops' },
      ],
    },
    {
      label: '图文生成',
      icon: Image,
      items: [
        { name: '工作台', href: '/image-listing/workbench' },
        { name: '模板管理', href: '/image-listing/templates' },
        { name: '上架列表', href: '/image-listing/listing' },
        { name: '生成流水线', href: '/image-listing/pipeline' },
      ],
    },
    {
      label: '数据中心',
      icon: Database,
      items: [
        { name: '数据概览', href: '/data' },
        { name: 'SKU管理', href: '/sku-management' },
        { name: '数据报表', href: '/reports' },
        { name: '采集箱', href: '/collection-box' },
        { name: '数据源管理', href: '/data-center/source-management' },
        { name: '数据源健康度', href: '/data-center/source-health' },
        { name: '知识库通知', href: '/data-center/notifications' },
      ],
    },
    {
      label: '系统设置',
      icon: Settings,
      items: [
        { name: '店铺管理', href: '/settings/shops' },
        { name: '店铺配置', href: '/settings/shop-config' },
        { name: '硬件设备', href: '/settings/devices' },
        { name: '系统设置', href: '/settings' },
        { name: '插件设置', href: '/settings/extension-settings' },
        { name: '账号管理', href: '/accounts' },
        { name: '角色权限', href: '/roles' },
      ],
    },
  ];

  // 初始化展开状态
  useEffect(() => {
    const initial: Record<number, boolean> = {};
    navGroups.forEach((group, idx) => {
      initial[idx] = group.defaultExpanded || false;
    });
    setExpandedGroups(initial);

    // 客户端更新：如果当前路径匹配，自动展开对应分组
    const timer = setTimeout(() => {
      const newState: Record<number, boolean> = {};
      navGroups.forEach((group, idx) => {
        const hasActiveChild = group.items.some(
          item => item.href && pathname.startsWith(item.href)
        );
        newState[idx] = group.defaultExpanded || hasActiveChild;
      });
      setExpandedGroups(newState);
    }, 0);

    return () => clearTimeout(timer);
  }, [pathname]);

  const toggleGroup = (idx: number) => {
    setExpandedGroups(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // 检查路径是否匹配
  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  // 检查是否有活动子项
  const hasActiveChild = (group: NavGroup) => {
    return group.items.some(item => isActive(item.href));
  };

  if (isCollapsed) {
    return (
      <aside className="w-16 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-12 flex items-center justify-center border-b border-gray-200">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {navGroups.map((group, idx) => {
            const Icon = group.icon!;
            return (
              <div key={group.label} className="px-2 py-1">
                <Link
                  href={group.items[0].href}
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-lg transition-colors',
                    hasActiveChild(group)
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-500 hover:bg-gray-100'
                  )}
                  title={group.label}
                >
                  <Icon className="w-5 h-5" />
                </Link>
              </div>
            );
          })}
        </nav>
        <button
          onClick={() => setIsCollapsed(false)}
          className="h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-t border-gray-200"
          title="展开"
        >
          <ChevronDown className="w-4 h-4 rotate-90" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col">
      {/* 品牌标识 */}
      <div className="h-12 flex items-center gap-2 px-4 border-b border-gray-200 bg-blue-600">
        <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
          <Store className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-white">Ozon ERP</span>
      </div>

      {/* 店铺信息 */}
      <div className="h-10 flex items-center gap-2 px-4 border-b border-gray-100 bg-gray-50">
        <div className="w-2 h-2 bg-green-500 rounded-full" />
        <span className="text-xs text-gray-600">示例店铺</span>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navGroups.map((group, idx) => {
          const Icon = group.icon!;
          const isExpanded = expandedGroups[idx];
          const active = hasActiveChild(group);

          return (
            <div key={group.label} className="px-2">
              {/* 分组标题 */}
              <button
                onClick={() => toggleGroup(idx)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 transition-transform',
                    isExpanded ? 'rotate-180' : ''
                  )}
                />
              </button>

              {/* 子菜单 */}
              {isExpanded && (
                <div className="ml-3 mt-0.5 space-y-0.5">
                  {group.items.map((item) => (
                    <div key={item.href}>
                      {item.locked ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-gray-400 cursor-not-allowed">
                          <span>{item.name}</span>
                          <Lock className="w-3 h-3" />
                        </div>
                      ) : (
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all duration-150',
                            isActive(item.href)
                              ? 'bg-blue-50 text-blue-600 font-medium border-r-2 border-blue-500 pr-[calc(0.75rem-2px)]'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 focus-visible:bg-gray-50 focus-visible:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200'
                          )}
                        >
                          {item.name}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 折叠按钮 */}
      <button
        onClick={() => setIsCollapsed(true)}
        className="h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-t border-gray-200"
        title="折叠"
      >
        <ChevronDown className="w-4 h-4 -rotate-90" />
      </button>
    </aside>
  );
}
