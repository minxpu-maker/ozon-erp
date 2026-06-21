"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
  createdAt: number;
}

interface ToastOptions {
  type?: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toast: () => {},
      dismiss: () => {},
    };
  }
  return context;
}

// 高端动画样式
const slideInAnimation = `
  @keyframes toastSlideIn {
    0% {
      opacity: 0;
      transform: translateY(-100%) scale(0.9);
    }
    60% {
      transform: translateY(10%) scale(1.02);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @keyframes toastSlideOut {
    0% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
  }
  @keyframes toastPulse {
    0%, 100% {
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1), 0 0 0 0 rgba(22, 163, 74, 0.4);
    }
    50% {
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 8px rgba(22, 163, 74, 0);
    }
  }
  @keyframes progressGlow {
    0% {
      opacity: 0.8;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.8;
    }
  }
  @keyframes iconBounce {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }
`;

function ToastIcon({ type }: { type: ToastType }) {
  const baseClass = "w-6 h-6 transition-all duration-300";
  
  switch (type) {
    case "success":
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-30" />
          <svg className={`${baseClass} text-emerald-600 animate-[iconBounce_0.6s_ease-in-out]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    case "error":
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-30" />
          <svg className={`${baseClass} text-red-600 animate-[iconBounce_0.6s_ease-in-out]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    case "warning":
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-30" />
          <svg className={`${baseClass} text-amber-600 animate-[iconBounce_0.6s_ease-in-out]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      );
    case "info":
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-30" />
          <svg className={`${baseClass} text-blue-600 animate-[iconBounce_0.6s_ease-in-out]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
  }
}

const typeStyles: Record<ToastType, { bg: string; border: string; progress: string; iconBg: string }> = {
  success: {
    bg: "bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50",
    border: "border-green-200/50",
    progress: "bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500",
    iconBg: "bg-gradient-to-br from-green-100 to-emerald-100",
  },
  error: {
    bg: "bg-gradient-to-br from-red-50 via-rose-50 to-pink-50",
    border: "border-red-200/50",
    progress: "bg-gradient-to-r from-rose-500 via-red-500 to-rose-500",
    iconBg: "bg-gradient-to-br from-red-100 to-rose-100",
  },
  warning: {
    bg: "bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50",
    border: "border-amber-200/50",
    progress: "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500",
    iconBg: "bg-gradient-to-br from-amber-100 to-yellow-100",
  },
  info: {
    bg: "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50",
    border: "border-blue-200/50",
    progress: "bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500",
    iconBg: "bg-gradient-to-br from-blue-100 to-indigo-100",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [isPaused, setIsPaused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [remaining, setRemaining] = useState(toast.duration);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isPaused || isHovered) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 100) {
          clearInterval(interval);
          setIsExiting(true);
          setTimeout(() => onDismiss(toast.id), 400);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused, isHovered, toast.id, onDismiss]);

  const progress = remaining / toast.duration;
  const styles = typeStyles[toast.type];

  return (
    <style>{slideInAnimation}</style>
  ) ? null : (
    <div
      className={`
        relative overflow-hidden rounded-2xl border backdrop-blur-xl
        shadow-[0_8px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)]
        transition-all duration-300 ease-out
        ${styles.bg} ${styles.border}
        ${isExiting 
          ? "opacity-0 translate-y-[-20px] scale-95" 
          : "opacity-100 translate-y-0 scale-100 animate-[toastSlideIn_0.5s_cubic-bezier(0.34,1.56,0.64,1)]"
        }
        ${!isPaused && !isHovered && progress > 0 ? "animate-[toastPulse_2s_ease-in-out_infinite]" : ""}
      `}
      style={{ 
        minWidth: "320px", 
        maxWidth: "420px",
        backdropFilter: "blur(20px)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 装饰性渐变条纹 */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${styles.progress}`} />
      
      {/* 主内容区 */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* 图标容器 */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${styles.iconBg}`}>
            <ToastIcon type={toast.type} />
          </div>
          
          {/* 文字内容 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 tracking-tight">{toast.title}</p>
            {toast.description && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{toast.description}</p>
            )}
          </div>
          
          {/* 关闭按钮 */}
          <button
            onClick={() => {
              setIsExiting(true);
              setTimeout(() => onDismiss(toast.id), 400);
            }}
            className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100/80 hover:bg-gray-200 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
          >
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* 进度条 */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100/50">
        <div
          className={`h-full transition-all duration-100 ease-linear ${
            isPaused || isHovered ? "opacity-50" : "animate-[progressGlow_1s_ease-in-out_infinite]"
          }`}
          style={{ 
            width: `${progress * 100}%`,
            background: toast.type === "success" ? "linear-gradient(90deg, #10b981, #34d399, #10b981)" :
                       toast.type === "error" ? "linear-gradient(90deg, #ef4444, #f87171, #ef4444)" :
                       toast.type === "warning" ? "linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)" :
                       "linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)"
          }}
        />
      </div>
    </div>
  );
}

function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div 
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 items-center"
      style={{ maxWidth: "90vw" }}
    >
      {toasts.map((toast, index) => (
        <div 
          key={toast.id}
          className="animate-[toastSlideIn_0.5s_cubic-bezier(0.34,1.56,0.64,1)]"
          style={{ 
            animationDelay: `${index * 0.1}s`,
            animationFillMode: "both"
          }}
        >
          <ToastItem toast={toast} onDismiss={dismiss} />
        </div>
      ))}
    </div>,
    document.body
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const duration = options.duration ?? (options.type === "error" ? 5000 : 3500);

    const newToast: Toast = {
      id,
      type: options.type ?? "info",
      title: options.title,
      description: options.description,
      duration,
      createdAt: Date.now(),
    };

    setToasts((prev) => [newToast, ...prev].slice(0, 3));
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {mounted && <ToastContainer toasts={toasts} dismiss={dismiss} />}
    </ToastContext.Provider>
  );
}
