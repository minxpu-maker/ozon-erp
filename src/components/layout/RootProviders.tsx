'use client';

import { ReactNode } from 'react';
import { ShopProvider } from './ShopContext';

export function RootProviders({ children }: { children: ReactNode }) {
  return <ShopProvider>{children}</ShopProvider>;
}
