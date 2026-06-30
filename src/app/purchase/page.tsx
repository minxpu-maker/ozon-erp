'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, ShoppingCart, Package, Truck, ClipboardCheck, Layers, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

import { PurchaseSummary, PurchaseStats } from '@/components/purchase/purchase-summary';
import { PurchaseDrawer } from '@/components/purchase/purchase-drawer';
import { TabPending, DemandGroup } from '@/components/purchase/tab-pending';
import { TabOrdered } from '@/components/purchase/tab-ordered';
import { OrderedRecord } from '@/components/purchase/ordered-card';
import { TabInTransit } from '@/components/purchase/tab-in-transit';
import { InTransitRecord } from '@/components/purchase/in-transit-card';
import { TabReceived } from '@/components/purchase/tab-received';
import { TabAll } from '@/components/purchase/tab-all';
import { usePurchaseToast } from '@/components/purchase/purchase-toast';

import { fetchPurchaseStats } from '@/lib/api/purchase';

export default function PurchasePage() {
  // Tab 状态
  const [activeTab, setActiveTab] = useState('pending');

  // Drawer 状态
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedRecord, setSelectedRecord] = useState<DemandGroup | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]); // 批量模式选中的订单
  const [autoNextEnabled, setAutoNextEnabled] = useState(true); // 自动下一条开关
  
  // Toast 系统
  const { toasts, showToast, removeToast, ToastComponent } = usePurchaseToast();
  
  // 待采购列表引用（用于自动下一条）
  const pendingListRef = useRef<DemandGroup[]>([]);
  const currentCardIndexRef = useRef<number>(0);

  // Stats 数据
  const [stats, setStats] = useState<PurchaseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // 获取 stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        setStatsLoading(true);
        const data = await fetchPurchaseStats();
        setStats(data);
      } catch (err) {
        console.error('获取统计数据失败:', err);
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, []);

  // 刷新 stats
  const handleRefresh = async () => {
    try {
      const data = await fetchPurchaseStats();
      setStats(data);
    } catch (err) {
      console.error('刷新统计数据失败:', err);
    }
  };

  // 打开 Drawer
  const openDrawer = useCallback((mode: 'create' | 'edit' | 'view', data: DemandGroup | null = null, cardIndex: number = 0) => {
    setDrawerMode(mode);
    setSelectedRecord(data);
    setDrawerOpen(true);
    currentCardIndexRef.current = cardIndex;
    
    // 默认选中所有订单
    if (data?.orders) {
      setSelectedOrders(data.orders.map(o => o.orderId));
    }
  }, []);

  // 关闭 Drawer
  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedRecord(null);
    setSelectedOrders([]);
  };

  // 待采购卡片点击
  const handlePendingCardClick = useCallback((group: DemandGroup, cardIndex: number) => {
    openDrawer('create', group, cardIndex);
  }, [openDrawer]);
  
  // 已下单卡片点击（只读 Drawer）
  const handleOrderedCardClick = useCallback((record: OrderedRecord) => {
    // 将 OrderedRecord 转换为 DemandGroup 格式（只读模式）
    const group: DemandGroup = {
      sku: record.demandSku || '',
      productName: record.demandProductName || '',
      productImage: record.demandProductImage || null,
      orders: [{
        // 使用 ozonOrderIds 的第一个元素作为 orderId，如果为空则用 record.id 兜底
        orderId: record.ozonOrderIds?.[0] ? String(record.ozonOrderIds[0]) : String(record.id),
        demandId: record.demandId || 0,
        ozonOrderId: record.ozonPostingNumbers?.[0] || '',
        shopName: record.shopName || '',
        quantity: record.purchaseQty || 1,
        orderAmount: '0',
        shipmentDeadline: '',
        erpStatus: 'ordered',
      }],
    };
    setDrawerMode('view');
    setSelectedRecord(group);
    setDrawerOpen(true);
  }, []);
  
  // 运输中卡片点击（只读 Drawer）
  const handleInTransitCardClick = useCallback((record: InTransitRecord) => {
    // 将 InTransitRecord 转换为 DemandGroup 格式（只读模式）
    const group: DemandGroup = {
      sku: record.demandSku || '',
      productName: record.demandProductName || '',
      productImage: record.demandProductImage || null,
      orders: [{
        orderId: record.ozonOrderIds?.[0] ? String(record.ozonOrderIds[0]) : String(record.id),
        demandId: record.demandId || 0,
        ozonOrderId: record.ozonPostingNumbers?.[0] || '',
        shopName: record.shopName || '',
        quantity: record.purchaseQty || 1,
        orderAmount: '0',
        shipmentDeadline: '',
        erpStatus: 'shipped',
      }],
    };
    setDrawerMode('view');
    setSelectedRecord(group);
    setDrawerOpen(true);
  }, []);
  
  // 更新待采购列表引用
  const handlePendingListUpdate = useCallback((groups: DemandGroup[]) => {
    pendingListRef.current = groups;
  }, []);

  // 自动下一条逻辑
  const goToNextCard = useCallback(() => {
    const list = pendingListRef.current;
    const currentIndex = currentCardIndexRef.current;
    
    if (currentIndex < list.length - 1) {
      // 有下一张卡片
      const nextGroup = list[currentIndex + 1];
      openDrawer('create', nextGroup, currentIndex + 1);
      showToast('已跳转到下一张卡片', 'info');
    } else {
      // 已是最后一张
      closeDrawer();
      showToast('已完成全部待采购', 'success');
    }
  }, [openDrawer, showToast]);
  
  // 跳过当前卡片
  const handleSkip = useCallback(() => {
    showToast('已跳过', 'info', () => {
      // 撤销：重新打开当前卡片
      openDrawer('create', selectedRecord, currentCardIndexRef.current);
    });
    goToNextCard();
  }, [goToNextCard, showToast, openDrawer, selectedRecord]);
  
  // Drawer 提交回调
  const handleDrawerSubmit = useCallback((success: boolean) => {
    if (success) {
      // 刷新统计数据
      handleRefresh();
      
      // 自动下一条
      if (autoNextEnabled) {
        setTimeout(() => {
          goToNextCard();
        }, 800);
      } else {
        closeDrawer();
      }
    }
  }, [autoNextEnabled, goToNextCard]);

  // 当前选中的 SKU（用于卡片选中态）
  const selectedSku = selectedRecord?.sku || null;

  // Badge 数量显示
  const pendingBadge = stats?.pendingPurchaseCount ?? 0;
  const orderedBadge = stats?.orderedCount ?? 0;
  const inTransitBadge = stats?.inTransitCount ?? 0;

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      {/* 页面标题区 */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-gray-900">采购工作台</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={statsLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${statsLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 摘要栏 */}
      <div className="px-6 py-4">
        {statsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-xl" />
            ))}
          </div>
        ) : (
          <PurchaseSummary stats={stats} loading={statsLoading} />
        )}
      </div>

      {/* Tab 栏 + 内容区 */}
      <div className="px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-white border border-gray-200 rounded-lg p-1 h-auto">
            {/* 待采购 */}
            <TabsTrigger
              value="pending"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white px-4 py-2 rounded-md flex items-center gap-1.5"
            >
              <ShoppingCart className="w-4 h-4" />
              待采购
              {pendingBadge > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-amber-100 text-amber-700 border-amber-200 px-1.5 py-0.5 text-xs font-bold"
                >
                  {pendingBadge}
                </Badge>
              )}
            </TabsTrigger>

            {/* 已下单 */}
            <TabsTrigger
              value="ordered"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white px-4 py-2 rounded-md flex items-center gap-1.5"
            >
              <Package className="w-4 h-4" />
              已下单
              {orderedBadge > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-blue-100 text-blue-700 border-blue-200 px-1.5 py-0.5 text-xs font-bold"
                >
                  {orderedBadge}
                </Badge>
              )}
            </TabsTrigger>

            {/* 运输中 */}
            <TabsTrigger
              value="inTransit"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white px-4 py-2 rounded-md flex items-center gap-1.5"
            >
              <Truck className="w-4 h-4" />
              运输中
              {inTransitBadge > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-purple-100 text-purple-700 border-purple-200 px-1.5 py-0.5 text-xs font-bold"
                >
                  {inTransitBadge}
                </Badge>
              )}
            </TabsTrigger>

            {/* 已到货 */}
            <TabsTrigger
              value="received"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white px-4 py-2 rounded-md flex items-center gap-1.5"
            >
              <ClipboardCheck className="w-4 h-4" />
              已到货
            </TabsTrigger>

            {/* 全部 */}
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white px-4 py-2 rounded-md flex items-center gap-1.5"
            >
              <Layers className="w-4 h-4" />
              全部
            </TabsTrigger>
          </TabsList>

          {/* Tab 内容 */}
          <TabsContent value="pending" className="mt-4 bg-white rounded-xl border border-gray-200">
            <TabPending
              onCardClick={handlePendingCardClick}
              selectedSku={selectedSku}
              onListUpdate={handlePendingListUpdate}
            />
          </TabsContent>

          <TabsContent value="ordered" className="mt-4 bg-white rounded-xl border border-gray-200">
            <TabOrdered
              onCardClick={handleOrderedCardClick}
              stats={{
                orderedCount: stats?.orderedCount ?? 0,
                orderedWithoutTrackingCount: stats?.orderedWithoutTrackingCount ?? 0,
              }}
              onRefresh={handleRefresh}
            />
          </TabsContent>

          <TabsContent value="inTransit" className="mt-4 bg-white rounded-xl border border-gray-200">
            <TabInTransit
              onCardClick={handleInTransitCardClick}
              stats={{
                inTransitCount: stats?.inTransitCount ?? 0,
              }}
              onRefresh={handleRefresh}
            />
          </TabsContent>

          <TabsContent value="received" className="mt-4 bg-white rounded-xl border border-gray-200">
            <TabReceived />
          </TabsContent>

          <TabsContent value="all" className="mt-4 bg-white rounded-xl border border-gray-200">
            <TabAll />
          </TabsContent>
        </Tabs>
      </div>

      {/* Drawer */}
      <PurchaseDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
        }}
        mode={drawerMode}
        data={selectedRecord}
        selectedOrders={selectedOrders}
        onSelectedOrdersChange={setSelectedOrders}
        autoNextEnabled={autoNextEnabled}
        onAutoNextChange={setAutoNextEnabled}
        onSubmit={handleDrawerSubmit}
        onSkip={handleSkip}
        onToast={(message, type) => showToast(message, type)}
      />
      
      {/* Toast 组件 */}
      <ToastComponent />
    </div>
  );
}