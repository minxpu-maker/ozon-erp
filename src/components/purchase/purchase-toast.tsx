'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Undo2, CheckCircle, AlertCircle, Info, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number; // 毫秒，默认 3000，error 类型默认不自动消失
  onUndo?: () => void;
  onRetry?: () => void; // 新增重试回调
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
  const [progress, setProgress] = useState(100); // 进度条（仅 success/info）
  
  // 自动消失逻辑：error 类型不自动消失
  useEffect(() => {
    // error 类型不自动消失
    if (toast.type === 'error') {
      return;
    }
    
    const duration = toast.duration || 3000;
    const startTime = Date.now();
    
    // 进度条动画
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
    }, 50);
    
    // 自动消失定时器
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onRemove, 200); // 等待退场动画完成
    }, duration);
    
    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [toast.duration, toast.type, onRemove]);
  
  // 手动关闭
  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onRemove, 200);
  };
  
  // 撤销操作
  const handleUndo = () => {
    toast.onUndo?.();
    handleClose();
  };
  
  // 重试操作
  const handleRetry = () => {
    toast.onRetry?.();
    handleClose();
  };
  
  // 根据类型选择左侧色条颜色
  const getBarColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-emerald-500';
      case 'error':
        return 'bg-red-500';
      case 'info':
        return 'bg-blue-500';
    }
  };
  
  // 根据类型选择图标和颜色
  const getTypeStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          iconClass: 'text-emerald-500',
          textClass: 'text-gray-900',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          iconClass: 'text-red-500',
          textClass: 'text-gray-900',
        };
      case 'info':
        return {
          icon: <Info className="w-5 h-5" />,
          iconClass: 'text-blue-500',
          textClass: 'text-gray-900',
        };
    }
  };
  
  const styles = getTypeStyles();
  
  return (
    <div
      className={cn(
        "relative max-w-md rounded-xl bg-white border border-gray-100 shadow-lg px-5 py-3",
        "transition-all duration-200 ease-out overflow-hidden",
        isExiting ? "opacity-0 translate-y-[-10px]" : "opacity-100 translate-y-0",
        // 入场动画通过 CSS 实现
        "animate-toast-in"
      )}
    >
      {/* 左侧色条 */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
        getBarColor()
      )} />
      
      {/* 进度条（仅 success/info 显示） */}
      {toast.type !== 'error' && (
        <div 
          className="absolute bottom-0 left-1 right-0 h-1 bg-gray-100 rounded-br-xl overflow-hidden"
        >
          <div 
            className={cn(
              "h-full transition-all duration-[50ms] ease-linear",
              toast.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      
      {/* 内容区 */}
      <div className="flex items-center gap-3">
        {/* 图标 */}
        <div className={cn(styles.iconClass)}>
          {styles.icon}
        </div>
        
        {/* 消息 */}
        <span className={cn("text-sm font-medium flex-1", styles.textClass)}>
          {toast.message}
        </span>
        
        {/* 操作按钮区 */}
        <div className="flex items-center gap-1">
          {/* 重试按钮（仅 error 类型） */}
          {toast.type === 'error' && toast.onRetry && (
            <button
              onClick={handleRetry}
              className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              重试
            </button>
          )}
          
          {/* 撤销按钮（可选） */}
          {toast.onUndo && (
            <button
              onClick={handleUndo}
              className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
            >
              <Undo2 className="w-3 h-3" />
              撤销
            </button>
          )}
          
          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast Hook - 方便在组件中使用
export function usePurchaseToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  const addToast = useCallback((
    message: string, 
    type: 'success' | 'error' | 'info' = 'info',
    options?: { duration?: number; onUndo?: () => void; onRetry?: () => void }
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast: ToastMessage = {
      id,
      message,
      type,
      duration: options?.duration,
      onUndo: options?.onUndo,
      onRetry: options?.onRetry,
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
    onUndo?: () => void,
    onRetry?: () => void
  ) => {
    return addToast(message, type, { onUndo, onRetry });
  }, [addToast]);
  
  return {
    toasts,
    addToast,
    removeToast,
    showToast,
    ToastComponent: () => <PurchaseToast toasts={toasts} onRemove={removeToast} />,
  };
}