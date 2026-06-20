'use client';

import { useMemo } from 'react';
import { Package, Truck, X } from 'lucide-react';

interface BatchActionBarProps {
  selectedCount: number;
  selectedIds: Set<string | number>;
  orders: Array<{ ozonPostingNumber: string; erpStatus: string }>;
  onClearSelection: () => void;
  onBatchPurchase: () => void;
  onBatchShip: () => void;
}

export default function BatchActionBar({
  selectedCount,
  selectedIds,
  orders,
  onClearSelection,
  onBatchPurchase,
  onBatchShip,
}: BatchActionBarProps) {
  // 检查是否有 pending_purchase 订单被选中
  const canBatchPurchase = useMemo(() => {
    return Array.from(selectedIds).some(id => {
      const order = orders.find(o => o.ozonPostingNumber === String(id));
      return order?.erpStatus === 'pending_purchase';
    });
  }, [selectedIds, orders]);

  // 检查是否有 pending_packaging 订单被选中
  const canBatchShip = useMemo(() => {
    return Array.from(selectedIds).some(id => {
      const order = orders.find(o => o.ozonPostingNumber === String(id));
      return order?.erpStatus === 'pending_packaging';
    });
  }, [selectedIds, orders]);

  // 隐藏时不在视口内
  const isHidden = selectedCount === 0;

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-50
        bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)]
        rounded-t-xl
        px-6 py-3
        transition-transform duration-200 ease-out
        ${isHidden ? 'translate-y-full pointer-events-none' : 'translate-y-0 pointer-events-auto'}
      `}
    >
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
        {/* 左侧：已选信息 */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            已选 <span className="font-bold text-blue-600">{selectedCount}</span> 单
          </span>
        </div>

        {/* 右侧：批量操作按钮 */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBatchPurchase}
            disabled={!canBatchPurchase}
            title={!canBatchPurchase ? '请选择待采购状态的订单' : '批量创建采购任务'}
            className={`
              flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${canBatchPurchase
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            <Package className="w-4 h-4" />
            批量采购
          </button>

          <button
            onClick={onBatchShip}
            disabled={!canBatchShip}
            title={!canBatchShip ? '请选择待发货状态的订单' : '批量标记发货'}
            className={`
              flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${canBatchShip
                ? 'border border-amber-500 text-amber-600 hover:bg-amber-50'
                : 'border border-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            <Truck className="w-4 h-4" />
            批量标记发货
          </button>

          <button
            onClick={onClearSelection}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
            取消选择
          </button>
        </div>
      </div>
    </div>
  );
}
