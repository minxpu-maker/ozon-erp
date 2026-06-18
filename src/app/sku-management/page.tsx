'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Database, RefreshCw, Plus, Search, Box } from 'lucide-react';

export default function SkuManagementPage() {
  const [skus, setSkus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchSkus(); }, [search]);

  const fetchSkus = async () => {
    try {
      const params = search ? `?search=${search}` : '';
      const res = await fetch(`/api/sku-management${params}`);
      const data = await res.json();
      if (data.success) {
        const list = Array.isArray(data.data) ? data.data : (data.data?.skus || []);
        setSkus(list);
      }
    } catch (error) { console.error('获取SKU失败:', error); }
    finally { setLoading(false); }
  };

  return (
    <AppLayout title="SKU管理" subtitle="SKU主数据管理 · 货源映射 · 价格维护">
      {/* 工具栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-[#E6EAF2]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-4 h-4 text-[#637089]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索SKU编码或名称..."
              className="flex-1 text-sm text-[#152033] placeholder:text-[#637089]/50 outline-none"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#2F6BFF] text-white rounded-lg text-sm font-medium hover:bg-[#2F6BFF]/90">
            <Plus className="w-4 h-4" />新增SKU
          </button>
        </div>
      </div>

      {/* SKU列表 */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
        {loading ? (
          <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : skus.length === 0 ? (
          <div className="text-center py-8 text-[#637089]">暂无SKU数据</div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#F6F8FB]">
              <tr>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">SKU编码</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">名称</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">规格</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">单位</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">货源平台</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">货源价格</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {skus.map((sku) => (
                <tr key={sku.id} className="border-t border-[#E6EAF2]">
                  <td className="px-4 py-3 text-sm font-medium text-[#152033]">{sku.code}</td>
                  <td className="px-4 py-3 text-sm text-[#152033]">{sku.name}</td>
                  <td className="px-4 py-3 text-sm text-[#637089]">{sku.spec || '-'}</td>
                  <td className="px-4 py-3 text-sm text-[#152033]">{sku.unit}</td>
                  <td className="px-4 py-3 text-sm text-[#152033]">
                    {sku.sourceType === '1688' ? '1688' : sku.sourceType === 'pdd' ? '拼多多' : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#152033]">{sku.sourcePrice ? `¥${sku.sourcePrice}` : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${sku.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {sku.isActive ? '启用' : '停用'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
}
