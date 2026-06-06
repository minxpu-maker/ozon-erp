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
  Image as ImageIcon,
  ShoppingCart,
  Clock,
  CheckCircle,
  Link2,
} from 'lucide-react';
import { ProductImage } from '@/components/ui/image-viewer';
import Link from 'next/link';

// 采购状态类型 - 从Ozon订单状态映射
type PurchaseStatus = 
  | 'pending_purchase'   // 待采购 (Ozon: awaiting_deliver)
  | 'purchasing'         // 采购中
  | 'purchased'          // 已采购 (Ozon: delivering)
  | 'delivered'          // 已送达 (Ozon: delivered)
  | 'cancelled';         // 已取消

// 订单数据类型
interface ProductInfo {
  mainImage: string | null;
  name: string | null;
  offerId: string | null;
  sku: string | null;
}

interface Order {
  id: string;
  ozonOrderId: string;
  postingNumber: string;
  shopId: string;
  shopName: string;
  status: string; // Ozon原始状态
  purchaseStatus: PurchaseStatus; // 采购状态
  buyerName: string | null;
  totalPrice: string;
  trackingNumber: string | null;
  isPurchaseBound: boolean;
  isInspected: boolean;
  isPacked: boolean;
  createdAt: string;
  ozonCreatedAt: string | null;
  purchasePrice?: number; // 采购价（人民币）
  productInfo?: ProductInfo;
  products?: Array<{
    sku: number;
    name: string;
    offerId: string;
    quantity: number;
    price: string;
    image: string | null;
  }>;
}

// Ozon状态到采购状态的映射
const ozonToPurchaseStatus = (ozonStatus: string): PurchaseStatus => {
  switch (ozonStatus) {
    case 'awaiting_deliver':
    case 'awaiting_packaging':
      return 'pending_purchase';
    case 'delivering':
      return 'purchased';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
    case 'returned':
      return 'cancelled';
    default:
      return 'pending_purchase';
  }
};

// 采购状态显示映射
const purchaseStatusMap: Record<PurchaseStatus, { label: string; color: string }> = {
  pending_purchase: { label: '待采购', color: 'bg-[#FFF7ED] text-[#C2410C]' },
  purchasing: { label: '采购中', color: 'bg-[#EFF6FF] text-[#2F6BFF]' },
  purchased: { label: '已采购', color: 'bg-[#EFF6FF] text-[#2F6BFF]' },
  delivered: { label: '已送达', color: 'bg-[#ECFDF5] text-[#16A37B]' },
  cancelled: { label: '已取消', color: 'bg-[#F3F4F6] text-[#637089]' },
};

// 侧边栏导航
const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/purchase', icon: Package, label: '采购管理', active: true },
  { href: '/quick-entry', icon: ClipboardList, label: '快捷录单' },
  { href: '/logistics', icon: Truck, label: '入库验货' },
  { href: '/packaging', icon: Box, label: '打包发货' },
  { href: '/finance', icon: Calculator, label: '利润核算' },
  { type: 'divider', label: '库存管理' },
  { href: '/inventory', icon: PackageSearch, label: '库存管理' },
  { href: '/wms', icon: Warehouse, label: '仓库管理' },
  { type: 'divider', label: '数据中心' },
  { href: '/sku-management', icon: Database, label: 'SKU管理' },
  { href: '/suppliers', icon: Users, label: '供应商管理' },
  { href: '/reports', icon: BarChart3, label: '数据报表' },
  { type: 'divider', label: '系统管理' },
  { href: '/accounts', icon: UserCircle, label: '账号管理' },
  { href: '/roles', icon: Shield, label: '角色权限' },
  { href: '/settings', icon: Settings, label: '系统设置' },
];

