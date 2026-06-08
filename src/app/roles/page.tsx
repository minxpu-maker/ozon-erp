'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getNavItems } from '@/lib/nav-config';
import { Shield, RefreshCw, Plus, Edit, Trash2, Box } from 'lucide-react';

export default function RolesPage() {
  const pathname = usePathname();
  const navItems = getNavItems(pathname);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchRoles(); }, []);

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      if (data.success) {
        const list = Array.isArray(data.data) ? data.data : (data.data?.roles || []);
        setRoles(list);
      }
    } catch (error) { console.error('获取角色失败:', error); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <header className="bg-white sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-[#E6EAF2]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center"><Shield className="w-4 h-4 text-white" /></div>
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
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#152033]">角色权限</h1>
              <p className="text-sm text-[#637089] mt-1">权限等级 · 菜单权限 · 功能权限</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#2F6BFF] text-white rounded-lg text-sm font-medium hover:bg-[#2F6BFF]/90">
              <Plus className="w-4 h-4" />新增角色
            </button>
          </div>

          {/* 角色列表 */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
            {loading ? <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div> :
              roles.length === 0 ? <div className="text-center py-8 text-[#637089]">暂无角色数据</div> :
              <table className="w-full">
                <thead className="bg-[#F6F8FB]">
                  <tr>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">角色名称</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">角色标识</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">权限等级</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">成员数</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">描述</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id} className="border-t border-[#E6EAF2]">
                      <td className="px-4 py-3 text-sm font-medium text-[#152033]">{role.name}</td>
                      <td className="px-4 py-3 text-sm text-[#637089]">{role.code}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${role.level === 1 ? 'bg-red-100 text-red-700' : role.level === 2 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          Lv.{role.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#152033]">{role.memberCount || 0}</td>
                      <td className="px-4 py-3 text-sm text-[#637089]">{role.description || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 text-[#637089] hover:text-[#2F6BFF] hover:bg-[#2F6BFF]/10 rounded"><Edit className="w-4 h-4" /></button>
                          <button className="p-1.5 text-[#637089] hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                        </div>
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
