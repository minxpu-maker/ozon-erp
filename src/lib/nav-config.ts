'use client';

import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Truck,
  Box,
  Calculator,
  Target,
  Image,
  PackageSearch,
  Warehouse,
  Database,
  Users,
  BarChart3,
  Activity,
  Server,
  Bell,
  UserCircle,
  Shield,
  Settings,
  Store,
  LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href?: string;
  icon?: LucideIcon;
  label: string;
  type?: 'divider' | 'link';
  active?: boolean;
}

// 统一的导航配置
export const NAV_CONFIG: Omit<NavItem, 'active'>[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
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
  { href: '/settings/shop-config', icon: Store, label: '店铺配置' },
];

// 生成带 active 状态的导航项
export function getNavItems(currentPath: string): NavItem[] {
  return NAV_CONFIG.map(item => {
    if (item.type === 'divider') {
      return item;
    }
    return {
      ...item,
      active: currentPath === item.href || currentPath.startsWith(item.href + '/'),
    };
  });
}

// 导出所有需要的图标，方便页面使用
export {
  LayoutDashboard,
  Package,
  ClipboardList,
  Truck,
  Box,
  Calculator,
  Target,
  Image,
  PackageSearch,
  Warehouse,
  Database,
  Users,
  BarChart3,
  Activity,
  Server,
  Bell,
  UserCircle,
  Shield,
  Settings,
  Store,
};
