'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, ShoppingCart, Package, ClipboardList, Truck, Calculator, PackageSearch, Warehouse, Database, Users, BarChart3, UserCircle, Shield, Settings, RefreshCw, Search, ScanLine, CheckCircle, XCircle } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/orders', icon: ShoppingCart, label: '订单管理' },
  { href: '/purchase', icon: Package, label: '采购管理' },
  { href: '/quick-entry', icon: ClipboardList, label: '快捷录单' },
  { href: '/logistics', icon: Truck, label: '入库验货', active: true },
  { href: '/packaging', icon: Package, label: '打包发货' },
  { href: '/finance', icon: Calculator, label: '利润核算' },
  { type: 'divider', label: '库存管理' },
  { href: '/inventory', icon: PackageSearch, label: '库存管理' },
  { href: '/wms', icon: Warehouse, label: '仓库管理' },
  { type: 'divider', label: '数据中心' },
  { href: '/sku-management', icon: Database, label: 'SKU管理' },
  { href: '/suppliers', icon: Users, label: '供应商管理' },
  { href: '/reports', icon: BarChart3, label: '数据报表' },
  { type: 'divider', label: '系统' },
  { href: '/accounts', icon: UserCircle, label: '账号管理' },
  { href: '/roles', icon: Shield, label: '角色权限' },
  { href: '/settings', icon: Settings, label: '系统设置' },
];

export default function LogisticsPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [currentTask, setCurrentTask] = useState<any>(null);

  useEffect(() => { fetchTasks(); }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/logistics');
      const data = await res.json();
      if (data.success) {
        const taskList = Array.isArray(data.data) ? data.data : (data.data?.tasks || []);
        setTasks(taskList);
      }
    } catch (error) { console.error('获取任务失败:', error); }
    finally { setLoading(false); }
  };

  const handleScan = async () => {
    if (!trackingNumber) return;
    try {
      const res = await fetch(`/api/logistics?tracking_number=${trackingNumber}`);
      const data = await res.json();
      if (data.success) setCurrentTask(data.data);
    } catch (error) { console.error('扫描失败:', error); }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <header className="bg-white sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-[#E6EAF2]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center"><Truck className="w-4 h-4 text-white" /></div>
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
            <h1 className="text-2xl font-bold text-[#152033]">入库验货</h1>
            <p className="text-sm text-[#637089] mt-1">扫描枪扫描快递单号 → 毫秒级响应 → 验货/异常处理</p>
          </div>

          {/* 扫描输入 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-[#E6EAF2]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <ScanLine className="w-5 h-5 text-[#2F6BFF]" />
                <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                  placeholder="扫描快递单号或手动输入..."
                  className="flex-1 text-lg text-[#152033] placeholder:text-[#637089]/50 outline-none" autoFocus />
              </div>
              <button onClick={handleScan}
                className="px-6 py-3 bg-[#2F6BFF] text-white rounded-lg font-medium hover:bg-[#2F6BFF]/90">
                扫描查询
              </button>
            </div>
          </div>

          {/* 当前扫描结果 */}
          {currentTask && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-[#E6EAF2]">
              <h3 className="text-base font-semibold text-[#152033] mb-4">扫描结果</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div><span className="text-sm text-[#637089]">快递单号</span><div className="text-base font-medium text-[#152033]">{currentTask.task?.domesticTrackingNumber}</div></div>
                <div><span className="text-sm text-[#637089]">SKU编码</span><div className="text-base font-medium text-[#152033]">{currentTask.task?.skuCode}</div></div>
                <div><span className="text-sm text-[#637089]">数量</span><div className="text-base font-medium text-[#152033]">{currentTask.task?.quantity}</div></div>
              </div>
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600">
                  <CheckCircle className="w-4 h-4" />验货通过
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600">
                  <XCircle className="w-4 h-4" />验货异常
                </button>
              </div>
            </div>
          )}

          {/* 待验货列表 */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
            <h3 className="text-base font-semibold text-[#152033] mb-4">待验货列表</h3>
            {loading ? <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div> :
              tasks.length === 0 ? <div className="text-center py-8 text-[#637089]">暂无待验货任务</div> :
              <table className="w-full">
                <thead className="bg-[#F6F8FB]">
                  <tr>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">快递单号</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">SKU编码</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">关联订单</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-t border-[#E6EAF2]">
                      <td className="px-4 py-3 text-sm font-medium text-[#2F6BFF]">{task.domesticTrackingNumber}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">{task.skuCode}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">{task.orderId}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setTrackingNumber(task.domesticTrackingNumber); handleScan(); }}
                          className="px-3 py-1 text-xs bg-[#2F6BFF]/10 text-[#2F6BFF] rounded hover:bg-[#2F6BFF]/20">验货</button>
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
