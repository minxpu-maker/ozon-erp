"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];

export function PaginationBar({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm px-5 py-3 flex items-center justify-between mt-4">
      {/* 左侧：每页条数选择器 + 总条数 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">每页显示</span>
        <select
          value={pageSize}
          onChange={(e) => {
            const newSize = Number(e.target.value);
            onPageSizeChange(newSize);
            onPageChange(1); // 重置到第1页
          }}
          className="w-[72px] rounded-lg bg-slate-50 border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100 focus-visible:outline-none transition-colors cursor-pointer"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">条</span>
        <span className="text-xs text-gray-400 ml-3">共 {total} 条</span>
      </div>

      {/* 右侧：分页器 */}
      <div className="flex items-center gap-1">
        {/* 上一页 */}
        <button
          onClick={() => canGoPrev && onPageChange(page - 1)}
          disabled={!canGoPrev}
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-md transition-colors",
            canGoPrev
              ? "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              : "opacity-30 cursor-not-allowed"
          )}
          aria-label="上一页"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* 页码 */}
        <div className="flex items-center gap-1 mx-1">
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (page <= 4) {
              pageNum = i + 1;
              if (i === 6) pageNum = totalPages;
            } else if (page >= totalPages - 3) {
              pageNum = i === 0 ? 1 : totalPages - 6 + i;
            } else {
              if (i === 0) pageNum = 1;
              else if (i === 6) pageNum = totalPages;
              else pageNum = page - 3 + i;
            }

            const isCurrentPage = pageNum === page;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-all duration-150",
                  isCurrentPage
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                )}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* 下一页 */}
        <button
          onClick={() => canGoNext && onPageChange(page + 1)}
          disabled={!canGoNext}
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-md transition-colors",
            canGoNext
              ? "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              : "opacity-30 cursor-not-allowed"
          )}
          aria-label="下一页"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
