'use client';

import { ReactNode } from 'react';
import { ShopProvider } from './ShopContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return <ShopProvider>{children}</ShopProvider>;
}
