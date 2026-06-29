"use client";

import { useState } from "react";
import { RefreshCw, ShoppingCart, Package, Truck, ClipboardCheck, Layers } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { PurchaseSummary } from "@/components/purchase/purchase-summary";
import { PurchaseDrawer } from "@/components/purchase/purchase-drawer";
import { TabPending } from "@/components/purchase/tab-pending";
import { TabOrdered } from "@/components/purchase/tab-ordered";
import { TabInTransit } from "@/components/purchase/tab-in-transit";
import { TabReceived } from "@/components/purchase/tab-received";
import { TabAll } from "@/components/purchase/tab-all";

// Tab 类型
type TabValue = "pending" | "ordered" | "inTransit" | "received" | "all";

// Drawer 模式类型
type DrawerMode = "create" | "edit" | "view";

export default function PurchasePage() {
  // Tab 状态
  const [activeTab, setActiveTab] = useState<TabValue>("pending");

  // Drawer 状态
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [selectedRecord, setSelectedRecord] = useState<unknown>(null);

  // 打开 Drawer
  const openDrawer = (mode: DrawerMode, data?: unknown) => {
    setDrawerMode(mode);
    setSelectedRecord(data || null);
    setDrawerOpen(true);
  };

  // Tab 配置
  const tabsConfig = [
    {
      value: "pending",
      label: "待采购",
      icon: ShoppingCart,
      showBadge: true,
      badgeVariant: "amber",
    },
    {
      value: "ordered",
      label: "已下单",
      icon: Package,
      showBadge: true,
      badgeVariant: "blue",
    },
    {
      value: "inTransit",
      label: "运输中",
      icon: Truck,
      showBadge: true,
      badgeVariant: "purple",
    },
    {
      value: "received",
      label: "已到货",
      icon: ClipboardCheck,
      showBadge: false,
    },
    {
      value: "all",
      label: "全部",
      icon: Layers,
      showBadge: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      {/* 页面标题区 */}
      <div className="px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">采购工作台</h1>
        <Button
          variant="outline"
          size="sm"
          className="text-gray-600 hover:text-gray-900"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 摘要栏 */}
      <div className="px-6 pb-4">
        <PurchaseSummary />
      </div>

      {/* Tab 栏 + 内容区 */}
      <div className="px-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          {/* Tab 头部 */}
          <TabsList className="bg-white rounded-xl p-1 shadow-sm mb-4">
            {tabsConfig.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "data-[state=active]:bg-blue-600 data-[state=active]:text-white",
                  "text-gray-600 hover:text-gray-900"
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.showBadge && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "ml-1 px-1.5 py-0 text-xs font-normal",
                      tab.badgeVariant === "amber" && "bg-amber-50 text-amber-600 border-amber-200",
                      tab.badgeVariant === "blue" && "bg-blue-50 text-blue-600 border-blue-200",
                      tab.badgeVariant === "purple" && "bg-purple-50 text-purple-600 border-purple-200"
                    )}
                  >
                    0
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab 内容 */}
          <div className="bg-white rounded-xl shadow-sm">
            <TabsContent value="pending" className="mt-0">
              <TabPending />
            </TabsContent>

            <TabsContent value="ordered" className="mt-0">
              <TabOrdered />
            </TabsContent>

            <TabsContent value="inTransit" className="mt-0">
              <TabInTransit />
            </TabsContent>

            <TabsContent value="received" className="mt-0">
              <TabReceived />
            </TabsContent>

            <TabsContent value="all" className="mt-0">
              <TabAll />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Drawer */}
      <PurchaseDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        data={selectedRecord}
      />
    </div>
  );
}