export default function PurchasePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [rubToCny, setRubToCny] = useState(0.08);

  // 订单详情抽屉
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [editingPurchasePrice, setEditingPurchasePrice] = useState<string>('');
  const [savingPrice, setSavingPrice] = useState(false);

  // 更新采购价
  const updatePurchasePrice = async (orderId: string, price: number) => {
    setSavingPrice(true);
    try {
      const res = await fetch('/api/orders/purchase-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, purchasePrice: price }),
      });
      const data = await res.json();
      if (data.success) {
        // 更新本地状态
        setOrders(prev => prev.map(o => 
          o.id === orderId ? { ...o, purchasePrice: price } : o
        ));
        if (detailOrder?.id === orderId) {
          setDetailOrder(prev => prev ? { ...prev, purchasePrice: price } : null);
        }
      }
    } catch (error) {
      console.error('更新采购价失败:', error);
    } finally {
      setSavingPrice(false);
    }
  };

  // 获取实时汇率
  const fetchExchangeRate = useCallback(async () => {
    try {
      const res = await fetch('/api/exchange-rate');
      const data = await res.json();
      if (data.success && data.data?.rate) {
        setRubToCny(data.data.rate);
      }
    } catch (error) {
      console.error('获取汇率失败:', error);
    }
  }, []);

  // 获取订单列表（从采购视角）
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();
      const ordersData = data.data?.orders || [];
      
      // 处理订单数据，添加采购状态
      const processedOrders = ordersData.map((order: any) => ({
        ...order,
        purchaseStatus: ozonToPurchaseStatus(order.status),
        productInfo: order.products?.[0] ? {
          mainImage: order.products[0].image,
          name: order.products[0].name,
          offerId: order.products[0].offerId,
          sku: String(order.products[0].sku),
        } : null,
      }));
      
      setOrders(processedOrders);
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
        const results = data.data?.results || [];
        const totalFetched = results.reduce((sum: number, r: any) => sum + (r.fetched || 0), 0);
        const totalCreated = results.reduce((sum: number, r: any) => sum + (r.created || 0), 0);
        const totalUpdated = results.reduce((sum: number, r: any) => sum + (r.updated || 0), 0);
        alert(`同步成功！获取 ${totalFetched} 条，新增 ${totalCreated} 条，更新 ${totalUpdated} 条`);
        fetchOrders();
      } else {
        alert(data.error || '同步失败');
      }
    } catch (error) {
      console.error('同步订单失败:', error);
      alert('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  // 导出
  const handleExport = () => {
    alert('导出功能开发中');
  };

  // 统计数据
  const stats = {
    total: orders.length,
    pendingPurchase: orders.filter(o => o.purchaseStatus === 'pending_purchase').length,
    purchased: orders.filter(o => o.purchaseStatus === 'purchased').length,
    delivered: orders.filter(o => o.purchaseStatus === 'delivered').length,
  };

  useEffect(() => {
    fetchExchangeRate();
    fetchOrders();
  }, [fetchExchangeRate, fetchOrders]);

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex">
      {/* 侧边栏 */}
      <aside className="w-56 bg-white border-r border-[#E6EAF2] flex-shrink-0">
        <div className="p-4 border-b border-[#E6EAF2]">
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-[#2F6BFF]" />
            <span className="font-semibold text-[#152033]">Ozon ERP</span>
          </div>
        </div>
        <nav className="p-3">
          {navItems.map((item, idx) => {
            if (item.type === 'divider') {
              return (
                <div key={idx} className="mt-4 mb-2 px-2">
                  <span className="text-xs text-[#637089]">{item.label}</span>
                </div>
              );
            }
            const Icon = item.icon!;
            const isActive = item.active || false;
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  isActive
                    ? 'bg-[#EFF6FF] text-[#2F6BFF] font-medium'
                    : 'text-[#637089] hover:bg-[#F6F8FB]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* 页面标题 */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-[#152033]">采购管理</h1>
            <p className="text-[#637089] mt-1">同步Ozon订单，管理待采购商品</p>
          </div>

          {/* 统计卡片 - 紧凑布局 */}
          <div className="flex gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm">
              <div className="w-7 h-7 rounded-full bg-[#FFF7ED] flex items-center justify-center">
                <Clock className="w-4 h-4 text-[#C2410C]" />
              </div>
              <div>
                <p className="text-xs text-[#637089]">待采购</p>
                <p className="text-lg font-semibold text-[#152033]">{stats.pendingPurchase}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm">
              <div className="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-[#2F6BFF]" />
              </div>
              <div>
                <p className="text-xs text-[#637089]">已采购</p>
                <p className="text-lg font-semibold text-[#152033]">{stats.purchased}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm">
              <div className="w-7 h-7 rounded-full bg-[#ECFDF5] flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-[#16A37B]" />
              </div>
              <div>
                <p className="text-xs text-[#637089]">已送达</p>
                <p className="text-lg font-semibold text-[#152033]">{stats.delivered}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm">
              <div className="w-7 h-7 rounded-full bg-[#F6F8FB] flex items-center justify-center">
                <Package className="w-4 h-4 text-[#637089]" />
              </div>
              <div>
                <p className="text-xs text-[#637089]">订单总数</p>
                <p className="text-lg font-semibold text-[#152033]">{stats.total}</p>
              </div>
            </div>
          </div>

          {/* 操作栏 */}
          <Card className="bg-white border-none shadow-sm mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#637089]" />
                    <Input
                      placeholder="搜索订单号..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 bg-[#F6F8FB] border-[#E6EAF2]"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36 bg-[#F6F8FB] border-[#E6EAF2]">
                      <SelectValue placeholder="全部状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="awaiting_deliver">待采购</SelectItem>
                      <SelectItem value="delivering">已采购</SelectItem>
                      <SelectItem value="delivered">已送达</SelectItem>
                      <SelectItem value="cancelled">已取消</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={syncOrders}
                    disabled={syncing}
                    className="bg-[#2F6BFF] hover:bg-[#2F6BFF]/90"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? '同步中...' : '同步订单'}
                  </Button>
                  <Button variant="outline" onClick={handleExport} className="border-[#E6EAF2]">
                    <Download className="w-4 h-4 mr-2" />
                    导出
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 订单列表 */}
          <Card className="bg-white border-none shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#E6EAF2] hover:bg-transparent">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="text-[#637089]">订单号</TableHead>
                    <TableHead className="text-[#637089]">发货单号</TableHead>
                    <TableHead className="text-[#637089]">商品</TableHead>
                    <TableHead className="text-[#637089]">店铺</TableHead>
                    <TableHead className="text-[#637089]">状态</TableHead>
                    <TableHead className="text-[#637089]">销售金额</TableHead>
                    <TableHead className="text-[#637089]">采购价</TableHead>
                    <TableHead className="text-[#637089]">下单时间</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-b border-[#E6EAF2]">
                        <TableCell><Skeleton className="w-4 h-4" /></TableCell>
                        <TableCell><Skeleton className="w-24 h-4" /></TableCell>
                        <TableCell><Skeleton className="w-28 h-4" /></TableCell>
                        <TableCell><Skeleton className="w-32 h-4" /></TableCell>
                        <TableCell><Skeleton className="w-16 h-4" /></TableCell>
                        <TableCell><Skeleton className="w-20 h-4" /></TableCell>
                        <TableCell><Skeleton className="w-16 h-4" /></TableCell>
                        <TableCell><Skeleton className="w-16 h-4" /></TableCell>
                        <TableCell><Skeleton className="w-24 h-4" /></TableCell>
                        <TableCell><Skeleton className="w-4 h-4" /></TableCell>
                      </TableRow>
                    ))
                  ) : orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-[#637089]">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>暂无订单数据</p>
                        <p className="text-sm mt-1">点击"同步订单"获取Ozon订单</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow key={order.id} className="border-b border-[#E6EAF2]">
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedOrders);
                              if (checked) newSelected.add(order.id);
                              else newSelected.delete(order.id);
                              setSelectedOrders(newSelected);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-[#2F6BFF] font-medium">{order.ozonOrderId}</span>
                        </TableCell>
                        <TableCell className="text-[#152033]">{order.postingNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {order.productInfo?.mainImage ? (
                              <ProductImage src={order.productInfo.mainImage} size="sm" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-[#F6F8FB] flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-[#637089]" />
                              </div>
                            )}
                            <span className="truncate max-w-[120px] text-sm text-[#152033]">
                              {order.productInfo?.name || '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-[#EFF6FF] text-[#2F6BFF] hover:bg-[#EFF6FF]">
                            {order.shopName}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={purchaseStatusMap[order.purchaseStatus].color}>
                            {purchaseStatusMap[order.purchaseStatus].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[#152033] font-medium">
                          ¥{(parseFloat(order.totalPrice || '0') * rubToCny).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {order.purchasePrice ? (
                            <span className="text-[#16A37B] font-medium">¥{(parseFloat(String(order.purchasePrice)) || 0).toFixed(2)}</span>
                          ) : (
                            <span className="text-[#637089] text-sm">未录入</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[#637089] text-sm">
                          {order.ozonCreatedAt 
                            ? new Date(order.ozonCreatedAt).toLocaleString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              }).replace(/\//g, '/')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetailOrder(order)}
                            className="text-[#637089] hover:text-[#152033]"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 订单详情抽屉 */}
      <Sheet open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <SheetContent className="w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[#152033]">订单详情</SheetTitle>
          </SheetHeader>
          {detailOrder && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[#637089]">订单号</label>
                  <p className="text-[#152033] font-medium">{detailOrder.ozonOrderId}</p>
                </div>
                <div>
                  <label className="text-sm text-[#637089]">发货单号</label>
                  <p className="text-[#152033]">{detailOrder.postingNumber}</p>
                </div>
                <div>
                  <label className="text-sm text-[#637089]">店铺</label>
                  <p className="text-[#152033]">{detailOrder.shopName}</p>
                </div>
                <div>
                  <label className="text-sm text-[#637089]">采购状态</label>
                  <Badge className={purchaseStatusMap[detailOrder.purchaseStatus].color}>
                    {purchaseStatusMap[detailOrder.purchaseStatus].label}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm text-[#637089]">买家</label>
                  <p className="text-[#152033]">{detailOrder.buyerName || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-[#637089]">金额</label>
                  <p className="text-[#152033] font-medium">
                    ¥{(parseFloat(detailOrder.totalPrice || '0') * rubToCny).toFixed(2)}
                    <span className="text-[#637089] text-sm ml-1">
                      ({detailOrder.totalPrice} 卢布)
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm text-[#637089]">采购价 (¥)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={editingPurchasePrice}
                      onChange={(e) => setEditingPurchasePrice(e.target.value)}
                      placeholder="输入采购价"
                      className="w-32 h-8"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        const price = parseFloat(editingPurchasePrice);
                        if (!isNaN(price) && price >= 0) {
                          updatePurchasePrice(detailOrder.id, price);
                        }
                      }}
                      disabled={savingPrice || !editingPurchasePrice}
                    >
                      {savingPrice ? '保存中...' : '保存'}
                    </Button>
                  </div>
                  {detailOrder.purchasePrice ? (
                    <p className="text-xs text-[#16A37B] mt-1">已录入: ¥{(parseFloat(String(detailOrder.purchasePrice)) || 0).toFixed(2)}</p>
                  ) : null}
                </div>
              </div>
              
              {/* 利润预估 */}
              {detailOrder.purchasePrice ? (
                <div className="border-t border-[#E6EAF2] pt-4">
                  <label className="text-sm text-[#637089]">利润预估</label>
                  <div className="mt-2 p-3 bg-[#ECFDF5] rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-[#637089]">销售收入</span>
                      <span className="font-medium">¥{(parseFloat(detailOrder.totalPrice || '0') * rubToCny).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[#637089]">采购成本</span>
                      <span className="font-medium text-red-500">-¥{(parseFloat(String(detailOrder.purchasePrice)) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#E6EAF2]">
                      <span className="text-[#152033] font-medium">预估利润</span>
                      <span className={`font-bold ${(parseFloat(detailOrder.totalPrice || '0') * rubToCny - (parseFloat(String(detailOrder.purchasePrice)) || 0)) >= 0 ? 'text-[#16A37B]' : 'text-red-500'}`}>
                        ¥{(parseFloat(detailOrder.totalPrice || '0') * rubToCny - (parseFloat(String(detailOrder.purchasePrice)) || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
              
              <div className="border-t border-[#E6EAF2] pt-4">
                <label className="text-sm text-[#637089]">商品信息</label>
                {detailOrder.products?.map((product, idx) => (
                  <div key={idx} className="mt-2 p-3 bg-[#F6F8FB] rounded-lg">
                    <div className="flex items-start gap-3">
                      {product.image ? (
                        <ProductImage src={product.image} size="md" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-white flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-[#637089]" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm text-[#152033]">{product.name}</p>
                        <p className="text-xs text-[#637089] mt-1">
                          SKU: {product.sku} | 数量: {product.quantity} | 单价: {product.price} 卢布
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
