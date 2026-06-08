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
} from 'lucide-react';

export interface NavItem {
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  type?: 'divider';
}

export const getNavItems = (currentPath: string): NavItem[] => [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘', active: currentPath === '/dashboard' },
  { href: '/purchase', icon: Package, label: '采购管理', active: currentPath === '/purchase' },
  { href: '/quick-entry', icon: ClipboardList, label: '快捷录单', active: currentPath === '/quick-entry' },
  { href: '/logistics', icon: Truck, label: '入库验货', active: currentPath === '/logistics' },
  { href: '/packaging', icon: Box, label: '打包发货', active: currentPath === '/packaging' },
  { href: '/finance', icon: Calculator, label: '利润核算', active: currentPath === '/finance' },
  { type: 'divider', label: 'AI智能' },
  { href: '/selection', icon: Target, label: 'AI 选品', active: currentPath.startsWith('/selection') },
  { href: '/image-listing', icon: Image, label: '修图上架', active: currentPath.startsWith('/image-listing') },
  { type: 'divider', label: '库存管理' },
  { href: '/inventory', icon: PackageSearch, label: '库存管理', active: currentPath === '/inventory' },
  { href: '/wms', icon: Warehouse, label: '仓库管理', active: currentPath === '/wms' },
  { type: 'divider', label: '数据中心' },
  { href: '/sku-management', icon: Database, label: 'SKU管理', active: currentPath === '/sku-management' },
  { href: '/suppliers', icon: Users, label: '供应商管理', active: currentPath === '/suppliers' },
  { href: '/reports', icon: BarChart3, label: '数据报表', active: currentPath === '/reports' },
  { href: '/data-center/source-health', icon: Activity, label: '数据源健康度', active: currentPath === '/data-center/source-health' },
  { href: '/data-center/source-management', icon: Server, label: '数据源管理', active: currentPath === '/data-center/source-management' },
  { href: '/data-center/notifications', icon: Bell, label: '知识库通知', active: currentPath === '/data-center/notifications' },
  { type: 'divider', label: '系统' },
  { href: '/accounts', icon: UserCircle, label: '账号管理', active: currentPath === '/accounts' },
  { href: '/roles', icon: Shield, label: '角色权限', active: currentPath === '/roles' },
  { href: '/settings', icon: Settings, label: '系统设置', active: currentPath === '/settings' },
  { href: '/settings/shop-config', icon: Store, label: '店铺配置', active: currentPath === '/settings/shop-config' },
];
