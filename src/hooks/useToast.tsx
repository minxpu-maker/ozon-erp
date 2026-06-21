'use client';

import { Toaster } from 'sonner';

// Re-export sonner components
export { Toaster as ToastContainer };

// Simple toast function
export function toast(options: { title?: string; description?: string; type?: 'success' | 'error' | 'warning' | 'info' } | string) {
  if (typeof options === 'string') {
    return { type: 'success' as const, message: options };
  }
  return options;
}

// Re-export sonner's toast
export { toast as sonnerToast } from 'sonner';

// useToast hook - just use the Toaster component
export function useToast() {
  return {};
}

// ToastProvider - uses sonner's Toaster
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return children;
}

// Viewport
export function ToastViewport() {
  return null;
}

// Toast components
export function Toast(props: any) {
  return props.children;
}

export function ToastClose(props: any) {
  return props.children;
}

export function ToastDescription(props: any) {
  return props.children;
}

export function ToastTitle(props: any) {
  return props.children;
}
