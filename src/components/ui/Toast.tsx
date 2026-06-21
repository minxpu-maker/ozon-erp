"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const toastStyles = {
  success: {
    bg: "bg-gradient-to-r from-emerald-50 to-teal-50",
    border: "border-emerald-200",
    icon: "text-emerald-500",
    progress: "bg-emerald-500",
    shadow: "shadow-emerald-100",
  },
  error: {
    bg: "bg-gradient-to-r from-red-50 to-rose-50",
    border: "border-red-200",
    icon: "text-red-500",
    progress: "bg-red-500",
    shadow: "shadow-red-100",
  },
  info: {
    bg: "bg-gradient-to-r from-blue-50 to-indigo-50",
    border: "border-blue-200",
    icon: "text-blue-500",
    progress: "bg-blue-500",
    shadow: "shadow-blue-100",
  },
  warning: {
    bg: "bg-gradient-to-r from-amber-50 to-orange-50",
    border: "border-amber-200",
    icon: "text-amber-500",
    progress: "bg-amber-500",
    shadow: "shadow-amber-100",
  },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = toast.duration || 5000;
  const style = toastStyles[toast.type];
  const Icon = toastIcons[toast.type];

  useEffect(() => {
    // 入场动画
    requestAnimationFrame(() => setIsVisible(true));

    // 进度条计时器
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 16);

    // 自动移除
    const removeTimer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onRemove, 300);
    }, duration);

    return () => {
      clearInterval(timer);
      clearTimeout(removeTimer);
    };
  }, [duration, onRemove]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(onRemove, 300);
  };

  return (
    <div
      className={cn(
        "relative w-96 overflow-hidden rounded-xl border transition-all duration-300 ease-out",
        style.bg,
        style.border,
        "shadow-lg",
        isVisible && !isLeaving
          ? "translate-y-0 opacity-100 scale-100"
          : "-translate-y-4 opacity-0 scale-95"
      )}
    >
      {/* 顶部图标条 */}
      <div className={cn(
        "absolute top-0 left-0 w-1 h-full",
        style.icon.replace("text-", "bg-")
      )} />
      
      <div className="p-4 pl-5">
        <div className="flex items-start gap-3">
          {/* 图标 */}
          <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
            style.icon,
            "bg-white/80 backdrop-blur-sm shadow-sm"
          )}>
            <Icon className="w-5 h-5" />
          </div>
          
          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-tight">
              {toast.title}
            </p>
            {toast.description && (
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                {toast.description}
              </p>
            )}
          </div>
          
          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* 底部进度条 */}
      <div className="h-1 bg-gray-100/50">
        <div
          className={cn(
            "h-full transition-all duration-100 ease-linear",
            style.progress,
            isLeaving && "opacity-50"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      
      {/* 全局通知弹窗容器 - 居中显示在顶部 */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// 便捷的通知函数
let globalAddToast: ((toast: Omit<Toast, "id">) => void) | null = null;

export function setGlobalToast(addToast: (toast: Omit<Toast, "id">) => void) {
  globalAddToast = addToast;
}

export const toast = {
  success: (title: string, description?: string) => 
    globalAddToast?.({ type: "success", title, description }),
  error: (title: string, description?: string) => 
    globalAddToast?.({ type: "error", title, description }),
  info: (title: string, description?: string) => 
    globalAddToast?.({ type: "info", title, description }),
  warning: (title: string, description?: string) => 
    globalAddToast?.({ type: "warning", title, description }),
};
