import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ShopState {
  currentShopId: number | null;
  setShopId: (id: number | null) => void;
  clearShopId: () => void;
}

export const useShopStore = create<ShopState>()(
  persist(
    (set) => ({
      currentShopId: null,
      setShopId: (id) => set({ currentShopId: id }),
      clearShopId: () => set({ currentShopId: null }),
    }),
    {
      name: 'erp-current-shop',
    }
  )
);
