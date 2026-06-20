'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Package, Search, X } from 'lucide-react';
import { formatRUB } from '@/lib/utils';
import { OrderRecord } from '@/components/orders/OrderCard';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface SearchResult {
  type: 'order';
  id: string;
  main: string;
  sub: string;
  price?: string;
  status?: string;
}

export function GlobalSearchModal() {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 键盘快捷键 Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setKeyword('');
        setResults([]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // 打开时聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // 搜索订单
  const { data } = useSWR(
    keyword.length >= 2
      ? `/api/orders?pageSize=50&keyword=${encodeURIComponent(keyword)}`
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
        price: order.products?.[0]?.price ? formatRUB(order.products[0].price) : undefined,
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
    setOpen(false);
    setKeyword('');
    setResults([]);
  };

  const handleClose = () => {
    setOpen(false);
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
      <div className="relative w-[600px] bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* 搜索输入框 */}
        <div className="flex items-center px-4 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索订单号、SKU、商品名…"
            className="flex-1 h-12 px-3 text-sm outline-none placeholder:text-gray-400"
          />
          {keyword && (
            <button
              onClick={() => setKeyword('')}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* 搜索结果 */}
        {keyword.length >= 2 && (
          <div className="max-h-[300px] overflow-y-auto">
            {results.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                未找到匹配 &ldquo;{keyword}&rdquo; 的结果
              </div>
            ) : (
              <div className="py-2">
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      index === selectedIndex ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Package className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">
                        {result.main}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {result.sub}
                      </div>
                    </div>
                    {result.price && (
                      <div className="text-sm text-gray-600">
                        {result.price}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 底部提示 */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <span>↑↓ 导航</span>
            <span>↵ 选中</span>
            <span>Esc 关闭</span>
          </div>
          <span>{results.length} 个结果</span>
        </div>
      </div>
    </div>
  );
}

// 触发搜索按钮组件
export function GlobalSearchTrigger() {
  const [open, setOpen] = useState(false);

  // 监听自定义事件
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-global-search', handler);
    return () => window.removeEventListener('open-global-search', handler);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-80 h-9 flex items-center gap-2 px-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
      >
        <Search className="w-4 h-4 text-gray-400" />
        <span className="flex-1 text-sm text-gray-400 text-left">全局搜索…</span>
        <span className="px-1.5 py-0.5 text-xs bg-white border rounded">
          {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K'}
        </span>
      </button>
      {open && (
        <GlobalSearchModal />
      )}
    </>
  );
}
