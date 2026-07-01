'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface BatchActionBarProps {
  selectedCount: number;
  onBatchPurchase: () => void;
  onBatchExport: () => void;
  onClearSelection: () => void;
  canPurchase?: boolean; // 权限控制
}

export function BatchActionBar({
  selectedCount,
  onBatchPurchase,
  onBatchExport,
  onClearSelection,
  canPurchase = true,
}: BatchActionBarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // 显示/隐藏逻辑
  useEffect(() => {
    if (selectedCount >= 1) {
      setIsVisible(true);
      setIsEntering(true);
      setIsExiting(false);
      // 入场动画完成
      const timer = setTimeout(() => setIsEntering(false), 280);
      return () => clearTimeout(timer);
    } else if (isVisible) {
      setIsExiting(true);
      // 退场动画完成后隐藏（300ms ≥ 动画时长250ms + 余量）
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsExiting(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedCount, isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-12 left-1/2 -translate-x-1/2",
        "bg-white/95 backdrop-blur-md rounded-xl shadow-lg",
        "border border-slate-200/50 px-4 py-2.5",
        "z-[var(--z-sticky)]",
        "flex items-center gap-3",
        // 入场动画
        isEntering && "animate-batch-enter",
        // 退场动画
        isExiting && "animate-batch-exit"
      )}
    >
      {/* 已选择计数 */}
      <span className="text-sm font-medium text-gray-700">
        ☑ 已选择 {selectedCount} 项
      </span>

      {/* 竖分隔线 */}
      <div className="w-px h-5 bg-slate-200" />

      {/* 批量采购按钮 */}
      <button
        onClick={onBatchPurchase}
        disabled={!canPurchase}
        className={cn(
          "bg-gradient-to-r from-blue-500 to-blue-600",
          "text-white px-3 py-1.5 rounded-lg text-sm font-medium",
          "transition-all duration-200",
          "hover:shadow-lg hover:from-blue-600 hover:to-blue-700",
          "active:scale-[0.97]",
          !canPurchase && "opacity-50 cursor-not-allowed"
        )}
      >
        批量采购
      </button>

      {/* 批量导出按钮 */}
      <button
        onClick={onBatchExport}
        className={cn(
          "border border-slate-200 text-gray-600",
          "px-3 py-1.5 rounded-lg text-sm font-medium",
          "transition-all duration-200",
          "hover:bg-slate-50 hover:border-slate-300",
          "active:scale-[0.97]"
        )}
      >
        批量导出
      </button>

      {/* 竖分隔线 */}
      <div className="w-px h-5 bg-slate-200" />

      {/* 取消选择按钮 */}
      <button
        onClick={onClearSelection}
        className={cn(
          "text-gray-400 hover:text-gray-600 text-sm",
          "transition-colors duration-200"
        )}
      >
        ✕ 取消
      </button>
    </div>
  );
}