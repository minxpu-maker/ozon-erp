'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, ShoppingCart, Package, ClipboardList, Truck, Calculator, PackageSearch, Warehouse, Database, Users, BarChart3, UserCircle, Shield, Settings, RefreshCw, Plus, Search } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/purchase', icon: Package, label: '采购管理' },
  { href: '/quick-entry', icon: ClipboardList, label: '快捷录单' },
  { href: '/logistics', icon: Truck, label: '入库验货' },
  { href: '/packaging', icon: Package, label: '打包发货' },
  { href: '/finance', icon: Calculator, label: '利润核算' },
  { type: 'divider', label: '库存管理' },
  { href: '/inventory', icon: PackageSearch, label: '库存管理' },
  { href: '/wms', icon: Warehouse, label: '仓库管理' },
  { type: 'divider', label: '数据中心' },
  { href: '/sku-management', icon: Database, label: 'SKU管理', active: true },
  { href: '/suppliers', icon: Users, label: '供应商管理' },
  { href: '/reports', icon: BarChart3, label: '数据报表' },
  { type: 'divider', label: '系统' },
  { href: '/accounts', icon: UserCircle, label: '账号管理' },
  { href: '/roles', icon: Shield, label: '角色权限' },
  { href: '/settings', icon: Settings, label: '系统设置' },
];

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
    <div className="min-h-screen bg-[#F6F8FB]">
      <header className="bg-white sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-[#E6EAF2]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center"><Database className="w-4 h-4 text-white" /></div>
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
            <h1 className="text-2xl font-bold text-[#152033]">SKU管理</h1>
            <p className="text-sm text-[#637089] mt-1">SKU主数据管理 · 货源映射 · 价格维护</p>
          </div>

          {/* 工具栏 */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-[#E6EAF2]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-4 h-4 text-[#637089]" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索SKU编码或名称..." className="flex-1 text-sm text-[#152033] placeholder:text-[#637089]/50 outline-none" />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#2F6BFF] text-white rounded-lg text-sm font-medium hover:bg-[#2F6BFF]/90">
                <Plus className="w-4 h-4" />新增SKU
              </button>
            </div>
          </div>

          {/* SKU列表 */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
            {loading ? <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div> :
              skus.length === 0 ? <div className="text-center py-8 text-[#637089]">暂无SKU数据</div> :
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
                      <td className="px-4 py-3 text-sm text-[#152033]">{sku.sourceType === '1688' ? '1688' : sku.sourceType === 'pdd' ? '拼多多' : '-'}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">{sku.sourcePrice ? `¥${sku.sourcePrice}` : '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${sku.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {sku.isActive ? '启用' : '停用'}
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
