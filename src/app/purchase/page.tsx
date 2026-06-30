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
import { ReceivedRecord } from '@/components/purchase/received-card';
import { TabAll } from '@/components/purchase/tab-all';
import { AllRecord } from '@/components/purchase/all-card';
import { usePurchaseToast } from '@/components/purchase/purchase-toast';
import { CountUp } from '@/components/purchase/count-up';

import { fetchPurchaseStats, deletePurchaseRecord } from '@/lib/api/purchase';

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
  
  // 搜索框引用（用于快捷键聚焦）
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // 快捷键支持：/ 键聚焦搜索框
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查是否在输入框中
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      
      // / 键聚焦搜索框（不在输入框中时）
      if (e.key === '/' && !isInputFocused && !drawerOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  // Tab 切换时清空搜索
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    // 清空搜索输入框
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
  };

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
  
  // 已到货卡片点击（只读 Drawer）
  const handleReceivedCardClick = useCallback((record: ReceivedRecord) => {
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
        erpStatus: 'received',
      }],
    };
    setDrawerMode('view');
    setSelectedRecord(group);
    setDrawerOpen(true);
  }, []);
  
  // 全部卡片点击（只读 Drawer）
  const handleAllCardClick = useCallback((record: AllRecord) => {
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
        erpStatus: record.status || 'all',
      }],
    };
    setDrawerMode('view');
    setSelectedRecord(group);
    setDrawerOpen(true);
  }, []);
  
  // 全部卡片操作回调
  const handleAllCardAction = useCallback((record: AllRecord, action: 'bindTracking' | 'confirmReceived' | 'gotoQc') => {
    if (action === 'gotoQc') {
      showToast('入库验货模块开发中，敬请期待', 'success');
    } else if (action === 'bindTracking' || action === 'confirmReceived') {
      // 这些操作在 AllCard 内部完成，这里只需要刷新数据
      handleRefresh();
    }
  }, [showToast, handleRefresh]);
  
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
  
  // Drawer 提交回调（返回采购记录ID列表用于撤销）
  const handleDrawerSubmit = useCallback((success: boolean, purchaseRecordIds?: number[]) => {
    if (success && purchaseRecordIds && purchaseRecordIds.length > 0) {
      // 刷新统计数据
      handleRefresh();
      
      // 显示撤销Toast
      const undoKey = `undo_purchase_${Date.now()}`;
      showToast('已确认采购', 'undo', async () => {
        // 撤销操作：删除采购记录
        try {
          for (const id of purchaseRecordIds) {
            await deletePurchaseRecord(id);
          }
          // 刷新数据
          handleRefresh();
          showToast('已撤销，恢复为待采购', 'success');
        } catch (error) {
          showToast('撤销失败，请重试', 'error');
        }
      });
      
      // 自动下一条（延迟800ms让用户看到确认动画）
      if (autoNextEnabled) {
        setTimeout(() => {
          goToNextCard();
        }, 800);
      } else {
        setTimeout(() => {
          closeDrawer();
        }, 800);
      }
    }
  }, [autoNextEnabled, goToNextCard, handleRefresh, showToast, closeDrawer]);

  // 当前选中的 SKU（用于卡片选中态）
  const selectedSku = selectedRecord?.sku || null;

  // Badge 数量显示
  const pendingBadge = stats?.pendingPurchaseCount ?? 0;
  const orderedBadge = stats?.orderedCount ?? 0;
  const inTransitBadge = stats?.inTransitCount ?? 0;
  const receivedBadge = stats?.receivedCount ?? 0;
  const allBadge = (stats?.orderedCount ?? 0) + (stats?.inTransitCount ?? 0) + (stats?.receivedCount ?? 0);

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
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="bg-white border border-gray-200 rounded-lg p-1 h-auto">
            {/* 待采购 */}
            <TabsTrigger
              value="pending"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white px-4 py-2 rounded-md flex items-center gap-1.5 relative transition-transform duration-150 data-[state=active]:scale-[1.03] data-[state=active]:after:absolute data-[state=active]:after:top-0 data-[state=active]:after:left-[12.5%] data-[state=active]:after:h-[2px] data-[state=active]:after:w-3/4 data-[state=active]:after:bg-gradient-to-r data-[state=active]:after:from-transparent data-[state=active]:after:via-current data-[state=active]:after:to-transparent data-[state=active]:after:opacity-50 data-[state=active]:after:rounded-full"
            >
              <ShoppingCart className="w-4 h-4" />
              待采购
              {pendingBadge > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-amber-100 text-amber-700 border-amber-200 px-1.5 py-0.5 text-xs font-bold"
                >
                  <CountUp end={pendingBadge} duration={600} />
                </Badge>
              )}
            </TabsTrigger>

            {/* 数据源分隔符：待采购（需求端）| 已下单（供应端） */}
            <div className="w-px h-4 bg-slate-200 self-center mx-1.5" />

            {/* 已下单 */}
            <TabsTrigger
              value="ordered"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white px-4 py-2 rounded-md flex items-center gap-1.5 relative transition-transform duration-150 data-[state=active]:scale-[1.03] data-[state=active]:after:absolute data-[state=active]:after:top-0 data-[state=active]:after:left-[12.5%] data-[state=active]:after:h-[2px] data-[state=active]:after:w-3/4 data-[state=active]:after:bg-gradient-to-r data-[state=active]:after:from-transparent data-[state=active]:after:via-current data-[state=active]:after:to-transparent data-[state=active]:after:opacity-50 data-[state=active]:after:rounded-full"
            >
              <Package className="w-4 h-4" />
              已下单
              {orderedBadge > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-blue-100 text-blue-700 border-blue-200 px-1.5 py-0.5 text-xs font-bold"
                >
                  <CountUp end={orderedBadge} duration={600} />
                </Badge>
              )}
            </TabsTrigger>

            {/* 运输中 */}
            <TabsTrigger
              value="inTransit"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white px-4 py-2 rounded-md flex items-center gap-1.5 relative transition-transform duration-150 data-[state=active]:scale-[1.03] data-[state=active]:after:absolute data-[state=active]:after:top-0 data-[state=active]:after:left-[12.5%] data-[state=active]:after:h-[2px] data-[state=active]:after:w-3/4 data-[state=active]:after:bg-gradient-to-r data-[state=active]:after:from-transparent data-[state=active]:after:via-current data-[state=active]:after:to-transparent data-[state=active]:after:opacity-50 data-[state=active]:after:rounded-full"
            >
              <Truck className="w-4 h-4" />
              运输中
              {inTransitBadge > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-purple-100 text-purple-700 border-purple-200 px-1.5 py-0.5 text-xs font-bold"
                >
                  <CountUp end={inTransitBadge} duration={600} />
                </Badge>
              )}
            </TabsTrigger>

            {/* 已到货 */}
            <TabsTrigger
              value="received"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white px-4 py-2 rounded-md flex items-center gap-1.5 relative transition-transform duration-150 data-[state=active]:scale-[1.03] data-[state=active]:after:absolute data-[state=active]:after:top-0 data-[state=active]:after:left-[12.5%] data-[state=active]:after:h-[2px] data-[state=active]:after:w-3/4 data-[state=active]:after:bg-gradient-to-r data-[state=active]:after:from-transparent data-[state=active]:after:via-current data-[state=active]:after:to-transparent data-[state=active]:after:opacity-50 data-[state=active]:after:rounded-full"
            >
              <ClipboardCheck className="w-4 h-4" />
              已到货
              {receivedBadge > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-teal-100 text-teal-700 border-teal-200 px-1.5 py-0.5 text-xs font-bold"
                >
                  <CountUp end={receivedBadge} duration={600} />
                </Badge>
              )}
            </TabsTrigger>

            {/* 全部 */}
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white px-4 py-2 rounded-md flex items-center gap-1.5 relative transition-transform duration-150 data-[state=active]:scale-[1.03] data-[state=active]:after:absolute data-[state=active]:after:top-0 data-[state=active]:after:left-[12.5%] data-[state=active]:after:h-[2px] data-[state=active]:after:w-3/4 data-[state=active]:after:bg-gradient-to-r data-[state=active]:after:from-transparent data-[state=active]:after:via-current data-[state=active]:after:to-transparent data-[state=active]:after:opacity-50 data-[state=active]:after:rounded-full"
            >
              <Layers className="w-4 h-4" />
              全部
              {allBadge > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-slate-100 text-slate-700 border-slate-200 px-1.5 py-0.5 text-xs font-bold"
                >
                  <CountUp end={allBadge} duration={600} />
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab 内容 */}
          <TabsContent value="pending" className="mt-4 bg-slate-50 rounded-xl border border-gray-200 p-4">
            <TabPending
              onCardClick={handlePendingCardClick}
              selectedSku={selectedSku}
              onListUpdate={handlePendingListUpdate}
              searchInputRef={activeTab === 'pending' ? searchInputRef : undefined}
            />
          </TabsContent>

          <TabsContent value="ordered" className="mt-4 bg-slate-50 rounded-xl border border-gray-200 p-4">
            <TabOrdered
              onCardClick={handleOrderedCardClick}
              stats={{
                orderedCount: stats?.orderedCount ?? 0,
                orderedWithoutTrackingCount: stats?.orderedWithoutTrackingCount ?? 0,
              }}
              onRefresh={handleRefresh}
              searchInputRef={activeTab === 'ordered' ? searchInputRef : undefined}
            />
          </TabsContent>

          <TabsContent value="inTransit" className="mt-4 bg-slate-50 rounded-xl border border-gray-200 p-4">
            <TabInTransit
              onCardClick={handleInTransitCardClick}
              stats={{
                inTransitCount: stats?.inTransitCount ?? 0,
              }}
              onRefresh={handleRefresh}
              searchInputRef={activeTab === 'inTransit' ? searchInputRef : undefined}
            />
          </TabsContent>

          <TabsContent value="received" className="mt-4 bg-slate-50 rounded-xl border border-gray-200 p-4">
            <TabReceived
              onCardClick={handleReceivedCardClick}
              stats={{
                receivedCount: stats?.receivedCount ?? 0,
              }}
              onRefresh={handleRefresh}
              searchInputRef={activeTab === 'received' ? searchInputRef : undefined}
            />
          </TabsContent>

          <TabsContent value="all" className="mt-4 bg-slate-50 rounded-xl border border-gray-200 p-4">
            <TabAll
              onCardClick={handleAllCardClick}
              onCardAction={handleAllCardAction}
              stats={{
                orderedCount: stats?.orderedCount ?? 0,
                inTransitCount: stats?.inTransitCount ?? 0,
                receivedCount: stats?.receivedCount ?? 0,
              }}
              onRefresh={handleRefresh}
              searchInputRef={activeTab === 'all' ? searchInputRef : undefined}
            />
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