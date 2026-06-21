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
  refreshShops: () => Promise<void>; // 刷新店铺列表
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
  const loadShops = async () => {
    try {
      const data = await fetcher('/api/shops');
      let shopList: Shop[] = [];
      
      // API返回的是 { success, shops: [{ id, shopName, ... }] }
      // 需要映射 shopName -> name
      const rawShops = data?.shops || data?.data || data || [];
      if (Array.isArray(rawShops) && rawShops.length > 0) {
        shopList = rawShops.map((s: any) => ({
          id: s.id,
          name: s.shopName || s.name || s.shop_name || '',
          code: s.code
        }));
      }
      
      if (shopList.length > 0) {
        setShops(shopList);
        setError(false);
        
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
  };

  useEffect(() => {
    loadShops();
  }, [zustandShopId, setZustandShopId]);

  // 刷新店铺列表（供外部调用）
  const refreshShops = async () => {
    setLoading(true);
    await loadShops();
  };

  const setCurrentShop = (shop: Shop) => {
    setCurrentShopState(shop);
    setZustandShopId(shop.id);
  };

  return (
    <ShopContext.Provider value={{ currentShop, setCurrentShop, shops, loading, error, refreshShops }}>
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
