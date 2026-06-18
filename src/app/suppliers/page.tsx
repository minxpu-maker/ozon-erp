'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Users, RefreshCw, Plus, Phone, Mail } from 'lucide-react';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSuppliers(); }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      if (data.success) {
        const list = Array.isArray(data.data) ? data.data : (data.data?.suppliers || []);
        setSuppliers(list);
      }
    } catch (error) { console.error('获取供应商失败:', error); }
    finally { setLoading(false); }
  };

  return (
    <AppLayout title="供应商管理" subtitle="供应商档案 · 采购历史 · 合作评级">
      <div className="flex items-center justify-between mb-6">
        <div />
        <button className="flex items-center gap-2 px-4 py-2 bg-[#2F6BFF] text-white rounded-lg text-sm font-medium hover:bg-[#2F6BFF]/90">
          <Plus className="w-4 h-4" />新增供应商
        </button>
      </div>

      {/* 供应商列表 */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
        {loading ? (
          <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-8 text-[#637089]">暂无供应商数据</div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#F6F8FB]">
              <tr>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">供应商名称</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">平台</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">联系人</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">联系电话</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">评级</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-t border-[#E6EAF2]">
                  <td className="px-4 py-3 text-sm font-medium text-[#152033]">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-[#2F6BFF]/10 text-[#2F6BFF] rounded text-xs">{s.platform || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#152033]">{s.contactName || '-'}</td>
                  <td className="px-4 py-3 text-sm text-[#637089]">{s.contactPhone || '-'}</td>
                  <td className="px-4 py-3 text-sm text-amber-600">
                    {s.rating ? `${'★'.repeat(s.rating)}${'☆'.repeat(5 - s.rating)}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.isActive ? '合作中' : '已停用'}
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
