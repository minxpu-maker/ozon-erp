'use client';

import { useEffect, useState } from 'react';
import { PackageSearch, RefreshCw, Plus, Search, Box } from 'lucide-react';

// 导航项已移除，使用 Sidebar.tsx 中的统一导航

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (data.success) {
        const list = Array.isArray(data.data) ? data.data : (data.data?.items || []);
        setItems(list);
      }
    } catch (error) { console.error('获取库存失败:', error); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#152033]">库存管理</h1>
            <p className="text-sm text-[#637089] mt-1">轻量化库存管理 · 热销产品备货建议</p>
          </div>

          {/* 工具栏 */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-[#E6EAF2]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-4 h-4 text-[#637089]" />
                <input type="text" placeholder="搜索SKU..." className="flex-1 text-sm text-[#152033] placeholder:text-[#637089]/50 outline-none" />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#2F6BFF] text-white rounded-lg text-sm font-medium hover:bg-[#2F6BFF]/90">
                <Plus className="w-4 h-4" />库存调整
              </button>
            </div>
          </div>

          {/* 库存列表 */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
            <h3 className="text-base font-semibold text-[#152033] mb-4">库存列表</h3>
            {loading ? <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div> :
              items.length === 0 ? <div className="text-center py-8 text-[#637089]">暂无库存数据</div> :
              <table className="w-full">
                <thead className="bg-[#F6F8FB]">
                  <tr>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">SKU编码</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">SKU名称</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">库存数量</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">库位</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.inventory.id} className="border-t border-[#E6EAF2]">
                      <td className="px-4 py-3 text-sm font-medium text-[#152033]">{item.sku?.code || '-'}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">{item.sku?.name || '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-[#152033]">{item.inventory.quantity}</td>
                      <td className="px-4 py-3 text-sm text-[#637089]">{item.inventory.locationId || '-'}</td>
                      <td className="px-4 py-3 text-sm text-[#637089]">{new Date(item.inventory.updatedAt).toLocaleDateString('zh-CN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>}
          </div>
        </div>
      );
    }
