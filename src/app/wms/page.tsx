'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Warehouse, RefreshCw, Plus } from 'lucide-react';

export default function WmsPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLocations(); }, []);

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/wms');
      const data = await res.json();
      if (data.success) {
        const list = Array.isArray(data.data) ? data.data : (data.data?.locations || []);
        setLocations(list);
      }
    } catch (error) { console.error('获取库位失败:', error); }
    finally { setLoading(false); }
  };

  return (
    <AppLayout title="仓库管理" subtitle="智能盘点 · 库位推荐 · 容量管理">
      {/* 工具栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-[#E6EAF2]">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[#637089]">共 {locations.length} 个库位</div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#2F6BFF] text-white rounded-lg text-sm font-medium hover:bg-[#2F6BFF]/90">
            <Plus className="w-4 h-4" />新增库位
          </button>
        </div>
      </div>

      {/* 库位列表 */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
        <h3 className="text-base font-semibold text-[#152033] mb-4">库位列表</h3>
        {loading ? <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div> :
          locations.length === 0 ? <div className="text-center py-8 text-[#637089]">暂无库位数据</div> :
          <table className="w-full">
            <thead className="bg-[#F6F8FB]">
              <tr>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">库位编码</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">名称</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">区域</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">容量</th>
                <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id} className="border-t border-[#E6EAF2]">
                  <td className="px-4 py-3 text-sm font-medium text-[#152033]">{loc.code}</td>
                  <td className="px-4 py-3 text-sm text-[#152033]">{loc.name}</td>
                  <td className="px-4 py-3 text-sm text-[#637089]">{loc.zone || '-'}</td>
                  <td className="px-4 py-3 text-sm text-[#152033]">{loc.capacity}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${loc.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {loc.status === 'active' ? '正常' : '停用'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>}
      </div>
    </AppLayout>
  );
}
