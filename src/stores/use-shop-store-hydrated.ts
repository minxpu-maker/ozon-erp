import { useEffect, useState } from 'react';
import { useShopStore } from './shop-store';

/**
 * Hook that handles zustand persist store hydration.
 * Prevents hydration mismatch by skipping SSR hydration and rehydrating client-side.
 */
export function useShopStoreHydrated() {
  const store = useShopStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Rehydrate from localStorage
    useShopStore.persist?.rehydrate?.();
    setHydrated(true);
  }, []);

  return { ...store, hydrated };
}
