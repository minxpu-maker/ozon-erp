'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, ShoppingCart, Package, ClipboardList, Truck, Calculator, PackageSearch, Warehouse, Database, Users, BarChart3, UserCircle, Shield, Settings, RefreshCw, Scale, Printer, CheckCircle, FileText, AlertCircle } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/purchase', icon: Package, label: '采购管理' },
  { href: '/quick-entry', icon: ClipboardList, label: '快捷录单' },
  { href: '/logistics', icon: Truck, label: '入库验货' },
  { href: '/packaging', icon: Package, label: '打包发货', active: true },
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

export default function PackagingPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeight, setCurrentWeight] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printSuccess, setPrintSuccess] = useState(false);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/packaging');
      const data = await res.json();
      if (data.success) setOrders(data.data || []);
    } catch (error) { console.error('获取订单失败:', error); }
    finally { setLoading(false); }
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  // 切换单个订单选择
  const toggleSelect = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  // 打印面单
  const handlePrintLabel = async (orderIds?: string[]) => {
    const targetOrders = orderIds 
      ? orders.filter(o => orderIds.includes(o.id))
      : orders.filter(o => selectedOrders.has(o.id));

    if (targetOrders.length === 0) {
      setPrintError('请先选择要打印的订单');
      return;
    }

    setPrinting(true);
    setPrintError(null);
    setPrintSuccess(false);

    try {
      // 获取第一个订单的店铺ID（假设所有订单来自同一店铺）
      const shopId = targetOrders[0].shop_id;
      const postingNumbers = targetOrders.map(o => o.ozon_posting_number);

      const res = await fetch('/api/packaging/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postingNumbers,
          shopId,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || '获取面单失败');
      }

      // 获取面单PDF URL并打开新窗口打印
      const { fileUrl, printedPostingsCount } = data.data;
      
      if (!fileUrl) {
        throw new Error('未获取到面单下载链接');
      }

      // 打开新窗口加载PDF
      const printWindow = window.open(fileUrl, '_blank');
      if (printWindow) {
        // PDF会自动加载，浏览器提供打印选项
      }

      setPrintSuccess(true);
      setTimeout(() => setPrintSuccess(false), 3000);
    } catch (error: any) {
      console.error('打印面单失败:', error);
      setPrintError(error.message || '打印面单失败');
    } finally {
      setPrinting(false);
    }
  };

  // 单个订单打印
  const handleSinglePrint = (order: any) => {
    handlePrintLabel([order.id]);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <header className="bg-white sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-[#E6EAF2]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center"><Package className="w-4 h-4 text-white" /></div>
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
            <h1 className="text-2xl font-bold text-[#152033]">打包发货</h1>
            <p className="text-sm text-[#637089] mt-1">电子秤称重 → 打印Ozon面单 → 回传物流单号</p>
          </div>

          {/* 称重面板 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-[#E6EAF2]">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Scale className="w-8 h-8 text-[#2F6BFF]" />
                <div>
                  <div className="text-sm text-[#637089]">电子秤重量</div>
                  <div className="text-3xl font-bold text-[#152033]">{currentWeight || '0.00'} <span className="text-lg font-normal">kg</span></div>
                </div>
              </div>
              <input type="text" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)}
                placeholder="手动输入重量..."
                className="px-4 py-3 border border-[#E6EAF2] rounded-lg text-lg w-48 focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/30" />
            </div>
          </div>

          {/* 错误提示 */}
          {printError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">{printError}</span>
              <button onClick={() => setPrintError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
            </div>
          )}

          {/* 成功提示 */}
          {printSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-green-700">面单已生成，正在打开打印窗口...</span>
            </div>
          )}

          {/* 待打包列表 */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[#152033]">待打包订单</h3>
              <div className="flex items-center gap-2">
                {selectedOrders.size > 0 && (
                  <button 
                    onClick={() => handlePrintLabel()}
                    disabled={printing}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#2F6BFF] text-white rounded text-xs hover:bg-[#2F6BFF]/90 disabled:opacity-50">
                    <Printer className="w-3 h-3" />
                    {printing ? '生成中...' : `批量打印面单 (${selectedOrders.size})`}
                  </button>
                )}
              </div>
            </div>
            
            {loading ? <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div> :
              orders.length === 0 ? <div className="text-center py-8 text-[#637089]">暂无待打包订单</div> :
              <table className="w-full">
                <thead className="bg-[#F6F8FB]">
                  <tr>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3 w-10">
                      <input 
                        type="checkbox" 
                        checked={selectedOrders.size === orders.length}
                        onChange={toggleSelectAll}
                        className="rounded border-[#E6EAF2]"
                      />
                    </th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">订单号</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">发货单号</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">店铺</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">买家</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">金额</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((item) => (
                    <tr key={item.id} className="border-t border-[#E6EAF2] hover:bg-[#F6F8FB]">
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          checked={selectedOrders.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded border-[#E6EAF2]"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[#2F6BFF]">{item.ozon_order_id}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">{item.ozon_posting_number}</td>
                      <td className="px-4 py-3"><span className="px-2 py-1 bg-[#2F6BFF]/10 text-[#2F6BFF] rounded text-xs">TIANTAN</span></td>
                      <td className="px-4 py-3 text-sm text-[#152033]">{item.buyer_name}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">¥{(parseFloat(item.total_price || 0) * 0.08).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleSinglePrint(item)}
                            disabled={printing}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#2F6BFF] text-white rounded text-xs hover:bg-[#2F6BFF]/90 disabled:opacity-50">
                            <Printer className="w-3 h-3" />打印
                          </button>
                          <button className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded text-xs hover:bg-green-600">
                            <CheckCircle className="w-3 h-3" />确认发货
                          </button>
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
