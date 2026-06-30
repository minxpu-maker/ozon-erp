"use client";

import { Package, Calendar, CalendarCheck, ArrowRight } from "lucide-react";
import { cn, formatCNY } from "@/lib/utils";
import { getCarrierColor } from "@/lib/utils/express-carrier";
import { PurchaseRecord } from "@/lib/api/purchase";

// 已到货记录类型（继承PurchaseRecord）
export interface ReceivedRecord extends PurchaseRecord {
  // receivedAt 已在 PurchaseRecord 中定义
}

interface ReceivedCardProps {
  record: ReceivedRecord;
  onCardClick: () => void;
  onToast: (msg: string, type: "success" | "error") => void;
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

export function ReceivedCard({ record, onCardClick, onToast }: ReceivedCardProps) {
  const carrierColor = record.domesticCarrier ? getCarrierColor(record.domesticCarrier) : "#6B7280";

  const handleGotoQc = () => {
    onToast("入库验货模块开发中，敬请期待", "success");
  };

  return (
    <div
      className={cn(
        "relative rounded-xl bg-white border border-gray-100 shadow-sm",
        "transition-all duration-200 hover:shadow-md hover:border-gray-200",
        "cursor-pointer"
      )}
      onClick={onCardClick}
    >
      {/* 左侧青色状态色条 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-l-xl shadow-[0_0_8px_rgba(20,184,166,0.5)]"
      />

      {/* 卡片内容 */}
      <div className="pl-3 pr-4 py-4">
        {/* 主信息行：主图 + 供应商名 + 采购价 */}
        <div className="flex items-start gap-3">
          {/* 主图 */}
          <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 relative flex items-center justify-center">
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
            {/* 快递公司标签 */}
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: `${carrierColor}20`,
                color: carrierColor,
              }}
            >
              {record.domesticCarrier || "未知快递"}
            </span>
            {/* 快递单号 */}
            <span className="text-xs font-mono text-gray-600 truncate">
              {record.domesticTrackingNo}
            </span>
          </div>
        )}

        {/* 时间行 */}
        <div className="flex items-center gap-4 mt-2">
          {/* 采购时间 */}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar className="w-3 h-3" />
            <span>采购: {formatDateTime(record.orderedAt)}</span>
          </div>
          {/* 到货时间 */}
          <div className="flex items-center gap-1 text-xs text-teal-600">
            <CalendarCheck className="w-3 h-3" />
            <span>到货: {formatDateTime(record.receivedAt)}</span>
          </div>
        </div>

        {/* 关联订单 */}
        {record.ozonPostingNumbers && record.ozonPostingNumbers.length > 0 && (
          <div className="text-xs text-gray-400 mt-2 truncate">
            关联订单: {record.ozonPostingNumbers.join(", ")}
          </div>
        )}

        {/* 分隔线 */}
        <div className="border-t border-gray-100 my-2" />

        {/* 底部链接区 */}
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
      </div>
    </div>
  );
}