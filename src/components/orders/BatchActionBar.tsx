'use client';

import { cn } from '@/lib/utils';
import { OrderRecord } from './OrderCard';

interface BatchActionBarProps {
  selectedIds: Set<string>;
  orders: OrderRecord[];
  currentTab: string;
  totalCount: number;
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onPageChange: (page: number) => void;
  onBatchPurchase: () => void;
  onBatchMarkPacking: () => void;
  onBatchPrint: () => void;
}

export default function BatchActionBar({
  selectedIds,
  orders,
  currentTab,
  totalCount,
  pagination,
  onToggleSelect,
  onToggleSelectAll,
  onClearSelection,
  onPageChange,
  onBatchPurchase,
  onBatchMarkPacking,
  onBatchPrint,
}: BatchActionBarProps) {
  const { page, totalPages } = pagination;
  const selectedCount = selectedIds.size;
  const allSelected = orders.length > 0 && orders.every((o) => selectedIds.has(o.ozonPostingNumber));
  const indeterminate = selectedCount > 0 && !allSelected;

  // 根据当前Tab显示对应的操作按钮
  const showBatchPurchase = currentTab === 'awaiting_deliver';
  const showBatchMarkPacking = currentTab === 'delivering';
  const showBatchPrint = currentTab === 'delivering' || currentTab === 'delivered';

  return (
    <div className="bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center sticky bottom-0 z-10">
      {/* 左区：批量操作 */}
      <div className="flex items-center gap-4">
        {selectedCount === 0 ? (
          <span className="text-sm text-gray-400">选择订单进行批量操作</span>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div 
                className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors",
                  allSelected ? "bg-blue-600 border-blue-600" : indeterminate ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300 hover:border-blue-400"
                )}
                onClick={onToggleSelectAll}
              >
                {allSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {indeterminate && (
                  <div className="w-2 h-0.5 bg-white rounded" />
                )}
              </div>
              <span className="text-sm font-medium text-blue-600">
                已选{selectedCount}项
              </span>
            </div>

            {/* 批量采购 - 仅待采购Tab */}
            {showBatchPurchase && (
              <button
                onClick={onBatchPurchase}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <span>批量采购</span>
              </button>
            )}

            {/* 标记打包 - 仅运输中Tab */}
            {showBatchMarkPacking && (
              <button
                onClick={onBatchMarkPacking}
                className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
              >
                <span>标记打包</span>
              </button>
            )}

            {/* 批量打印 - 仅运输中/已签收Tab */}
            {showBatchPrint && (
              <button
                onClick={onBatchPrint}
                className="flex items-center gap-1.5 bg-white border text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <span>批量打印</span>
              </button>
            )}

            <button
              onClick={onClearSelection}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              取消选择
            </button>
          </>
        )}
      </div>

      {/* 右区：分页器 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={cn(
            'w-8 h-8 rounded-lg border flex items-center justify-center transition-colors',
            page <= 1
              ? 'border-gray-200 text-gray-300 cursor-not-allowed'
              : 'border-gray-200 text-gray-600 hover:bg-gray-100'
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-1 text-sm">
          <span className="text-blue-600 font-medium">{page}</span>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600">{totalPages || 1}</span>
        </div>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            'w-8 h-8 rounded-lg border flex items-center justify-center transition-colors',
            page >= totalPages
              ? 'border-gray-200 text-gray-300 cursor-not-allowed'
              : 'border-gray-200 text-gray-600 hover:bg-gray-100'
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
