'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Bell, User } from 'lucide-react';
import { useShop } from './ShopContext';

// 面包屑页面名映射
const PAGE_NAME_MAP: Record<string, string> = {
  '/dashboard': '首页',
  '/orders/list': '订单列表',
  '/purchase': '采购工作台',
  '/suppliers': '供应商管理',
  '/logistics': '入库验货',
  '/packaging': '打包发货',
  '/inventory': '库存管理',
  '/selection': 'AI选品',
  '/sku-management': 'SKU管理',
  '/accounts': '账号管理',
  '/roles': '角色权限',
  '/reports': '数据报表',
  '/wms': '仓库管理',
  '/finance': '财务核算',
  '/finance/profit': '利润看板',
  '/finance/freight': '运费核对',
  '/settings/shops': '店铺管理',
  '/settings/devices': '硬件设备',
};

// 面包屑组件
function Breadcrumb() {
  const pathname = usePathname();
  const pageName = PAGE_NAME_MAP[pathname] || '未命名页面';

  return (
    <nav className="flex items-center text-sm">
      <Link
        href="/dashboard"
        className="text-gray-400 hover:text-blue-500 transition-colors"
      >
        首页
      </Link>
      <span className="mx-2 text-gray-300">/</span>
      <span className="text-gray-900 font-medium">{pageName}</span>
    </nav>
  );
}

// 店铺切换器
function ShopSwitcher() {
  const { currentShop, setCurrentShop, shops, loading, error } = useShop();

  const displayName = error ? '--' : (loading ? '加载中...' : (currentShop?.name || '--'));

  return (
    <div className="relative">
      <select
        value={currentShop?.id || ''}
        onChange={(e) => {
          const shop = shops.find(s => s.id === e.target.value);
          if (shop) setCurrentShop(shop);
        }}
        disabled={loading || error}
        className="h-9 w-48 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:border-blue-400 cursor-pointer disabled:opacity-50"
      >
        {loading && <option value="">加载中...</option>}
        {error && <option value="">--</option>}
        {!loading && !error && shops.map(shop => (
          <option key={shop.id} value={shop.id}>
            {shop.name} {shop.code ? `(${shop.code})` : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

// TopBar主组件
export function TopBar() {
  return (
    <div className="h-14 bg-white border-b border-gray-100 flex items-center px-6">
      {/* 左侧：面包屑 */}
      <div className="flex-1">
        <Breadcrumb />
      </div>

      {/* 中间偏左：店铺切换器 */}
      <div className="flex-1 flex justify-center">
        <ShopSwitcher />
      </div>

      {/* 右侧：通知 + 用户头像 */}
      <div className="flex items-center gap-3 ml-auto">
        {/* 通知铃铛 */}
        <button
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          title="通知"
        >
          <Bell className="w-5 h-5 text-gray-500" />
        </button>

        {/* 用户头像 */}
        <button
          className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
          title="用户"
        >
          <User className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
}
