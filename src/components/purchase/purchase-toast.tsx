'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Undo2, Check, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number; // 毫秒，默认 3000
  onUndo?: () => void;
}

interface PurchaseToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export function PurchaseToast({ toasts, onRemove }: PurchaseToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onRemove={() => onRemove(toast.id)} 
        />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: () => void }) {
  const [isExiting, setIsExiting] = useState(false);
  
  // 自动消失
  useEffect(() => {
    const duration = toast.duration || 3000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onRemove, 300); // 等待动画完成
    }, duration);
    
    return () => clearTimeout(timer);
  }, [toast.duration, onRemove]);
  
  // 手动关闭
  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onRemove, 300);
  };
  
  // 撤销操作
  const handleUndo = () => {
    toast.onUndo?.();
    handleClose();
  };
  
  // 根据类型选择图标和样式
  const getTypeStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: <Check className="w-4 h-4" />,
          bgClass: 'bg-emerald-50 border-emerald-200',
          iconClass: 'text-emerald-500 bg-emerald-100',
          textClass: 'text-emerald-700',
        };
      case 'error':
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          bgClass: 'bg-red-50 border-red-200',
          iconClass: 'text-red-500 bg-red-100',
          textClass: 'text-red-700',
        };
      case 'info':
        return {
          icon: <Info className="w-4 h-4" />,
          bgClass: 'bg-blue-50 border-blue-200',
          iconClass: 'text-blue-500 bg-blue-100',
          textClass: 'text-blue-700',
        };
    }
  };
  
  const styles = getTypeStyles();
  
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300",
        styles.bgClass,
        isExiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
      )}
    >
      {/* 图标 */}
      <div className={cn("p-1 rounded-full", styles.iconClass)}>
        {styles.icon}
      </div>
      
      {/* 消息 */}
      <span className={cn("text-sm font-medium", styles.textClass)}>
        {toast.message}
      </span>
      
      {/* 撤销按钮（可选） */}
      {toast.onUndo && (
        <button
          onClick={handleUndo}
          className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
        >
          <Undo2 className="w-3 h-3" />
          撤销
        </button>
      )}
      
      {/* 关闭按钮 */}
      <button
        onClick={handleClose}
        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-white rounded transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Toast Hook - 方便在组件中使用
export function usePurchaseToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  const addToast = useCallback((
    message: string, 
    type: 'success' | 'error' | 'info' = 'info',
    options?: { duration?: number; onUndo?: () => void }
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast: ToastMessage = {
      id,
      message,
      type,
      duration: options?.duration,
      onUndo: options?.onUndo,
    };
    
    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);
  
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  
  const showToast = useCallback((
    message: string, 
    type: 'success' | 'error' | 'info' = 'info',
    onUndo?: () => void
  ) => {
    return addToast(message, type, { onUndo });
  }, [addToast]);
  
  return {
    toasts,
    addToast,
    removeToast,
    showToast,
    ToastComponent: () => <PurchaseToast toasts={toasts} onRemove={removeToast} />,
  };
}