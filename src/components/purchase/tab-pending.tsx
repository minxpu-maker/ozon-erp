'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Package, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PendingCard, PendingOrder } from './pending-card';
import { fetchPurchaseDemands, PurchaseDemand } from '@/lib/api/purchase';

// SKU聚合组类型（导出给父组件使用）
export interface DemandGroup {
  sku: string | null;
  productName: string;
  productImage: string | null;
  orders: PendingOrder[];
}

export interface TabPendingProps {
  onCardClick: (group: DemandGroup, cardIndex: number) => void;
  selectedSku: string | null;
  onListUpdate?: (groups: DemandGroup[]) => void;
}

export function TabPending({ onCardClick, selectedSku, onListUpdate }: TabPendingProps) {
  const [demands, setDemands] = useState<PurchaseDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 搜索和筛选
  const [searchKeyword, setSearchKeyword] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'expired' | 'urgent'>('all');

  // 获取数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchPurchaseDemands();
        setDemands(data);
        setError(null);
      } catch (err) {
        console.error('获取待采购数据失败:', err);
        setError('获取数据失败');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // SKU聚合
  const groupedData = useMemo(() => {
    const groups: Map<string, DemandGroup> = new Map();

    demands.forEach((d) => {
      if (!d.order) return;

      // 使用 SKU 作为聚合键，如果没有 SKU 则用 orderId（单独显示）
      const groupKey = d.sku || `no-sku-${d.orderId}`;

      const existingGroup = groups.get(groupKey);
      if (existingGroup) {
        // 添加到已有组
        existingGroup.orders.push({
          orderId: d.orderId,
          ozonOrderId: d.order.postingNumber || d.order.id,
          shopName: d.order.shopName || '未知店铺',
          quantity: d.quantity,
          orderAmount: d.order.totalPrice || '0',
          shipmentDeadline: d.order.shipmentDeadline,
          erpStatus: d.order.erpStatus || 'pending_purchase',
        });
      } else {
        // 创建新组
        groups.set(groupKey, {
          sku: d.sku,
          productName: d.productName,
          productImage: d.productImage,
          orders: [
            {
              orderId: d.orderId,
              ozonOrderId: d.order.postingNumber || d.order.id,
              shopName: d.order.shopName || '未知店铺',
              quantity: d.quantity,
              orderAmount: d.order.totalPrice || '0',
              shipmentDeadline: d.order.shipmentDeadline,
              erpStatus: d.order.erpStatus || 'pending_purchase',
            },
          ],
        });
      }
    });

    return Array.from(groups.values());
  }, [demands]);

  // 通知父组件数据更新
  useEffect(() => {
    if (onListUpdate && groupedData.length > 0) {
      onListUpdate(groupedData);
    }
  }, [groupedData, onListUpdate]);

  // 计算倒计时小时数
  const calcHoursLeft = (deadline: string | null): number => {
    if (!deadline) return Infinity;
    const diffMs = new Date(deadline).getTime() - Date.now();
    return diffMs / (1000 * 60 * 60);
  };

  // 筛选和排序
  const filteredAndSorted = useMemo(() => {
    let result = groupedData;

    // 关键词搜索
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      result = result.filter(
        (g) =>
          (g.sku && g.sku.toLowerCase().includes(kw)) ||
          g.productName.toLowerCase().includes(kw)
      );
    }

    // 时间筛选
    if (timeFilter !== 'all') {
      result = result.filter((g) => {
        const earliestHours = g.orders.reduce((min, o) => {
          const hours = calcHoursLeft(o.shipmentDeadline);
          return Math.min(min, hours);
        }, Infinity);

        if (timeFilter === 'expired') return earliestHours <= 0;
        if (timeFilter === 'urgent') return earliestHours > 0 && earliestHours < 12;
        return true;
      });
    }

    // 排序：已超时最前 → 按截止时间升序
    result.sort((a, b) => {
      const aEarliest = a.orders.reduce((min, o) => Math.min(min, calcHoursLeft(o.shipmentDeadline)), Infinity);
      const bEarliest = b.orders.reduce((min, o) => Math.min(min, calcHoursLeft(o.shipmentDeadline)), Infinity);

      // 已超时的排最前
      if (aEarliest <= 0 && bEarliest > 0) return -1;
      if (bEarliest <= 0 && aEarliest > 0) return 1;

      // 按截止时间升序
      return aEarliest - bEarliest;
    });

    return result;
  }, [groupedData, searchKeyword, timeFilter]);

  // 加载态
  if (loading) {
    return (
      <div className="p-4">
        <div className="flex gap-3 mb-4">
          <Skeleton className="h-9 w-[200px]" />
          <Skeleton className="h-9 w-[120px]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // 错误态
  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-[400px] text-gray-400">
        <AlertCircle className="w-10 h-10 mb-3" />
        <p>{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setLoading(true)}>
          重试
        </Button>
      </div>
    );
  }

  // 空状态
  if (filteredAndSorted.length === 0) {
    return (
      <div className="p-4">
        {/* 搜索筛选栏 */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索 SKU / 商品名"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="时间筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="expired">已超时</SelectItem>
              <SelectItem value="urgent">即将超时</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 空状态 */}
        <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
          <Package className="w-12 h-12 mb-4 text-gray-300" />
          <p className="text-sm">
            {searchKeyword || timeFilter !== 'all'
              ? '未找到匹配的待采购订单'
              : '暂无待采购订单'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* 搜索筛选栏 */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜索 SKU / 商品名"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)}>
          <SelectTrigger className="w-[120px] h-9">
            <Filter className="w-3.5 h-3.5 mr-1" />
            <SelectValue placeholder="时间筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="expired">已超时</SelectItem>
            <SelectItem value="urgent">即将超时</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
        {filteredAndSorted.map((group, idx) => (
          <PendingCard
            key={group.sku || `group-${idx}`}
            sku={group.sku}
            productName={group.productName}
            productImage={group.productImage}
            orders={group.orders}
            isSelected={selectedSku === group.sku}
            onClick={() => onCardClick(group, idx)}
          />
        ))}
      </div>

      {/* 数量统计 */}
      <div className="mt-4 text-xs text-gray-400 text-center">
        共 {filteredAndSorted.length} 个 SKU · {demands.length} 笔订单
      </div>
    </div>
  );
}