'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardList, Truck, Calculator,
  PackageSearch, Warehouse, Database, Users, BarChart3, UserCircle, Shield, Settings,
  RefreshCw, Clock, Link2, ShoppingBag, AlertTriangle, ChevronRight, CheckCircle, XCircle,
} from 'lucide-react';

interface QuickEntryTask {
  id: string;
  skuCode: string;
  quantity: number;
  ozonOrderId: string | null;
  postingNumber: string | null;
  sourceType: string | null;
}

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/orders', icon: ShoppingCart, label: '订单管理' },
  { href: '/purchase', icon: Package, label: '采购管理' },
  { href: '/quick-entry', icon: ClipboardList, label: '快捷录单', active: true },
  { href: '/logistics', icon: Truck, label: '入库验货' },
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

export default function QuickEntryPage() {
  const [tasks, setTasks] = useState<QuickEntryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryType, setEntryType] = useState<'paste' | 'ocr' | 'excel'>('paste');
  const [pasteData, setPasteData] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/quick-entry');
      const data = await res.json();
      if (data.success) setTasks(data.data.tasks);
    } catch (error) {
      console.error('获取任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasteSubmit = async () => {
    // 解析粘贴的数据：快递单号,采购金额,运费
    const lines = pasteData.split('\n').filter(Boolean);
    const entries = lines.map((line) => {
      const [trackingNumber, amount, shipping] = line.split(',');
      return { domesticTrackingNumber: trackingNumber, purchaseAmount: amount, shippingFee: shipping };
    });

    // TODO: 匹配任务并绑定
    console.log('Entries:', entries);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <header className="bg-white sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-[#E6EAF2]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-white" />
          </div>
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
              if (item.type === 'divider') {
                return <div key={idx} className="pt-3 pb-1"><span className="px-3 text-xs font-medium text-[#637089]/60 uppercase tracking-wider">{item.label}</span></div>;
              }
              const Icon = item.icon!;
              return (
                <Link key={item.href!} href={item.href!}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${item.active ? 'bg-[#2F6BFF]/10 text-[#2F6BFF]' : 'text-[#637089] hover:bg-[#EEF1F6] hover:text-[#152033]'}`}>
                  <Icon className="w-4 h-4" />{item.label}
                </Link>
              );
            })}
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto bg-[#F6F8FB] p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#152033]">快捷录单</h1>
            <p className="text-sm text-[#637089] mt-1">三种录入方式：单号粘贴 / 截图OCR / Excel批量导入</p>
          </div>

          {/* 录入方式选择 */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-[#E6EAF2]">
            <div className="flex items-center gap-4">
              {[
                { key: 'paste', label: '单号粘贴', icon: ClipboardList },
                { key: 'ocr', label: '截图OCR', icon: Link2 },
                { key: 'excel', label: 'Excel导入', icon: Database },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.key}
                    onClick={() => setEntryType(item.key as typeof entryType)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${entryType === item.key ? 'bg-[#2F6BFF] text-white' : 'bg-[#EEF1F6] text-[#637089] hover:bg-[#E6EAF2]'}`}>
                    <Icon className="w-4 h-4" />{item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 单号粘贴录入 */}
          {entryType === 'paste' && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-[#E6EAF2]">
              <h3 className="text-base font-semibold text-[#152033] mb-4">粘贴采购信息</h3>
              <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-lg p-4 mb-4">
                <p className="text-sm text-[#637089]">格式：快递单号,采购金额,运费（每行一条）</p>
                <p className="text-xs text-[#637089]/70 mt-1">示例：SF1234567890,25.50,5.00</p>
              </div>
              <textarea value={pasteData} onChange={(e) => setPasteData(e.target.value)}
                placeholder="粘贴采购信息..."
                className="w-full h-40 p-4 border border-[#E6EAF2] rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/30" />
              <div className="flex justify-end mt-4">
                <button onClick={handlePasteSubmit}
                  className="px-4 py-2 bg-[#2F6BFF] text-white rounded-lg text-sm font-medium hover:bg-[#2F6BFF]/90">
                  批量绑定
                </button>
              </div>
            </div>
          )}

          {/* 待绑定任务列表 */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
            <h3 className="text-base font-semibold text-[#152033] mb-4">待绑定采购任务</h3>
            {loading ? (
              <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8 text-[#637089]">暂无待绑定任务</div>
            ) : (
              <table className="w-full">
                <thead className="bg-[#F6F8FB]">
                  <tr>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">SKU编码</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">数量</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">关联订单</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">货源平台</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-t border-[#E6EAF2]">
                      <td className="px-4 py-3 text-sm font-medium text-[#152033]">{task.skuCode}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">{task.quantity}</td>
                      <td className="px-4 py-3 text-sm text-[#2F6BFF]">{task.ozonOrderId || '-'}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">{task.sourceType || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
