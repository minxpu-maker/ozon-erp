'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useShopStore } from '@/stores/shop-store';

export interface Shop {
  id: string;
  name: string;
  code?: string; // 店铺标识后缀
}

interface ShopContextType {
  currentShop: Shop | null;
  setCurrentShop: (shop: Shop) => void;
  shops: Shop[];
  loading: boolean;
  error: boolean;
}

const ShopContext = createContext<ShopContextType | null>(null);

const fetcher = (url: string) => fetch(url).then(async (r) => {
  if (!r.ok) throw new Error('请求失败');
  return r.json();
});

export function ShopProvider({ children }: { children: ReactNode }) {
  // 同步 zustand store
  const zustandShopId = useShopStore(state => state.currentShopId);
  const setZustandShopId = useShopStore(state => state.setShopId);
  
  const [currentShop, setCurrentShopState] = useState<Shop | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 加载店铺列表
  useEffect(() => {
    async function loadShops() {
      try {
        const data = await fetcher('/api/shops');
        let shopList: Shop[] = [];
        
        if (Array.isArray(data) && data.length > 0) {
          shopList = data;
        } else if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
          shopList = data.data;
        } else if (data?.shops && Array.isArray(data.shops) && data.shops.length > 0) {
          shopList = data.shops;
        }
        
        if (shopList.length > 0) {
          setShops(shopList);
          
          // 如果 zustand store 有值，查找对应店铺
          if (zustandShopId) {
            const found = shopList.find(s => s.id === zustandShopId);
            if (found) {
              setCurrentShopState(found);
            } else {
              // store 中的店铺不存在了，重置
              setZustandShopId(shopList[0].id);
              setCurrentShopState(shopList[0]);
            }
          } else {
            // 默认选择第一个
            setCurrentShopState(shopList[0]);
            setZustandShopId(shopList[0].id);
          }
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadShops();
  }, [zustandShopId, setZustandShopId]);

  const setCurrentShop = (shop: Shop) => {
    setCurrentShopState(shop);
    setZustandShopId(shop.id);
  };

  return (
    <ShopContext.Provider value={{ currentShop, setCurrentShop, shops, loading, error }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within ShopProvider');
  }
  return context;
}
