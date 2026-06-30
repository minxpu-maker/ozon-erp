"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Package, AlertTriangle, Clock, Loader2, Check } from "lucide-react";
import { cn, formatCNY } from "@/lib/utils";
import { getCarrierColor } from "@/lib/utils/express-carrier";
import { patchPurchaseRecordStatus } from "@/lib/api/purchase";

export interface InTransitRecord {
  id: number;
  demandId: number | null;
  shopId: string | null;
  supplierName: string | null;
  supplierSource: string | null;
  sourceUrl?: string | null;
  purchasePrice: number | null;
  purchaseQty: number | null;
  domesticTrackingNo: string | null;
  domesticCarrier: string | null;
  status: string;
  orderedAt: string | null;
  createdAt: string;
  demandProductName?: string | null;
  demandProductImage?: string | null;
  demandSku?: string | null;
  shopName?: string | null;
  ozonOrderIds?: number[];
  ozonPostingNumbers?: string[];
}

export interface InTransitCardProps {
  record: InTransitRecord;
  onConfirmSuccess: () => void;
  onCardClick: () => void;
  onToast: (msg: string, type: "success" | "error") => void;
}

export function InTransitCard({
  record,
  onConfirmSuccess,
  onCardClick,
  onToast,
}: InTransitCardProps) {
  const [pressProgress, setPressProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const hasTrackingNo = record.domesticTrackingNo && record.domesticTrackingNo.trim() !== "";

  // 计算运输天数
  const calcTransitDays = useCallback((orderedAt: string | null): { days: number; isWarning: boolean } => {
    if (!orderedAt) return { days: 0, isWarning: false };
    const orderedDate = new Date(orderedAt);
    const today = new Date();
    const diffTime = today.getTime() - orderedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return {
      days: diffDays,
      isWarning: diffDays > 3,
    };
  }, []);

  const transitInfo = calcTransitDays(record.orderedAt);

  // 清理定时器
  const clearTimers = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // 开始长按
  const handlePressStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsPressing(true);
    setPressProgress(0);

    // 进度条动画：每20ms增加1%，共2000ms（2秒）
    let progress = 0;
    progressIntervalRef.current = setInterval(() => {
      progress += 1;
      setPressProgress(Math.min(progress, 100));

      if (progress >= 100) {
        clearTimers();
        // 进度满，触发确认
        handleConfirm();
      }
    }, 20);
  }, [isSubmitting, clearTimers]);

  // 结束长按（松手）
  const handlePressEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsPressing(false);
    clearTimers();

    // 如果进度未满，重置
    if (pressProgress < 100) {
      setPressProgress(0);
    }
  }, [isSubmitting, pressProgress, clearTimers]);

  // 确认到货
  const handleConfirm = useCallback(async () => {
    setIsSubmitting(true);
    setIsPressing(false);

    try {
      await patchPurchaseRecordStatus(record.id, {
        status: "received",
        domesticStatus: "received",
      });
      onToast("已确认到货", "success");
      onConfirmSuccess();
    } catch (error) {
      onToast("确认失败，请重试", "error");
      setPressProgress(0);
      setIsSubmitting(false);
    }
  }, [record.id, onToast, onConfirmSuccess]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  // 点击卡片打开Drawer
  const handleCardClick = useCallback(() => {
    if (!isPressing && !isSubmitting) {
      onCardClick();
    }
  }, [isPressing, isSubmitting, onCardClick]);

  return (
    <div
      className={cn(
        "relative rounded-xl bg-white border border-gray-100 shadow-sm transition-all duration-200",
        "hover:shadow-md hover:border-gray-200",
        isSubmitting && "opacity-50"
      )}
    >
      {/* 左侧紫色色条 */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 rounded-l-xl" />

      {/* 卡片内容区 */}
      <div className="pl-4 pr-4 pt-4 pb-2 cursor-pointer" onClick={handleCardClick}>
        <div className="flex items-start gap-3">
          {/* 主图 */}
          <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
            {record.demandProductImage ? (
              <img
                src={record.demandProductImage}
                alt={record.demandProductName || "商品"}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="w-6 h-6 text-gray-300 m-auto" />
            )}
          </div>

          {/* 信息区 */}
          <div className="flex-1 min-w-0">
            {/* 供应商 + 采购价 */}
            <div className="flex items-center gap-2 mb-1">
              {record.supplierName && (
                <span className="text-xs text-gray-500 truncate">{record.supplierName}</span>
              )}
              {record.purchasePrice && (
                <span className="text-sm font-medium text-gray-900">
                  {formatCNY(record.purchasePrice)}
                </span>
              )}
            </div>

            {/* 快递信息行 */}
            {hasTrackingNo && (
              <div className="flex items-center gap-1.5 mb-1">
                {record.domesticCarrier && (
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      getCarrierColor(record.domesticCarrier)
                    )}
                  >
                    {record.domesticCarrier}
                  </span>
                )}
                <span className="text-xs font-mono text-gray-600">
                  {record.domesticTrackingNo}
                </span>
              </div>
            )}

            {/* 运输时长行 */}
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3" />
              <span
                className={cn(
                  "text-xs",
                  transitInfo.isWarning ? "text-amber-600" : "text-purple-600"
                )}
              >
                运输第{transitInfo.days}天
              </span>
              {transitInfo.isWarning && (
                <AlertTriangle className="w-3 h-3 text-amber-600" />
              )}
            </div>

            {/* 关联Ozon订单号 */}
            {record.ozonPostingNumbers && record.ozonPostingNumbers.length > 0 && (
              <div className="text-xs text-gray-400">
                Ozon: {record.ozonPostingNumbers.join(", ")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 长按确认到货区域 */}
      <div className="px-4 pb-3">
        <div
          className={cn(
            "relative rounded-lg bg-purple-50 border border-purple-100 p-2",
            "select-none touch-none",
            isSubmitting && "cursor-not-allowed"
          )}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          onTouchCancel={handlePressEnd}
        >
          {/* 进度条背景 */}
          <div className="absolute inset-0 rounded-lg overflow-hidden">
            <div
              className={cn(
                "h-full bg-purple-400 transition-none",
                isPressing ? "opacity-30" : "opacity-0"
              )}
              style={{ width: `${pressProgress}%` }}
            />
          </div>

          {/* 文字内容 */}
          <div className="relative flex items-center justify-center gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <span className="text-xs text-purple-600">确认中...</span>
              </>
            ) : isPressing ? (
              <>
                <span className="text-xs text-purple-600">
                  长按中 {Math.floor(pressProgress / 50)}秒
                </span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-purple-500">长按确认到货</span>
              </>
            )}
          </div>

          {/* 进度指示（底部细条） */}
          {(isPressing || pressProgress > 0) && !isSubmitting && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-100 rounded-b-lg">
              <div
                className="h-full bg-purple-500 rounded-bl-lg"
                style={{ width: `${pressProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* CSS 动画 */}
      <style>{`
        .touch-none {
          touch-action: none;
        }
        .select-none {
          user-select: none;
          -webkit-user-select: none;
        }
      `}</style>
    </div>
  );
}