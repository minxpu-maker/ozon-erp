'use client';

import { ReactNode } from 'react';
import { ShopProvider } from './ShopContext';
import { Toaster } from '@/hooks/useToast';
import { GlobalSyncProvider } from './GlobalSyncProvider';

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <GlobalSyncProvider>
      <ShopProvider>
        <Toaster 
          position="top-center"
          toastOptions={{
            style: {
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)',
              fontSize: '14px',
              fontWeight: '500',
              padding: '14px 20px',
              minWidth: '280px',
            },
            className: 'toast-animate',
          }}
        />
        {children}
      </ShopProvider>
    </GlobalSyncProvider>
  );
}
