'use client';

import { ReactNode } from 'react';
import { ShopProvider } from './ShopContext';
import { ToastProvider } from '@/hooks/useToast';

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <ShopProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ShopProvider>
  );
}
