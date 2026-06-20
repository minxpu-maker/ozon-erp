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
    // Return no-op functions when outside provider
    return {
      toast: () => {},
      dismiss: () => {},
    };
  }
  return context;
}

// Icon components for each type
function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case "success":
      return (
        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case "error":
      return (
        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case "warning":
      return (
        <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case "info":
      return (
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

const typeStyles: Record<ToastType, string> = {
  success: "bg-green-50 border-green-200",
  error: "bg-red-50 border-red-200",
  warning: "bg-amber-50 border-amber-200",
  info: "bg-blue-50 border-blue-200",
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

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 100) {
          clearInterval(interval);
          setIsExiting(true);
          setTimeout(() => onDismiss(toast.id), 200);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused, toast.id, onDismiss]);

  const progress = remaining / toast.duration;

  return (
    <div
      className={`relative overflow-hidden rounded-lg shadow-lg border px-4 py-3 max-w-sm animate-slideInRight ${typeStyles[toast.type]}`}
      style={{ minWidth: "280px" }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-start gap-3">
        <ToastIcon type={toast.type} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{toast.title}</p>
          {toast.description && (
            <p className="text-sm text-gray-600 mt-0.5">{toast.description}</p>
          )}
        </div>
        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(() => onDismiss(toast.id), 200);
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
        <div
          className={`h-full transition-all duration-100 ${
            toast.type === "success" ? "bg-green-500" :
            toast.type === "error" ? "bg-red-500" :
            toast.type === "warning" ? "bg-amber-500" : "bg-blue-500"
          }`}
          style={{ width: `${progress * 100}%` }}
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
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
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
    const duration = options.duration ?? (options.type === "error" ? 5000 : 3000);

    const newToast: Toast = {
      id,
      type: options.type ?? "info",
      title: options.title,
      description: options.description,
      duration,
      createdAt: Date.now(),
    };

    setToasts((prev) => [newToast, ...prev].slice(0, 5)); // Max 5 toasts
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
