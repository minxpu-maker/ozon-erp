'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  RefreshCw,
  Download,
  Package,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  Eye,
  MoreHorizontal,
  Bell,
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Box,
  Calculator,
  PackageSearch,
  Warehouse,
  Database,
  Users,
  BarChart3,
  UserCircle,
  Shield,
  Settings,
  ChevronDown,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

// 订单状态类型
type OrderStatus =
  | 'awaiting_packaging'
  | 'awaiting_delivering'
  | 'delivered'
  | 'returned'
  | 'cancelled';

// 订单数据类型
interface OrderItem {
  offer_id: string;
  name: string;
  quantity: number;
  price: string;
  image?: string;
}

interface Order {
  id: string;
  posting_number: string;
  order_id: string;
  order_number: string;
  status: OrderStatus;
  items: OrderItem[];
  buyer?: {
    name: string;
    phone?: string;
  };
  total_price: string;
  created_at: string;
  in_process_at: string;
  warehouse_id?: string;
  warehouse_name?: string;
}

// 状态映射
const statusMap: Record<OrderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  awaiting_packaging: { label: '待打包', variant: 'secondary', color: 'text-amber-600' },
  awaiting_delivering: { label: '待发货', variant: 'default', color: 'text-blue-600' },
  delivered: { label: '已发货', variant: 'outline', color: 'text-green-600' },
  returned: { label: '已退货', variant: 'destructive', color: 'text-red-600' },
  cancelled: { label: '已取消', variant: 'destructive', color: 'text-gray-500' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [syncStatus, setSyncStatus] = useState<{
    lastSync: string;
    nextSync: string;
    total: number;
  } | null>(null);

  // 订单详情抽屉
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  // 获取订单列表
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('获取订单失败:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  // 获取同步状态
  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('/api/orders/sync-status');
      const data = await res.json();
      setSyncStatus(data);
    } catch (error) {
      console.error('获取同步状态失败:', error);
    }
  };

  // 同步订单
  const syncOrders = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
        fetchSyncStatus();
      }
    } catch (error) {
      console.error('同步订单失败:', error);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchSyncStatus();
  }, [fetchOrders]);

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  // 单选
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedOrders(newSelected);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-[#E6EAF2]/50 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center">
            <Box className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base">Ozon ERP</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" className="relative">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">3</span>
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2F6BFF]/10 rounded-full flex items-center justify-center text-[#2F6BFF] font-medium text-sm">初</div>
            <span className="text-sm font-medium">小初</span>
          </div>
        </div>
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 3.5rem)' }}>
        {/* 侧边栏 */}
        <aside className="w-56 shrink-0 bg-white border-r border-[#E6EAF2]/50 overflow-y-auto">
          <div className="p-3 space-y-0.5">
            <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <LayoutDashboard className="w-4 h-4" />仪表盘
            </Link>
            <Link href="/orders" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#2F6BFF]/10 text-[#2F6BFF] font-medium text-sm" aria-current="page">
              <ShoppingCart className="w-4 h-4" />订单管理
            </Link>
            <Link href="/purchase" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <Package className="w-4 h-4" />采购管理
            </Link>
            <Link href="/quick-entry" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <ClipboardList className="w-4 h-4" />快捷录单
            </Link>
            <Link href="/logistics" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <Truck className="w-4 h-4" />入库验货
            </Link>
            <Link href="/packaging" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <Box className="w-4 h-4" />打包发货
            </Link>
            <Link href="/finance" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <Calculator className="w-4 h-4" />财务核算
            </Link>
            <div className="pt-3 pb-1">
              <span className="px-3 text-xs font-medium text-[#637089]/60 uppercase tracking-wider">库存管理</span>
            </div>
            <Link href="/inventory" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <PackageSearch className="w-4 h-4" />库存管理
            </Link>
            <Link href="/wms" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <Warehouse className="w-4 h-4" />仓库管理
            </Link>
            <div className="pt-3 pb-1">
              <span className="px-3 text-xs font-medium text-[#637089]/60 uppercase tracking-wider">数据中心</span>
            </div>
            <Link href="/sku-management" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <Database className="w-4 h-4" />SKU管理
            </Link>
            <Link href="/suppliers" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <Users className="w-4 h-4" />供应商管理
            </Link>
            <Link href="/reports" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <BarChart3 className="w-4 h-4" />数据报表
            </Link>
            <div className="pt-3 pb-1">
              <span className="px-3 text-xs font-medium text-[#637089]/60 uppercase tracking-wider">系统</span>
            </div>
            <Link href="/accounts" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <UserCircle className="w-4 h-4" />账号管理
            </Link>
            <Link href="/roles" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <Shield className="w-4 h-4" />角色权限
            </Link>
            <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#637089] hover:bg-[#EEF1F6] font-medium text-sm transition-colors">
              <Settings className="w-4 h-4" />系统设置
            </Link>
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-[#F6F8FB] p-6">
          {/* 页面标题 */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-[#152033]">订单管理</h1>
            {syncStatus && (
              <div className="flex items-center gap-2 text-sm text-[#637089] bg-[#EEF1F6] px-4 py-2 rounded-lg">
                <RefreshCw className="w-4 h-4" />
                <span>最近同步: {syncStatus.lastSync}</span>
                <span className="text-[#637089]/50">|</span>
                <span>下次自动同步: {syncStatus.nextSync}</span>
              </div>
            )}
          </div>

          {/* 筛选栏 */}
          <Card className="mb-4 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px] max-w-[300px]">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#637089]" />
                    <Input
                      placeholder="搜索订单号..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-[#EEF1F6] border-none"
                    />
                  </div>
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-[#EEF1F6] border-none">
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="awaiting_packaging">待打包</SelectItem>
                    <SelectItem value="awaiting_delivering">待发货</SelectItem>
                    <SelectItem value="delivered">已发货</SelectItem>
                    <SelectItem value="returned">已退货</SelectItem>
                    <SelectItem value="cancelled">已取消</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={syncOrders} disabled={syncing}>
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? '同步中...' : '同步订单'}
                </Button>

                <Button variant="outline">
                  <Download className="w-4 h-4" />
                  导出
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 批量操作栏 */}
          {selectedOrders.size > 0 && (
            <div className="bg-[#2F6BFF]/10 border border-[#2F6BFF]/20 rounded-lg px-4 py-2 mb-4 flex items-center gap-4">
              <span className="text-sm text-[#2F6BFF]">已选择 {selectedOrders.size} 条订单</span>
              <Button size="sm" variant="outline">批量标记发货</Button>
              <Button size="sm" variant="outline">创建采购任务</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedOrders(new Set())}>取消选择</Button>
            </div>
          )}

          {/* 订单列表 */}
          <Card className="shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#EEF1F6]/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedOrders.size === orders.length && orders.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>订单号</TableHead>
                  <TableHead>商品信息</TableHead>
                  <TableHead>买家</TableHead>
                  <TableHead>订单金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>下单时间</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="w-4 h-4" /></TableCell>
                      <TableCell><Skeleton className="w-32 h-4" /></TableCell>
                      <TableCell><Skeleton className="w-48 h-4" /></TableCell>
                      <TableCell><Skeleton className="w-20 h-4" /></TableCell>
                      <TableCell><Skeleton className="w-16 h-4" /></TableCell>
                      <TableCell><Skeleton className="w-16 h-4" /></TableCell>
                      <TableCell><Skeleton className="w-24 h-4" /></TableCell>
                      <TableCell><Skeleton className="w-16 h-4" /></TableCell>
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-[#637089]">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>暂无订单数据</p>
                      <p className="text-sm mt-2">点击"同步订单"从Ozon获取订单</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-[#F6F8FB]">
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.has(order.id)}
                          onCheckedChange={() => toggleSelect(order.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => setDetailOrder(order)}
                          className="text-[#2F6BFF] hover:underline font-medium"
                        >
                          {order.posting_number}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {order.items[0]?.image && (
                            <div className="w-10 h-10 rounded bg-[#EEF1F6] overflow-hidden relative">
                              <Image
                                src={order.items[0].image}
                                alt={order.items[0].name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate max-w-[200px]">
                              {order.items[0]?.name || '-'}
                            </p>
                            <p className="text-xs text-[#637089]">
                              {order.items.length > 1 ? `等${order.items.length}件商品` : `x${order.items[0]?.quantity || 1}`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{order.buyer?.name || '-'}</TableCell>
                      <TableCell className="font-medium">¥{order.total_price}</TableCell>
                      <TableCell>
                        <Badge variant={statusMap[order.status].variant} className={statusMap[order.status].color}>
                          {statusMap[order.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-[#637089]">
                        {new Date(order.created_at).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDetailOrder(order)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </main>
      </div>

      {/* 订单详情抽屉 */}
      <Sheet open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <SheetContent className="w-[500px] overflow-y-auto">
          {detailOrder && (
            <>
              <SheetHeader>
                <SheetTitle>订单详情</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* 基本信息 */}
                <div>
                  <h3 className="font-medium mb-3 text-[#152033]">基本信息</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#637089]">订单号</span>
                      <span className="font-medium">{detailOrder.posting_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">状态</span>
                      <Badge variant={statusMap[detailOrder.status].variant}>
                        {statusMap[detailOrder.status].label}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">下单时间</span>
                      <span>{new Date(detailOrder.created_at).toLocaleString('zh-CN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">仓库</span>
                      <span>{detailOrder.warehouse_name || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* 商品列表 */}
                <div>
                  <h3 className="font-medium mb-3 text-[#152033]">商品列表</h3>
                  <div className="space-y-3">
                    {detailOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-[#F6F8FB] rounded-lg">
                        {item.image && (
                          <div className="w-12 h-12 rounded bg-white overflow-hidden relative">
                            <Image src={item.image} alt={item.name} fill className="object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-[#637089]">SKU: {item.offer_id}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">¥{item.price}</p>
                          <p className="text-xs text-[#637089]">x{item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 买家信息 */}
                {detailOrder.buyer && (
                  <div>
                    <h3 className="font-medium mb-3 text-[#152033]">买家信息</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#637089]">姓名</span>
                        <span>{detailOrder.buyer.name}</span>
                      </div>
                      {detailOrder.buyer.phone && (
                        <div className="flex justify-between">
                          <span className="text-[#637089]">电话</span>
                          <span>{detailOrder.buyer.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 金额信息 */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[#637089]">订单总额</span>
                    <span className="text-xl font-bold text-[#152033]">¥{detailOrder.total_price}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
