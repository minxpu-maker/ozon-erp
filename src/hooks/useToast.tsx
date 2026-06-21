'use client';

import { toast as sonnerToast, Toaster } from 'sonner';

// Re-export sonner components
export { Toaster };

// Simple toast function - compatible with code that expects toast() call
export function toast(options: { title?: string; description?: string; type?: 'success' | 'error' | 'warning' | 'info'; duration?: number } | string) {
  if (typeof options === 'string') {
    sonnerToast.success(options);
    return;
  }
  
  const { title, description, type = 'success', duration } = options;
  const config = { duration: duration || 4000 };
  
  switch (type) {
    case 'error':
      sonnerToast.error(title || description || 'Error', config);
      break;
    case 'warning':
      sonnerToast.warning(title || description || 'Warning', config);
      break;
    case 'info':
      sonnerToast.info(title || description || 'Info', config);
      break;
    default:
      sonnerToast.success(title || description || 'Success', config);
  }
}

// Legacy compatibility
export { sonnerToast as toast };

// Empty stubs for components that may be imported but not used
export function useToast() { return {}; }
export function ToastProvider({ children }: { children: React.ReactNode }) { return children; }
export function ToastViewport() { return null; }
export function Toast(props: any) { return props.children; }
export function ToastClose() { return null; }
export function ToastDescription() { return null; }
export function ToastTitle() { return null; }
