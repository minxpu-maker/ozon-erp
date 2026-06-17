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
  Search,
  TrendingUp,
  ArrowUpDown,
  Library,
  Monitor,
  Archive,
} from 'lucide-react';

export interface NavItem {
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}

export const getNavItems = (currentPath: string): NavItem[] => [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘', active: currentPath === '/dashboard' },
  { href: '/orders/list', icon: ClipboardList, label: '订单列表', active: currentPath.startsWith('/orders') },
  { href: '/quick-entry', icon: Package, label: '快捷录单', active: currentPath === '/quick-entry' },
  { href: '/suppliers', icon: Users, label: '供应商管理', active: currentPath === '/suppliers' },
  { href: '/logistics', icon: Truck, label: '入库验货', active: currentPath === '/logistics' },
  { href: '/packaging', icon: Box, label: '打包发货', active: currentPath === '/packaging' },
  { href: '/inventory', icon: PackageSearch, label: '库存管理', active: currentPath === '/inventory' },
  { href: '/wms', icon: Warehouse, label: '仓库管理', active: currentPath === '/wms' },
  { href: '/finance', icon: Calculator, label: '利润核算', active: currentPath === '/finance' || currentPath === '/finance/profit' },
  { href: '/finance/freight', icon: Truck, label: '运费核对', active: currentPath === '/finance/freight' },
  { href: '/selection', icon: Target, label: 'AI选品', active: currentPath.startsWith('/selection') },
  { href: '/image-listing', icon: Image, label: '修图上架', active: currentPath.startsWith('/image-listing') },
  { href: '/sku-management', icon: Database, label: 'SKU管理', active: currentPath === '/sku-management' },
  { href: '/reports', icon: BarChart3, label: '数据报表', active: currentPath === '/reports' },
  { href: '/data-center/source-health', icon: Activity, label: '数据源健康度', active: currentPath === '/data-center/source-health' },
  { href: '/data-center/source-management', icon: Server, label: '数据源管理', active: currentPath === '/data-center/source-management' },
  { href: '/data-center/notifications', icon: Bell, label: '知识库通知', active: currentPath === '/data-center/notifications' },
  { href: '/accounts', icon: UserCircle, label: '账号管理', active: currentPath === '/accounts' },
  { href: '/roles', icon: Shield, label: '角色权限', active: currentPath === '/roles' },
  { href: '/settings/shops', icon: Store, label: '店铺管理', active: currentPath === '/settings/shops' },
  { href: '/settings/devices', icon: Package, label: '硬件设备', active: currentPath === '/settings/devices' },
];
