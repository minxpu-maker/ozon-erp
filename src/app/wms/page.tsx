'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getNavItems } from '@/lib/nav-config';
import { Warehouse, RefreshCw, Plus, Box } from 'lucide-react';

export default function WmsPage() {
  const pathname = usePathname();
  const navItems = getNavItems(pathname);
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
    <div className="min-h-screen bg-[#F6F8FB]">
      <header className="bg-white sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-[#E6EAF2]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center"><Warehouse className="w-4 h-4 text-white" /></div>
          <span className="font-semibold text-base text-[#152033]">Ozon ERP</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2F6BFF]/10 rounded-full flex items-center justify-center text-[#2F6BFF] font-medium text-sm">管</div>
            <span className="text-sm font-medium text-[#152033]">管理员</span>
          </div>
        </div>
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 3.5rem)' }}>
        <aside className="w-56 shrink-0 bg-white border-r border-[#E6EAF2] overflow-y-auto">
          <div className="p-3 space-y-0.5">
            {navItems.map((item, idx) => {
              if (item.type === 'divider') return <div key={idx} className="pt-3 pb-1"><span className="px-3 text-xs font-medium text-[#637089]/60 uppercase tracking-wider">{item.label}</span></div>;
              const Icon = item.icon!;
              return <Link key={item.href!} href={item.href!} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${item.active ? 'bg-[#2F6BFF]/10 text-[#2F6BFF]' : 'text-[#637089] hover:bg-[#EEF1F6] hover:text-[#152033]'}`}><Icon className="w-4 h-4" />{item.label}</Link>;
            })}
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto bg-[#F6F8FB] p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#152033]">仓库管理</h1>
            <p className="text-sm text-[#637089] mt-1">智能盘点 · 库位推荐 · 容量管理</p>
          </div>

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
        </main>
      </div>
    </div>
  );
}
