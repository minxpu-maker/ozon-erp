"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrderRecord } from "./OrderCard";
import { cn } from "@/lib/utils";
import { formatRUB } from "@/lib/utils";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";
import { OzonStatusTag } from "./OzonStatusTag";

// 图片悬停放大组件
function ImageWithHover({ product }: { product: { image?: string | null; name?: string | null; sku?: string | null } }) {
  const [isHovering, setIsHovering] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e: React.MouseEvent<HTMLImageElement>) => {
    setIsHovering(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({ x: rect.right + 10, y: rect.top });
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  if (!product?.image) return null;

  return (
    <>
      <img
        src={product.image}
        alt=""
        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100 cursor-pointer transition-transform duration-200 hover:scale-110"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      {/* 悬停放大预览 */}
      {isHovering && (
        <div 
          className="fixed z-[9999] pointer-events-none"
          style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl p-2">
            <img
              src={product.image}
              alt={product.name || product.sku || ""}
              className="w-48 h-48 rounded-lg object-cover"
            />
            <p className="text-xs text-gray-500 mt-2 text-center truncate max-w-48">{product.name || product.sku || ""}</p>
          </div>
        </div>
      )}
    </>
  );
}

interface OrderListViewProps {
  orders: OrderRecord[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
}

export function OrderListView({
  orders,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: OrderListViewProps) {
  const router = useRouter();

  // 全选状态
  const allSelected = orders.length > 0 && orders.every((o) => selectedIds.has(String(o.id)));
  const someSelected = orders.some((o) => selectedIds.has(String(o.id))) && !allSelected;

  // 计算紧急度
  const getUrgencyLevel = (order: OrderRecord) => {
    if (!order.shipmentDeadline) return null;
    const deadline = new Date(order.shipmentDeadline).getTime();
    const now = Date.now();
    if (deadline < now) return "overdue";
    if (deadline - now < 24 * 60 * 60 * 1000) return "urgent";
    return null;
  };

  const urgencyColors = {
    overdue: "bg-red-700",
    urgent: "bg-amber-400",
  };

  return (
    <div className="overflow-auto">
      {/* 表头 */}
      <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center h-12 px-4 text-xs font-medium text-gray-500 uppercase">
          {/* 复选框 */}
          <div className="w-10 flex-shrink-0 flex justify-center">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={(e) => onToggleSelectAll(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>
          {/* 紧急 */}
          <div className="w-16 flex-shrink-0 text-center">紧急</div>
          {/* 商品信息 */}
          <div className="flex-1 min-w-0 px-2">商品信息</div>
          {/* SKU */}
          <div className="w-32 flex-shrink-0 px-2">SKU</div>
          {/* 数量 */}
          <div className="w-16 flex-shrink-0 text-center px-2">数量</div>
          {/* Ozon售价 */}
          <div className="w-28 flex-shrink-0 text-right px-2">Ozon售价</div>
          {/* 状态 */}
          <div className="w-24 flex-shrink-0 text-center px-2">状态</div>
          {/* 操作 */}
          <div className="w-24 flex-shrink-0 text-center px-2">操作</div>
        </div>
      </div>

      {/* 数据行 */}
      <div className="divide-y divide-gray-100">
        {orders.map((order) => {
          const urgency = getUrgencyLevel(order);
          const isSelected = selectedIds.has(String(order.id));
          const product = order.products?.[0];

          return (
            <div
              key={order.id}
              className={cn(
                "flex items-center h-14 px-4 hover:bg-gray-50 transition-colors duration-150 cursor-pointer",
                isSelected && "bg-blue-50"
              )}
              onClick={() => onToggleSelect(String(order.id))}
            >
              {/* 复选框 */}
              <div className="w-10 flex-shrink-0 flex justify-center">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(String(order.id))}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {/* 紧急度色条 */}
              <div className="w-16 flex-shrink-0 flex items-center justify-center gap-1">
                {urgency ? (
                  <>
                    <div className={cn("w-1 h-6 rounded-full", urgencyColors[urgency])} />
                    <span className="text-xs text-gray-500">
                      {urgency === "overdue" ? "超时" : "紧急"}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-gray-300">-</span>
                )}
              </div>

              {/* 商品信息 */}
              <div className="flex-1 min-w-0 flex items-center gap-3 px-2">
                {product?.image ? (
                  <ImageWithHover product={product} />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                    📦
                  </div>
                )}
                <span
                  className="truncate max-w-[250px] text-sm"
                  title={product?.name || "-"}
                >
                  {product?.name || "-"}
                </span>
              </div>

              {/* SKU */}
              <div className="w-32 flex-shrink-0 px-2">
                <span className="font-mono text-xs text-gray-600 truncate block">
                  {product?.sku || "-"}
                </span>
              </div>

              {/* 数量 */}
              <div className="w-16 flex-shrink-0 text-center px-2">
                <span className="text-sm">{order.products?.length || 1}</span>
              </div>

              {/* Ozon售价 */}
              <div className="w-28 flex-shrink-0 text-right px-2">
                <span className="text-sm font-medium">
                  {formatRUB(String(order.orderAmount))}
                </span>
              </div>

              {/* 状态 */}
              <div className="w-24 flex-shrink-0 flex items-center justify-center gap-1 px-2">
                <OzonStatusTag status={order.status} />
                <PurchaseStatusBadge status={order.erpStatus} />
              </div>

              {/* 操作按钮 */}
              <div className="w-24 flex-shrink-0 flex items-center justify-center gap-1 px-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/orders/list?highlight=${order.id}`);
                  }}
                  className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  查看
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 空状态 */}
      {orders.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          <p className="text-4xl mb-2">📋</p>
          <p>暂无订单</p>
        </div>
      )}
    </div>
  );
}
