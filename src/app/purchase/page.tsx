'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, ShoppingCart, Package, Truck, ClipboardCheck, Layers, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

import { PurchaseSummary } from '@/components/purchase/purchase-summary';
import { PurchaseDrawer } from '@/components/purchase/purchase-drawer';
import { TabPending, DemandGroup } from '@/components/purchase/tab-pending';
import { TabOrdered } from '@/components/purchase/tab-ordered';
import { TabInTransit } from '@/components/purchase/tab-in-transit';
import { TabReceived } from '@/components/purchase/tab-received';
import { TabAll } from '@/components/purchase/tab-all';

import { fetchPurchaseStats } from '@/lib/api/purchase';

// Stats 数据类型
interface PurchaseStats {
  pendingPurchaseCount: number;
  orderedCount: number;
  orderedWithoutTrackingCount: number;
  inTransitCount: number;
  todayPurchasedCount: number;
  todayPurchasedAmount: number;
}

export default function PurchasePage() {
  // Tab 状态
  const [activeTab, setActiveTab] = useState('pending');

  // Drawer 状态
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedRecord, setSelectedRecord] = useState<DemandGroup | null>(null);

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
  const openDrawer = (mode: 'create' | 'edit' | 'view', data: DemandGroup | null = null) => {
    setDrawerMode(mode);
    setSelectedRecord(data);
    setDrawerOpen(true);
  };

  // 关闭 Drawer
  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedRecord(null);
  };

  // 待采购卡片点击
  const handlePendingCardClick = (group: DemandGroup) => {
    openDrawer('create', group);
  };

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
          <PurchaseSummary />
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
            />
          </TabsContent>

          <TabsContent value="ordered" className="mt-4 bg-white rounded-xl border border-gray-200">
            <TabOrdered />
          </TabsContent>

          <TabsContent value="inTransit" className="mt-4 bg-white rounded-xl border border-gray-200">
            <TabInTransit />
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
      />
    </div>
  );
}