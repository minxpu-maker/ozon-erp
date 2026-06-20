'use client';

import { useState, useEffect } from 'react';

const EXCHANGE_RATE_CACHE_KEY = 'ozon_exchange_rate';
const CACHE_DURATION = 60 * 60 * 1000; // 1小时

interface ExchangeRateCache {
  rate: number;
  timestamp: number;
}

interface UseExchangeRateResult {
  rate: number;
  loading: boolean;
  error: string | null;
  formatCNY: (rubAmount: number) => string;
}

export function useExchangeRate(): UseExchangeRateResult {
  const [rate, setRate] = useState<number>(0.078); // 默认汇率
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRate() {
      try {
        // 先检查 localStorage 缓存
        const cached = localStorage.getItem(EXCHANGE_RATE_CACHE_KEY);
        if (cached) {
          const cacheData: ExchangeRateCache = JSON.parse(cached);
          if (Date.now() - cacheData.timestamp < CACHE_DURATION) {
            setRate(cacheData.rate);
            setLoading(false);
            return;
          }
        }

        // 获取实时汇率
        const response = await fetch('/api/exchange-rate');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.rate) {
            setRate(data.rate);
            // 缓存到 localStorage
            localStorage.setItem(
              EXCHANGE_RATE_CACHE_KEY,
              JSON.stringify({ rate: data.rate, timestamp: Date.now() })
            );
          }
        }
      } catch (err) {
        console.error('[ExchangeRate] Fetch error:', err);
        setError('Failed to fetch exchange rate');
      } finally {
        setLoading(false);
      }
    }

    fetchRate();
  }, []);

  const formatCNY = (rubAmount: number): string => {
    const cny = rubAmount * rate;
    return `¥${cny.toFixed(2)}`;
  };

  return { rate, loading, error, formatCNY };
}

// 静态格式化函数（使用默认汇率，作为后备）
export function formatCNYFromRUBStatic(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '¥0.00';
  const cny = num * 0.078; // 默认汇率
  return `¥${cny.toFixed(2)}`;
}
