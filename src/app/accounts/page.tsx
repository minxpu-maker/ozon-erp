'use client';

import { useEffect, useState } from 'react';
import { UserCircle, RefreshCw, Plus, Edit, Trash2, Box } from 'lucide-react';

// 导航项已移除，使用 Sidebar.tsx 中的统一导航

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      if (data.success) {
        const list = Array.isArray(data.data) ? data.data : (data.data?.accounts || []);
        setAccounts(list);
      }
    } catch (error) { console.error('获取账号失败:', error); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#152033]">账号管理</h1>
              <p className="text-sm text-[#637089] mt-1">子账号管理 · 角色分配 · 权限控制</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#2F6BFF] text-white rounded-lg text-sm font-medium hover:bg-[#2F6BFF]/90">
              <Plus className="w-4 h-4" />新增账号
            </button>
          </div>

          {/* 账号列表 */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
            {loading ? <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div> :
              accounts.length === 0 ? <div className="text-center py-8 text-[#637089]">暂无账号数据</div> :
              <table className="w-full">
                <thead className="bg-[#F6F8FB]">
                  <tr>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">账号</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">姓名</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">角色</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">状态</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">最后登录</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="border-t border-[#E6EAF2]">
                      <td className="px-4 py-3 text-sm font-medium text-[#152033]">{acc.username}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">{acc.displayName || '-'}</td>
                      <td className="px-4 py-3"><span className="px-2 py-1 bg-[#2F6BFF]/10 text-[#2F6BFF] rounded text-xs">{acc.role?.name || '-'}</span></td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${acc.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {acc.isActive ? '正常' : '停用'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#637089]">{acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleDateString('zh-CN') : '-'}</td>
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
        </div>
      );
    }
