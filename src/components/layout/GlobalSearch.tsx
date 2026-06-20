'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { cn } from '@/lib/utils';
import type { OrderRecord } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface SearchResult {
  type: 'order';
  id: string;
  main: string;
  sub: string;
  price?: string;
  status?: string;
}

export function GlobalSearchTrigger({ 
  onClick 
}: { 
  onClick?: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 h-10 px-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 hover:border-gray-300 transition-colors w-[400px]"
    >
      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span className="text-sm text-gray-400 flex-1 text-left">全局搜索...</span>
      <kbd className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 bg-white border border-gray-200 rounded">
        <span className="text-[10px]">⌘</span>K
      </kbd>
    </button>
  );
}

export function GlobalSearchModal({ 
  open, 
  onClose 
}: { 
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 全局 Cmd+K / Ctrl+K 监听
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!open) {
          // 触发打开 - 通过自定义事件通知
          window.dispatchEvent(new CustomEvent('open-global-search'));
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 打开时聚焦输入框并清理状态
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setKeyword('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // 搜索订单（debounce 300ms，最少2个字符）
  const { data } = useSWR(
    keyword.length >= 2
      ? `/api/orders?pageSize=20&keyword=${encodeURIComponent(keyword)}`
      : null,
    fetcher
  );

  // 处理搜索结果
  useEffect(() => {
    if (data?.orders) {
      const searchResults: SearchResult[] = data.orders.map((order: OrderRecord) => ({
        type: 'order',
        id: order.ozonPostingNumber || order.id,
        main: order.ozonPostingNumber || order.id,
        sub: order.products?.[0]?.name || '商品',
        price: order.products?.[0]?.price ? `₽${order.products[0].price.toLocaleString('ru-RU')}` : undefined,
        status: order.erpStatus,
      }));
      setResults(searchResults);
      setSelectedIndex(0);
    } else {
      setResults([]);
    }
  }, [data]);

  // 方向键导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  }, [results, selectedIndex]);

  const handleSelect = (result: SearchResult) => {
    router.push(`/orders/list?search=${encodeURIComponent(keyword)}`);
    onClose();
    setKeyword('');
    setResults([]);
  };

  const handleClose = () => {
    onClose();
    setKeyword('');
    setResults([]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/30" 
        onClick={handleClose}
      />
      
      {/* 弹窗 */}
      <div className="relative w-[600px] bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        {/* 搜索输入框 */}
        <div className="flex items-center w-full px-4 py-3 border-b border-gray-100">
          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索订单号、SKU、商品名..."
            className="flex-1 px-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
          <button
            onClick={handleClose}
            className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            Esc
          </button>
        </div>

        {/* 结果列表 */}
        <div className="max-h-[400px] overflow-y-auto">
          {keyword.length < 2 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              请输入至少2个字符进行搜索
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              没有找到匹配的订单
            </div>
          ) : (
            results.map((result, index) => (
              <div
                key={result.id}
                onClick={() => handleSelect(result)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                  index === selectedIndex ? "bg-blue-50" : "hover:bg-gray-50"
                )}
              >
                <span className="text-xl flex-shrink-0">📦</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{result.main}</div>
                  <div className="text-sm text-gray-500 truncate">{result.sub}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {result.price && (
                    <span className="text-sm text-gray-600">{result.price}</span>
                  )}
                  {result.status && (
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded",
                      result.status === 'pending_purchase' ? 'bg-blue-50 text-blue-600' :
                      result.status === 'pending_packaging' ? 'bg-amber-50 text-amber-600' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      {result.status === 'pending_purchase' ? '待采购' :
                       result.status === 'pending_packaging' ? '等待备货' :
                       result.status}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded">↑</kbd>
            <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded">↓</kbd>
            导航
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded">↵</kbd>
            选择
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded">Esc</kbd>
            关闭
          </span>
        </div>
      </div>
    </div>
  );
}
