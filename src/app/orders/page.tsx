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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  RefreshCw,
  Download,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Eye,
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
} from 'lucide-react';
import Link from 'next/link';

// 订单状态类型
type OrderStatus = 
  | 'awaiting_packaging' 
  | 'awaiting_deliver' 
  | 'delivering' 
  | 'delivered' 
  | 'returned' 
  | 'cancelled';

// 订单数据类型 - 匹配API返回结构
interface Order {
  id: string;
  ozonOrderId: string;
  postingNumber: string;
  shopId: string;
  shopName: string;
  status: OrderStatus;
  buyerName: string | null;
  buyerPhone: string | null;
  recipientName: string | null;
  recipientCity: string | null;
  totalPrice: string;
  trackingNumber: string | null;
  isPurchaseBound: boolean;
  isInspected: boolean;
  isPacked: boolean;
  isSettled: boolean;
  createdAt: string;
  shippedAt: string | null;
}

// 状态映射 - 使用主系统企业风格色彩
const statusMap: Record<string, { label: string; color: string }> = {
  awaiting_packaging: { label: '待打包', color: 'bg-[#FFF7ED] text-[#C2410C]' }, // 橙色系-待处理
  awaiting_deliver: { label: '待发货', color: 'bg-[#EFF6FF] text-[#2F6BFF]' }, // 品牌蓝
  delivering: { label: '配送中', color: 'bg-[#EFF6FF] text-[#2F6BFF]' }, // 品牌蓝
  delivered: { label: '已送达', color: 'bg-[#ECFDF5] text-[#16A37B]' }, // 成功绿
  returned: { label: '已退货', color: 'bg-[#FEF2F2] text-[#DC2626]' }, // 红色
  cancelled: { label: '已取消', color: 'bg-[#F3F4F6] text-[#637089]' }, // 次文本色
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

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
      // 修复：API返回 data.data.orders
      setOrders(data.data?.orders || []);
    } catch (error) {
      console.error('获取订单失败:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

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
      }
    } catch (error) {
      console.error('同步订单失败:', error);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
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

  const getStatusBadge = (status: string) => {
    const info = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-500' };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${info.color}`}>
        {info.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-[#E6EAF2] bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center">
            <Box className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base text-[#152033]">Ozon ERP</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">3</span>
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2F6BFF]/10 rounded-full flex items-center justify-center text-[#2F6BFF] font-medium text-sm">初</div>
            <span className="text-sm font-medium text-[#152033]">小初</span>
          </div>
        </div>
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 3.5rem)' }}>
        {/* 侧边栏 */}
        <aside className="w-56 shrink-0 bg-white border-r border-[#E6EAF2] overflow-y-auto">
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
          </div>

          {/* 筛选栏 */}
          <Card className="mb-4 shadow-sm border-[#E6EAF2]">
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
                    <SelectItem value="awaiting_deliver">待发货</SelectItem>
                    <SelectItem value="delivering">配送中</SelectItem>
                    <SelectItem value="delivered">已送达</SelectItem>
                    <SelectItem value="cancelled">已取消</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={syncOrders} disabled={syncing} className="bg-[#2F6BFF] hover:bg-[#2F6BFF]/90">
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? '同步中...' : '同步订单'}
                </Button>

                <Button variant="outline" className="border-[#E6EAF2]">
                  <Download className="w-4 h-4 mr-2" />
                  导出
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 批量操作栏 */}
          {selectedOrders.size > 0 && (
            <div className="bg-[#2F6BFF]/10 border border-[#2F6BFF]/20 rounded-lg px-4 py-2 mb-4 flex items-center gap-4">
              <span className="text-sm text-[#2F6BFF]">已选择 {selectedOrders.size} 条订单</span>
              <Button size="sm" variant="outline" className="border-[#E6EAF2]">批量标记发货</Button>
              <Button size="sm" variant="outline" className="border-[#E6EAF2]">创建采购任务</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedOrders(new Set())}>取消选择</Button>
            </div>
          )}

          {/* 订单列表 */}
          <Card className="shadow-sm border-[#E6EAF2]">
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
                  <TableHead>发货单号</TableHead>
                  <TableHead>店铺</TableHead>
                  <TableHead>买家</TableHead>
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
                      <TableCell><Skeleton className="w-32 h-4" /></TableCell>
                      <TableCell><Skeleton className="w-20 h-4" /></TableCell>
                      <TableCell><Skeleton className="w-20 h-4" /></TableCell>
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
                          {order.ozonOrderId}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-[#637089]">
                        {order.postingNumber}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                          {order.shopName}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.buyerName || '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell className="text-sm text-[#637089]">
                        {new Date(order.createdAt).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
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
                      <span className="text-[#637089]">Ozon订单号</span>
                      <span className="font-medium">{detailOrder.ozonOrderId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">发货单号</span>
                      <span className="font-medium">{detailOrder.postingNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">店铺</span>
                      <span className="font-medium">{detailOrder.shopName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">状态</span>
                      {getStatusBadge(detailOrder.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">下单时间</span>
                      <span>{new Date(detailOrder.createdAt).toLocaleString('zh-CN')}</span>
                    </div>
                    {detailOrder.shippedAt && (
                      <div className="flex justify-between">
                        <span className="text-[#637089]">发货时间</span>
                        <span>{new Date(detailOrder.shippedAt).toLocaleString('zh-CN')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 买家信息 */}
                <div>
                  <h3 className="font-medium mb-3 text-[#152033]">买家信息</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#637089]">买家姓名</span>
                      <span className="font-medium">{detailOrder.buyerName || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">联系电话</span>
                      <span>{detailOrder.buyerPhone || '-'}</span>
                    </div>
                    {detailOrder.recipientCity && (
                      <div className="flex justify-between">
                        <span className="text-[#637089]">收货城市</span>
                        <span>{detailOrder.recipientCity}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 流程状态 */}
                <div>
                  <h3 className="font-medium mb-3 text-[#152033]">流程状态</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#637089]">采购绑定</span>
                      <span className={detailOrder.isPurchaseBound ? 'text-[#16A37B]' : 'text-[#2F6BFF]'}>
                        {detailOrder.isPurchaseBound ? '已绑定' : '待绑定'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">入库验货</span>
                      <span className={detailOrder.isInspected ? 'text-[#16A37B]' : 'text-[#2F6BFF]'}>
                        {detailOrder.isInspected ? '已验货' : '待验货'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">打包状态</span>
                      <span className={detailOrder.isPacked ? 'text-[#16A37B]' : 'text-[#2F6BFF]'}>
                        {detailOrder.isPacked ? '已打包' : '待打包'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#637089]">财务结算</span>
                      <span className={detailOrder.isSettled ? 'text-[#16A37B]' : 'text-[#2F6BFF]'}>
                        {detailOrder.isSettled ? '已结算' : '待结算'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 物流信息 */}
                {detailOrder.trackingNumber && (
                  <div>
                    <h3 className="font-medium mb-3 text-[#152033]">物流信息</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#637089]">物流单号</span>
                        <span className="font-medium">{detailOrder.trackingNumber}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
