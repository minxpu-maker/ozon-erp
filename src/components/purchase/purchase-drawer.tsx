"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface PurchaseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit" | "view";
  data?: unknown;
}

export function PurchaseDrawer({
  open,
  onOpenChange,
  mode,
  data,
}: PurchaseDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-[720px] max-w-[720px] rounded-l-2xl p-0",
          "bg-white"
        )}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === "create" ? "新建采购" : mode === "edit" ? "编辑采购" : "查看采购"}
          </h2>
        </div>

        {/* Drawer Content - Placeholder */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="text-center text-gray-400 py-12">
            <p>Drawer 内容区域</p>
            <p className="text-sm mt-2">后续指令完善</p>
            {data !== undefined && data !== null && (
              <p className="text-sm mt-4 text-gray-500">
                当前数据已加载
              </p>
            )}
          </div>
        </div>

        {/* Drawer Footer - Placeholder */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex justify-end gap-3">
            <button
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => onOpenChange(false)}
            >
              取消
            </button>
            {mode !== "view" && (
              <button
                className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
              >
                {mode === "create" ? "创建" : "保存"}
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}