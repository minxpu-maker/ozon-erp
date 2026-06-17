'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import useSWR from 'swr';
import { useShopStore } from '@/stores/shop-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Search,
  ScanBarcode,
  Package,
  Truck,
} from 'lucide-react';

// API fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Shop {
  id: number;
  name: string;
  is_primary: boolean;
}

interface PurchaseDemand {
  id: number;
  shipment_deadline: string;
}

interface ShipmentItem {
  id: number;
}

// 店铺切换器
function ShopSwitcher() {
  const { data: shops, isLoading } = useSWR<{ data: Shop[] }>(
    '/api/shops',
    fetcher,
    { refreshInterval: 0 }
  );
  const { currentShopId, setShopId, clearShopId } = useShopStore();

  const currentShop = shops?.data?.find((s: Shop) => s.id === currentShopId);
  const displayName = currentShop?.name || '全部门店';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-9 min-w-[140px] justify-between font-normal"
        >
          <span className="truncate">{displayName}</span>
          <span className="ml-2 text-muted-foreground">▼</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        <DropdownMenuItem
          onClick={() => clearShopId()}
          className={!currentShopId ? 'bg-accent font-medium' : ''}
        >
          全部门店
        </DropdownMenuItem>
        {shops?.data?.map((shop: Shop) => (
          <DropdownMenuItem
            key={shop.id}
            onClick={() => setShopId(shop.id)}
            className={currentShopId === shop.id ? 'bg-accent font-medium' : ''}
          >
            {shop.name}
            {shop.is_primary && (
              <Badge variant="secondary" className="ml-2 text-xs">
                主
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// 超时铃铛
function UrgentBell() {
  const router = useRouter();

  // 获取待采购需求，过滤24小时内超时的
  const { data: demands } = useSWR<{ data: PurchaseDemand[] }>(
    '/api/purchase-demands?status=pending',
    fetcher,
    { refreshInterval: 30000 }
  );

  const urgentCount = demands?.data?.filter((d: { shipment_deadline?: string }) => {
    if (!d.shipment_deadline) return false;
    const deadline = new Date(d.shipment_deadline);
    const now = new Date();
    const hoursUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntil <= 24 && hoursUntil >= 0;
  }).length || 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      onClick={() => router.push('/purchase/workspace?filter=urgent')}
      title="超时提醒"
    >
      <Bell className="h-5 w-5" />
      {urgentCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
        >
          {urgentCount > 9 ? '9+' : urgentCount}
        </Badge>
      )}
    </Button>
  );
}

// 全局扫码框
function GlobalScanInput() {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState('');

  // 监听 / 键聚焦
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 排除在Input/Textarea内的情况
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        document.getElementById('global-scan-input')?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = useCallback(async () => {
    if (!value.trim()) return;

    const searchValue = value.trim();

    // 根据当前页面路由分发
    if (pathname.startsWith('/purchase')) {
      // 采购页面：搜索供应商/商品
      router.push(`/purchase/workspace?search=${encodeURIComponent(searchValue)}`);
    } else if (pathname.startsWith('/warehouse/inspection')) {
      // 验货页面：匹配快递单号
      router.push(`/warehouse/inspection/match?expressNo=${encodeURIComponent(searchValue)}`);
    } else if (pathname.startsWith('/warehouse/shipping')) {
      // 发货页面：搜索订单
      router.push(`/warehouse/shipping?search=${encodeURIComponent(searchValue)}`);
    } else {
      // 其他页面：全局搜索订单
      router.push(`/orders?search=${encodeURIComponent(searchValue)}`);
    }

    setValue('');
  }, [value, pathname, router]);

  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        id="global-scan-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSearch();
          }
        }}
        placeholder="扫码 / 搜索订单号... (按 / 聚焦)"
        className="pl-10 h-9 bg-muted/50 border-dashed"
      />
      <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    </div>
  );
}

// 待办胶囊
function TodoCapsules() {
  const router = useRouter();

  // 待采购数
  const { data: pendingPurchases } = useSWR<{ total: number }>(
    '/api/purchase-demands?status=pending',
    fetcher,
    { refreshInterval: 30000 }
  );

  // 待发货数
  const { data: pendingShipments } = useSWR<{ total: number }>(
    '/api/shipments',
    fetcher,
    { refreshInterval: 30000 }
  );

  const purchaseCount = pendingPurchases?.total || 0;
  const shipmentCount = pendingShipments?.total || 0;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 text-red-600 border-red-200 hover:bg-red-50"
        onClick={() => router.push('/purchase/workspace')}
      >
        <Package className="h-3.5 w-3.5" />
        待采购
        {purchaseCount > 0 && (
          <Badge variant="destructive" className="ml-1 h-5 min-w-[20px]">
            {purchaseCount > 99 ? '99+' : purchaseCount}
          </Badge>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
        onClick={() => router.push('/warehouse/shipping')}
      >
        <Truck className="h-3.5 w-3.5" />
        待发货
        {shipmentCount > 0 && (
          <Badge variant="default" className="ml-1 h-5 min-w-[20px] bg-orange-500">
            {shipmentCount > 99 ? '99+' : shipmentCount}
          </Badge>
        )}
      </Button>
    </div>
  );
}

// TopBar主组件
export function TopBar() {
  return (
    <div className="sticky top-0 z-50 h-12 bg-background border-b border-border">
      <div className="flex items-center h-full px-4 gap-4">
        {/* 左侧：店铺切换器 */}
        <ShopSwitcher />

        {/* 中间：全局扫码框 */}
        <GlobalScanInput />

        {/* 右侧：超时铃铛 + 待办胶囊 */}
        <div className="flex items-center gap-2 ml-auto">
          <UrgentBell />
          <TodoCapsules />
        </div>
      </div>
    </div>
  );
}
