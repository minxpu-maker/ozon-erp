"use client";

import { useState, useCallback, useRef } from "react";
import { LayoutGrid, LayoutList } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ViewMode = "card" | "list";

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
}

export function ViewToggle({ viewMode, onViewChange }: ViewToggleProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [showToggleAnimation, setShowToggleAnimation] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const handleToggle = useCallback(
    (mode: ViewMode) => {
      if (isToggling || mode === viewMode) return;

      // 300ms防抖
      setIsToggling(true);
      setShowToggleAnimation(true);

      onViewChange(mode);

      // 300ms后解除锁定
      debounceTimer.current = setTimeout(() => {
        setIsToggling(false);
        setShowToggleAnimation(false);
      }, 300);
    },
    [isToggling, viewMode, onViewChange]
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="inline-flex items-center rounded-lg bg-slate-100/80 p-0.5">
        {/* 卡片视图按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleToggle("card")}
              disabled={isToggling}
              className={`w-9 h-9 flex items-center justify-center rounded-md transition-all duration-200 ${
                viewMode === "card"
                  ? `bg-white text-blue-600 shadow-sm ${showToggleAnimation ? "toggle-active" : ""}`
                  : "text-slate-400 hover:text-slate-600 hover:scale-[1.05] active:scale-[0.95]"
              }`}
              aria-label="卡片视图"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            卡片视图
          </TooltipContent>
        </Tooltip>

        {/* 列表视图按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleToggle("list")}
              disabled={isToggling}
              className={`w-9 h-9 flex items-center justify-center rounded-md transition-all duration-200 ${
                viewMode === "list"
                  ? `bg-white text-blue-600 shadow-sm ${showToggleAnimation ? "toggle-active" : ""}`
                  : "text-slate-400 hover:text-slate-600 hover:scale-[1.05] active:scale-[0.95]"
              }`}
              aria-label="列表视图"
            >
              <LayoutList className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            列表视图
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}