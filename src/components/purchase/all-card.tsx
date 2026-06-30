"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Package, Calendar, Check, Loader2, ArrowRight, Clock, AlertTriangle } from "lucide-react";
import { cn, formatCNY } from "@/lib/utils";
import { getCarrierColor, identifyCarrier } from "@/lib/utils/express-carrier";
import { PurchaseRecord, bindTrackingNumber, patchPurchaseRecordStatus } from "@/lib/api/purchase";

// 全部Tab记录类型
export interface AllRecord extends PurchaseRecord {}

interface AllCardProps {
  record: AllRecord;
  onCardClick: () => void;
  onBindTracking: (record: AllRecord) => void;
  onConfirmReceived: (record: AllRecord) => void;
  onGotoQc: (record: AllRecord) => void;
  onToast: (msg: string, type: "success" | "error") => void;
  onRefresh?: () => void;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

// 计算运输天数
function calcTransitDays(orderedAt: string | null): number {
  if (!orderedAt) return 0;
  const ordered = new Date(orderedAt);
  const now = new Date();
  const diff = now.getTime() - ordered.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function AllCard({
  record,
  onCardClick,
  onBindTracking,
  onConfirmReceived,
  onGotoQc,
  onToast,
  onRefresh,
}: AllCardProps) {
  // 状态
  const status = record.status as "ordered" | "shipped" | "received";

  // 已下单状态：展开录入快递单号
  const [isExpanded, setIsExpanded] = useState(false);
  const [trackingNo, setTrackingNo] = useState("");
  const [detectedCarrier, setDetectedCarrier] = useState<string | null>(null);
  const [binding, setBinding] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);

  // 运输中状态：长按确认到货
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 色条颜色和状态Badge
  const statusConfig = {
    ordered: {
      barColor: "bg-blue-500",
      barShadow: "shadow-[0_0_8px_rgba(59,130,246,0.5)]",
      badgeBg: "bg-blue-100",
      badgeText: "text-blue-700",
      badgeBorder: "border-blue-200",
      badgeLabel: "已下单",
    },
    shipped: {
      barColor: "bg-purple-500",
      barShadow: "shadow-[0_0_8px_rgba(168,85,247,0.5)]",
      badgeBg: "bg-purple-100",
      badgeText: "text-purple-700",
      badgeBorder: "border-purple-200",
      badgeLabel: "运输中",
    },
    received: {
      barColor: "bg-teal-500",
      barShadow: "shadow-[0_0_8px_rgba(20,184,166,0.5)]",
      badgeBg: "bg-teal-100",
      badgeText: "text-teal-700",
      badgeBorder: "border-teal-200",
      badgeLabel: "已到货",
    },
  };

  const config = statusConfig[status];
  const carrierColor = record.domesticCarrier ? getCarrierColor(record.domesticCarrier) : "#6B7280";
  const transitDays = status === "shipped" ? calcTransitDays(record.orderedAt) : 0;

  // 已下单状态：快递单号输入处理
  const handleTrackingNoChange = (value: string) => {
    setTrackingNo(value);
    setBindError(null);
    if (value.trim()) {
      const carrier = identifyCarrier(value.trim());
      setDetectedCarrier(carrier);
    } else {
      setDetectedCarrier(null);
    }
  };

  // 已下单状态：绑定快递单号
  const handleBindTracking = async () => {
    if (!trackingNo.trim()) {
      setBindError("请输入快递单号");
      return;
    }

    setBinding(true);
    setBindError(null);

    try {
      await bindTrackingNumber(record.id, {
        domesticTrackingNo: trackingNo.trim(),
        domesticCarrier: detectedCarrier || undefined,
      });
      onToast("快递单号已绑定", "success");
      setIsExpanded(false);
      setTrackingNo("");
      setDetectedCarrier(null);
      onRefresh?.();
      onBindTracking(record);
    } catch (error) {
      setBindError("绑定失败，请重试");
    } finally {
      setBinding(false);
    }
  };

  // 运输中状态：长按开始
  const handlePressStart = () => {
    if (confirming) return;
    setPressing(true);
    setProgress(0);

    // 进度条动画（20ms增加1%，2000ms完成）
    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          return 100;
        }
        return prev + 1;
      });
    }, 20);

    // 2秒后触发确认
    pressTimerRef.current = setTimeout(() => {
      handleConfirmReceived();
    }, 2000);
  };

  // 运输中状态：长按结束（取消）
  const handlePressEnd = () => {
    if (confirming) return;
    setPressing(false);
    setProgress(0);
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  // 运输中状态：确认到货
  const handleConfirmReceived = async () => {
    setPressing(false);
    setConfirming(true);

    try {
      await patchPurchaseRecordStatus(record.id, {
        status: "received",
        domesticStatus: "received",
      });
      onToast("已确认到货", "success");
      onRefresh?.();
      onConfirmReceived(record);
    } catch (error) {
      onToast("确认失败，请重试", "error");
      setProgress(0);
    } finally {
      setConfirming(false);
    }
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  // 已到货状态：前往入库验货
  const handleGotoQc = () => {
    onGotoQc(record);
  };

  return (
    <div
      className={cn(
        "relative rounded-xl bg-white border border-gray-100 shadow-sm",
        "transition-all duration-200 hover:shadow-md hover:border-gray-200"
      )}
    >
      {/* 左侧状态色条 */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
          config.barColor,
          config.barShadow
        )}
      />

      {/* 状态Badge（右上角） */}
      <div
        className={cn(
          "absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-medium border",
          config.badgeBg,
          config.badgeText,
          config.badgeBorder
        )}
      >
        {config.badgeLabel}
      </div>

      {/* 卡片内容 */}
      <div className="pl-3 pr-4 py-4">
        {/* 主信息行 */}
        <div className="flex items-start gap-3">
          {/* 主图 */}
          <div
            className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 relative flex items-center justify-center cursor-pointer"
            onClick={onCardClick}
          >
            {record.demandProductImage ? (
              <img
                src={record.demandProductImage}
                alt={record.demandProductName || "商品"}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="w-6 h-6 text-gray-300" />
            )}
          </div>

          {/* 信息区 */}
          <div className="flex-1 min-w-0">
            {/* 供应商名 */}
            <div className="text-xs text-gray-500 truncate">
              {record.supplierName || "未知供应商"}
            </div>
            {/* 采购价 */}
            <div className="text-sm font-medium text-gray-900">
              {formatCNY(record.purchasePrice ? parseFloat(record.purchasePrice) : 0)}
            </div>
          </div>
        </div>

        {/* 快递信息行 */}
        {record.domesticTrackingNo && (
          <div className="flex items-center gap-2 mt-2">
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: `${carrierColor}20`,
                color: carrierColor,
              }}
            >
              {record.domesticCarrier || "未知快递"}
            </span>
            <span className="text-xs font-mono text-gray-600 truncate">
              {record.domesticTrackingNo}
            </span>
          </div>
        )}

        {/* 时间行 */}
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar className="w-3 h-3" />
            <span>采购: {formatDateTime(record.orderedAt)}</span>
          </div>
          {status === "shipped" && (
            <div className={cn(
              "flex items-center gap-1 text-xs",
              transitDays > 3 ? "text-amber-600" : "text-purple-600"
            )}>
              {transitDays > 3 && <AlertTriangle className="w-3 h-3" />}
              <Clock className="w-3 h-3" />
              <span>运输第{transitDays}天</span>
            </div>
          )}
          {status === "received" && (
            <div className="flex items-center gap-1 text-xs text-teal-600">
              <Check className="w-3 h-3" />
              <span>到货: {formatDateTime(record.receivedAt)}</span>
            </div>
          )}
        </div>

        {/* 关联订单 */}
        {record.ozonPostingNumbers && record.ozonPostingNumbers.length > 0 && (
          <div className="text-xs text-gray-400 mt-2 truncate">
            关联订单: {record.ozonPostingNumbers.join(", ")}
          </div>
        )}

        {/* 分隔线 */}
        <div className="border-t border-gray-100 my-2" />

        {/* 交互区（根据status动态渲染） */}
        {status === "ordered" && (
          <>
            {!isExpanded ? (
              <div
                className={cn(
                  "flex items-center justify-center gap-1 py-2",
                  "cursor-pointer hover:bg-blue-50 rounded-lg transition-colors"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(true);
                }}
              >
                <span className="text-sm text-blue-600 font-medium">点击展开录入快递单号</span>
              </div>
            ) : (
              <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100">
                {/* 收起按钮 */}
                <div className="flex justify-end mb-2">
                  <button
                    className="text-xs text-gray-500 hover:text-gray-700"
                    onClick={() => setIsExpanded(false)}
                  >
                    收起
                  </button>
                </div>

                {/* 输入框 */}
                <input
                  type="text"
                  value={trackingNo}
                  onChange={(e) => handleTrackingNoChange(e.target.value)}
                  placeholder="粘贴/扫码快递单号"
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    "focus:outline-none focus:ring-2",
                    bindError
                      ? "border-red-300 focus:ring-red-100"
                      : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"
                  )}
                  autoFocus
                />

                {/* 快递公司识别 */}
                {trackingNo.trim() && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">识别结果:</span>
                    {detectedCarrier ? (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: `${getCarrierColor(detectedCarrier)}20`,
                          color: getCarrierColor(detectedCarrier),
                        }}
                      >
                        {detectedCarrier}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">未知快递</span>
                    )}
                  </div>
                )}

                {/* 错误提示 */}
                {bindError && (
                  <div className="text-xs text-red-500 mt-2">{bindError}</div>
                )}

                {/* 绑定按钮 */}
                <button
                  disabled={binding || !trackingNo.trim()}
                  onClick={handleBindTracking}
                  className={cn(
                    "w-full mt-3 py-2 rounded-lg text-sm font-medium",
                    "transition-colors flex items-center justify-center gap-2",
                    binding || !trackingNo.trim()
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  )}
                >
                  {binding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>绑定中...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>确认绑定</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {status === "shipped" && (
          <div className="relative">
            {/* 长按按钮 */}
            <button
              onMouseDown={handlePressStart}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={handlePressStart}
              onTouchEnd={handlePressEnd}
              disabled={confirming}
              className={cn(
                "w-full py-2 rounded-lg text-sm font-medium transition-colors",
                "flex items-center justify-center gap-2",
                pressing
                  ? "bg-purple-100 text-purple-700"
                  : "bg-purple-50 text-purple-600 hover:bg-purple-100",
                confirming && "opacity-50 cursor-not-allowed"
              )}
            >
              {confirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>确认中...</span>
                </>
              ) : pressing ? (
                <span>按住确认 ({progress}%)</span>
              ) : (
                <span>长按2秒确认到货</span>
              )}
            </button>

            {/* 进度条 */}
            {pressing && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-[20ms]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {status === "received" && (
          <div
            className={cn(
              "flex items-center justify-center gap-1 py-2",
              "cursor-pointer hover:bg-teal-50 rounded-lg transition-colors"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleGotoQc();
            }}
          >
            <ArrowRight className="w-4 h-4 text-teal-600" />
            <span className="text-sm text-teal-600 font-medium">前往入库验货</span>
          </div>
        )}
      </div>
    </div>
  );
}