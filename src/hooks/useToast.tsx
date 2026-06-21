'use client';

import { toast as sonnerToast, Toaster } from 'sonner';

// Re-export Toaster for root providers
export { Toaster };

// Toast function with chainable methods
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

// Add chainable methods
toast.success = (message: string, options?: { duration?: number }) => {
  sonnerToast.success(message, { duration: options?.duration || 4000 });
};
toast.error = (message: string, options?: { duration?: number }) => {
  sonnerToast.error(message, { duration: options?.duration || 4000 });
};
toast.warning = (message: string, options?: { duration?: number }) => {
  sonnerToast.warning(message, { duration: options?.duration || 4000 });
};
toast.info = (message: string, options?: { duration?: number }) => {
  sonnerToast.info(message, { duration: options?.duration || 4000 });
};

// Legacy compatibility
export { sonnerToast };
export const useToast = () => ({ toast });
