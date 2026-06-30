"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Package, ChevronDown, ChevronUp, Check, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { cn, formatCNY } from "@/lib/utils";
import { identifyCarrier, getCarrierColor } from "@/lib/utils/express-carrier";
import { bindTrackingNumber } from "@/lib/api/purchase";

export interface OrderedRecord {
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

export interface OrderedCardProps {
  record: OrderedRecord;
  records?: OrderedRecord[];
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  onCardClick: () => void;
  onBindSuccess: () => void;
  onToast: (msg: string, type: "success" | "error") => void;
}

export function OrderedCard({
  record,
  records,
  isExpanded,
  onExpandChange,
  onCardClick,
  onBindSuccess,
  onToast,
}: OrderedCardProps) {
  const [trackingNo, setTrackingNo] = useState("");
  const [detectedCarrier, setDetectedCarrier] = useState<string | null>(null);
  const [applyToAll, setApplyToAll] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAggregate = records && records.length > 1;
  const hasTrackingNo = record.domesticTrackingNo && record.domesticTrackingNo.trim() !== "";

  // 自动展开下一张时 autoFocus
  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isExpanded]);

  // 快递单号输入后自动识别快递公司
  const handleTrackingNoChange = useCallback((value: string) => {
    setTrackingNo(value);
    setError(null);
    if (value.trim()) {
      const carrier = identifyCarrier(value.trim());
      setDetectedCarrier(carrier);
    } else {
      setDetectedCarrier(null);
    }
  }, []);

  // 点击展开链接
  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExpandChange(!isExpanded);
  };

  // 点击卡片信息区（折叠态）
  const handleCardClick = (e: React.MouseEvent) => {
    if (!isExpanded) {
      onCardClick();
    }
  };

  // 提交绑定
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!trackingNo.trim()) {
      setError("请输入快递单号");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const data = {
        domesticTrackingNo: trackingNo.trim(),
        domesticCarrier: detectedCarrier || undefined,
      };

      // 批量绑定
      if (isAggregate && applyToAll && records) {
        await Promise.all(
          records.map((r) => bindTrackingNumber(r.id, data))
        );
      } else {
        await bindTrackingNumber(record.id, data);
      }

      onToast("快递单号已绑定", "success");
      onBindSuccess();
    } catch (err) {
      setError("绑定失败，请重试");
      setSubmitting(false);
    }
  };

  // Enter 提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !submitting) {
      handleSubmit();
    }
  };

  // 格式化采购时间
  const formatOrderedTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hour}:${minute}`;
  };

  return (
    <div
      className={cn(
        "relative rounded-xl bg-white border border-gray-100 shadow-sm transition-all duration-200",
        isExpanded ? "ring-2 ring-blue-400 border-blue-200" : "hover:shadow-md hover:border-gray-200 hover:-translate-y-0.5"
      )}
    >
      {/* 左侧蓝色色条 */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl" />

      {/* 卡片内容区 */}
      <div className="pl-4 pr-4 pt-4 pb-3 cursor-pointer" onClick={handleCardClick}>
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

            {/* 采购时间 */}
            <div className="text-xs text-gray-400 mb-1">
              {formatOrderedTime(record.orderedAt)}
            </div>

            {/* 快递单号状态 */}
            {hasTrackingNo ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono text-gray-600">
                  {record.domesticTrackingNo}
                </span>
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
              </div>
            ) : (
              <span className="text-xs text-amber-500">待录入快递单号</span>
            )}
          </div>

          {/* 聚合角标 */}
          {isAggregate && (
            <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
              {records!.length}
            </div>
          )}
        </div>
      </div>

      {/* 展开链接 */}
      {!isExpanded && (
        <div
          className="text-xs text-blue-500 text-center pb-2 cursor-pointer hover:text-blue-600"
          onClick={handleExpandClick}
        >
          点击展开录入快递单号
        </div>
      )}

      {/* 展开区 */}
      {isExpanded && (
        <div
          className="bg-blue-50/50 rounded-lg mx-3 mb-3 p-3 border border-blue-100"
          style={{
            animation: "expandHeight 200ms ease-out forwards",
          }}
        >
          {/* 收起按钮 */}
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={handleExpandClick}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <ChevronUp className="w-3 h-3" />
              收起
            </button>
          </div>

          {/* 快递单号输入框 */}
          <div className="mb-2">
            <input
              ref={inputRef}
              type="text"
              value={trackingNo}
              onChange={(e) => handleTrackingNoChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="粘贴/扫码快递单号"
              disabled={submitting}
              className={cn(
                "w-full rounded-lg bg-white border px-3 py-2 text-sm transition-all",
                error ? "border-red-300" : "border-gray-200",
                "focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none",
                submitting && "opacity-50 cursor-not-allowed"
              )}
            />
          </div>

          {/* 快递公司识别 */}
          {trackingNo.trim() && (
            <div className="mb-2 flex items-center gap-1.5">
              {detectedCarrier ? (
                <span
                  className={cn(
                    "text-xs px-2 py-1 rounded",
                    getCarrierColor(detectedCarrier)
                  )}
                >
                  {detectedCarrier}
                </span>
              ) : (
                <span className="text-xs text-gray-400 px-2 py-1 rounded bg-gray-100">
                  未知快递
                </span>
              )}
            </div>
          )}

          {/* 批量绑定选项 */}
          {isAggregate && (
            <div className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                disabled={submitting}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label className="text-xs text-gray-600">
                将此快递单号应用至全部 {records!.length} 笔记录
              </label>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {error}
            </div>
          )}

          {/* 确认绑定按钮 */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !trackingNo.trim()}
            className={cn(
              "w-full rounded-lg bg-blue-500 text-white text-sm font-medium py-2 mt-2",
              "hover:bg-blue-600 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                绑定中...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                确认绑定
              </span>
            )}
          </button>
        </div>
      )}

      {/* CSS 动画 */}
      <style>{`
        @keyframes expandHeight {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 300px;
          }
        }
      `}</style>
    </div>
  );
}