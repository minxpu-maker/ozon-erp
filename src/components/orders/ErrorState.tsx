"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

/**
 * API请求错误态组件
 * 显示错误图标、错误信息、重试按钮
 */
export function ErrorState({
  message = "加载失败",
  onRetry,
  compact = false,
}: ErrorStateProps) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-gray-500 mt-2">{message}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2 h-8 text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            重试
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-12 h-12 text-red-400" />
      <p className="text-sm text-gray-500 mt-2">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="mt-3 h-9 px-4 text-sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          重试
        </Button>
      )}
    </div>
  );
}

/**
 * 网络断开提示横幅
 */
export function NetworkErrorBanner() {
  return (
    <div className="fixed top-14 left-0 right-0 z-[var(--z-sticky,20)] bg-red-50 border-b border-red-100 px-4 py-2">
      <p className="text-sm text-red-600 text-center">
        网络连接已断开，部分功能不可用
      </p>
    </div>
  );
}

/**
 * 维护模式提示横幅
 */
export function MaintenanceBanner() {
  return (
    <div className="fixed top-14 left-0 right-0 z-[var(--z-sticky,20)] bg-amber-50 border-b border-amber-200 px-4 py-2">
      <p className="text-sm text-amber-700 text-center">
        系统维护中，部分功能可能暂时不可用
      </p>
    </div>
  );
}
