'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Shield, RefreshCw, Plus, Edit, Trash2 } from 'lucide-react';

export default function RolesPage() {
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
    <AppLayout title="角色权限" subtitle="权限等级 · 菜单权限 · 功能权限">
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
    </AppLayout>
  );
}
