'use client';

import { useShopStore } from '@/stores/shop-store';

/**
 * 店铺筛选hook
 * 从shopStore读取currentShopId，提供统一的方式获取店铺筛选参数
 */
export function useShopFilter() {
  const currentShopId = useShopStore((state) => state.currentShopId);

  /**
   * 获取店铺筛选参数对象
   * @returns shopId参数对象，如果没有选择店铺则返回空对象
   */
  const getShopParam = (): { shopId?: number } => {
    return currentShopId ? { shopId: currentShopId } : {};
  };

  /**
   * 获取店铺筛选URL参数字符串
   * @param baseUrl 基础URL
   * @returns 带店铺参数的URL
   */
  const getShopUrl = (baseUrl: string): string => {
    if (!currentShopId) return baseUrl;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}shopId=${currentShopId}`;
  };

  return {
    currentShopId,
    getShopParam,
    getShopUrl,
  };
}
