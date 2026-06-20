'use client';

import { cn } from '@/lib/utils';

interface OrderCardSkeletonProps {
  className?: string;
}

export default function OrderCardSkeleton({ className }: OrderCardSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl shadow-sm bg-white overflow-hidden',
        className
      )}
    >
      <div className="flex">
        {/* 左侧色条占位 */}
        <div className="w-1 animate-shimmer" />

        <div className="flex flex-col flex-1">
          {/* 顶部区域 */}
          <div className="flex items-center gap-3 p-4">
            {/* Checkbox占位 */}
            <div className="w-5 h-5 rounded animate-shimmer" />

            {/* 倒计时占位 */}
            <div className="flex items-center gap-1.5 min-w-[80px]">
              <div className="w-2 h-2 rounded-full animate-shimmer" />
              <div className="w-12 h-4 rounded animate-shimmer" />
            </div>

            {/* 左栏 - 商品信息 */}
            <div className="flex-1 min-w-0">
              {/* 订单号 */}
              <div className="w-32 h-4 rounded animate-shimmer mb-2" />

              {/* 商品行1 */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg animate-shimmer" />
                <div className="flex-1">
                  <div className="w-48 h-4 rounded animate-shimmer mb-1" />
                  <div className="w-24 h-3 rounded animate-shimmer" />
                </div>
              </div>

              {/* 商品行2 */}
              <div className="flex items-center gap-3 mt-2">
                <div className="w-12 h-12 rounded-lg animate-shimmer" />
                <div className="flex-1">
                  <div className="w-40 h-4 rounded animate-shimmer mb-1" />
                  <div className="w-20 h-3 rounded animate-shimmer" />
                </div>
              </div>
            </div>

            {/* 中栏 - 金额 + 状态 */}
            <div className="w-32 flex flex-col items-center justify-center gap-2">
              <div className="w-16 h-4 rounded animate-shimmer" />
              <div className="w-12 h-5 rounded animate-shimmer" />
            </div>

            {/* 右栏 - 按钮 */}
            <div className="w-28 flex items-center justify-end">
              <div className="w-20 h-8 rounded-lg animate-shimmer" />
            </div>
          </div>

          {/* 底部区域 */}
          <div className="px-4 pb-3 flex items-center gap-3">
            <div className="w-28 h-3 rounded animate-shimmer" />
            <div className="w-16 h-3 rounded animate-shimmer" />
            <div className="w-16 h-5 rounded animate-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

// 骨架屏列表组件
export function OrderCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  );
}
