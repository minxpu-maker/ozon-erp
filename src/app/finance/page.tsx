'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, ShoppingCart, Package, ClipboardList, Truck, Calculator, PackageSearch, Warehouse, Database, Users, BarChart3, UserCircle, Shield, Settings, RefreshCw, TrendingUp, TrendingDown, DollarSign, ChevronDown, ChevronUp, Receipt, Percent, Banknote, Tag, X, Check } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/purchase', icon: Package, label: '采购管理' },
  { href: '/quick-entry', icon: ClipboardList, label: '快捷录单' },
  { href: '/logistics', icon: Truck, label: '入库验货' },
  { href: '/packaging', icon: Package, label: '打包发货' },
  { href: '/finance', icon: Calculator, label: '利润核算', active: true },
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

export default function FinancePage() {
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [settledRecords, setSettledRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState(0.09);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [settlingOrderId, setSettlingOrderId] = useState<number | null>(null);
  const [apiStats, setApiStats] = useState<any>(null);

  useEffect(() => { 
    fetchExchangeRate();
    fetchData(); 
  }, []);

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch('/api/exchange-rate');
      const data = await res.json();
      if (data.success && data.data?.rate) {
        setExchangeRate(data.data.rate);
      }
    } catch (error) { console.error('获取汇率失败:', error); }
  };

  const fetchData = async () => {
    try {
      const res = await fetch('/api/finance');
      const data = await res.json();
      if (data.success) {
        setPendingOrders(data.data.pendingOrders || []);
        setSettledRecords(data.data.settledRecords || []);
        setApiStats(data.data.stats || null);
      }
    } catch (error) { console.error('获取数据失败:', error); }
    finally { setLoading(false); }
  };

  // 格式化人民币金额
  const formatCNY = (rub: string | number) => {
    const rubNum = typeof rub === 'string' ? parseFloat(rub) : rub;
    return (rubNum * exchangeRate).toFixed(2);
  };

  // 执行结算
  const handleSettle = async (orderId: number) => {
    if (!confirm('确认执行利润核算？')) return;
    setSettlingOrderId(orderId);
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`利润核算完成！净利润: ¥${formatCNY(data.data.netProfit)}`);
        fetchData();
      } else {
        alert('核算失败: ' + data.error);
      }
    } catch (error) {
      alert('核算失败');
    } finally {
      setSettlingOrderId(null);
    }
  };

  // 计算统计数据
  const stats = {
    totalOrders: pendingOrders.length,
    settledOrders: settledRecords.length,
    totalProfit: settledRecords.reduce((sum, r) => sum + parseFloat(r.net_profit || '0'), 0).toFixed(2),
    totalAmount: pendingOrders.reduce((sum, o) => sum + (o.financialData?.totalRevenue || parseFloat(o.total_price || '0')) * exchangeRate, 0).toFixed(2),
    totalCommission: apiStats?.totalCommission ? (apiStats.totalCommission * exchangeRate).toFixed(2) : pendingOrders.reduce((sum, o) => sum + (o.financialData?.totalCommission || 0) * exchangeRate, 0).toFixed(2),
  };

  // 状态颜色
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'awaiting_deliver': 'bg-yellow-100 text-yellow-700',
      'awaiting_packing': 'bg-blue-100 text-blue-700',
      'awaiting_shipment': 'bg-orange-100 text-orange-700',
      'shipped': 'bg-green-100 text-green-700',
      'delivered': 'bg-green-100 text-green-700',
      'cancelled': 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  // 状态文本
  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      'awaiting_deliver': '待采购',
      'awaiting_packing': '待打包',
      'awaiting_shipment': '待发货',
      'shipped': '已发货',
      'delivered': '已送达',
      'cancelled': '已取消',
    };
    return texts[status] || status;
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <header className="bg-white sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-[#E6EAF2]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center"><Calculator className="w-4 h-4 text-white" /></div>
          <span className="font-semibold text-base text-[#152033]">Ozon ERP</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-[#637089]">汇率: 1 RUB = {exchangeRate.toFixed(4)} CNY</div>
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
            <h1 className="text-2xl font-bold text-[#152033]">利润核算</h1>
            <p className="text-sm text-[#637089] mt-1">售后期结束后计算真实净利润 = Ozon结算金额 - 平台佣金 - 采购成本 - 运费 - 包材费 - 售后损失</p>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#637089]">待核算订单</span>
                <div className="w-8 h-8 bg-[#2F6BFF]/10 rounded-lg flex items-center justify-center"><Calculator className="w-4 h-4 text-[#2F6BFF]" /></div>
              </div>
              <div className="text-2xl font-bold text-[#152033]">{stats.totalOrders}<span className="text-sm font-normal text-[#637089] ml-1">笔</span></div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#637089]">累计佣金</span>
                <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center"><Percent className="w-4 h-4 text-orange-600" /></div>
              </div>
              <div className="text-2xl font-bold text-orange-600">¥{stats.totalCommission}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#637089]">已结算订单</span>
                <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-green-600" /></div>
              </div>
              <div className="text-2xl font-bold text-[#152033]">{stats.settledOrders}<span className="text-sm font-normal text-[#637089] ml-1">笔</span></div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#637089]">累计净利润</span>
                <div className="w-8 h-8 bg-[#2F6BFF]/10 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-[#2F6BFF]" /></div>
              </div>
              <div className="text-2xl font-bold text-green-600">¥{stats.totalProfit}</div>
            </div>
          </div>

          {/* 待核算订单 */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2] mb-6">
            <h3 className="text-base font-semibold text-[#152033] mb-4">待核算订单（售后期结束后可结算）</h3>
            {loading ? <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div> :
              pendingOrders.length === 0 ? <div className="text-center py-8 text-[#637089]">暂无待核算订单</div> :
              <div className="space-y-2">
                {pendingOrders.map((order) => {
                  const isExpanded = expandedOrder === order.ozon_order_id;
                  const fd = order.financialData;
                  
                  return (
                    <div key={order.id} className="border border-[#E6EAF2] rounded-lg overflow-hidden">
                      {/* 订单主行 */}
                      <div 
                        className="flex items-center px-4 py-3 bg-white hover:bg-[#F6F8FB] cursor-pointer"
                        onClick={() => setExpandedOrder(isExpanded ? null : order.ozon_order_id)}
                      >
                        <div className="flex-shrink-0 w-6">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-[#637089]" /> : <ChevronDown className="w-4 h-4 text-[#637089]" />}
                        </div>
                        <div className="flex-1 grid grid-cols-6 gap-4 items-center">
                          <div className="text-sm font-medium text-[#2F6BFF]">{order.ozon_order_id}</div>
                          <div className="text-sm text-[#152033]">{order.ozon_posting_number}</div>
                          <div className="text-sm text-[#152033]">{order.buyer_name || '-'}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#152033]">¥{fd ? formatCNY(fd.totalRevenue) : formatCNY(order.total_price)}</span>
                            {fd && fd.totalCommission > 0 && (
                              <span className="text-xs text-orange-600">(-佣金¥{formatCNY(fd.totalCommission)})</span>
                            )}
                          </div>
                          <div className="text-sm text-[#637089]">{order.shipped_at ? new Date(order.shipped_at).toLocaleDateString('zh-CN') : '-'}</div>
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => handleSettle(order.id)}
                              disabled={settlingOrderId === order.id}
                              className="text-xs bg-[#2F6BFF] text-white px-3 py-1 rounded hover:bg-[#2F6BFF]/90 disabled:opacity-50"
                            >
                              {settlingOrderId === order.id ? '核算中...' : '核算'}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* 展开的财务明细 */}
                      {isExpanded && fd && (
                        <div className="bg-[#F6F8FB] border-t border-[#E6EAF2] p-4">
                          <div className="grid grid-cols-2 gap-6 mb-4">
                            {/* 左侧：汇总信息 */}
                            <div>
                              <h4 className="text-sm font-semibold text-[#152033] mb-3 flex items-center gap-2">
                                <Receipt className="w-4 h-4" /> 财务汇总
                              </h4>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-[#637089]">客户实际支付</span>
                                  <span className="font-medium text-[#152033]">{fd.totalRevenue.toFixed(2)} RUB (¥{formatCNY(fd.totalRevenue)})</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-[#637089]">平台佣金</span>
                                  <span className="font-medium text-orange-600">-{fd.totalCommission.toFixed(2)} RUB (¥{formatCNY(fd.totalCommission)})</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-[#637089]">折扣金额</span>
                                  <span className="font-medium text-[#637089]">-{fd.totalDiscount.toFixed(2)} RUB (¥{formatCNY(fd.totalDiscount)})</span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-[#E6EAF2] pt-2">
                                  <span className="text-[#637089]">实际结算金额</span>
                                  <span className="font-semibold text-green-600">{fd.totalPayout.toFixed(2)} RUB (¥{formatCNY(fd.totalPayout)})</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* 右侧：商品明细 */}
                            <div>
                              <h4 className="text-sm font-semibold text-[#152033] mb-3 flex items-center gap-2">
                                <Tag className="w-4 h-4" /> 商品明细 ({fd.products.length}件)
                              </h4>
                              <div className="space-y-3 max-h-48 overflow-y-auto">
                                {fd.products.map((product: any, idx: number) => (
                                  <div key={idx} className="bg-white rounded-lg p-3 border border-[#E6EAF2]">
                                    <div className="text-sm font-medium text-[#152033] mb-2 line-clamp-1">{product.productName}</div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-[#637089]">数量</span>
                                        <span>{product.quantity}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-[#637089]">单价</span>
                                        <span>{product.price.toFixed(2)} RUB</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-[#637089]">客户支付</span>
                                        <span className="font-medium">{product.customerPrice.toFixed(2)} RUB</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-[#637089]">佣金</span>
                                        <span className="text-orange-600">{product.commissionAmount.toFixed(2)} RUB ({product.commissionPercent}%)</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-[#637089]">折扣</span>
                                        <span className="text-[#637089]">{product.totalDiscountValue.toFixed(2)} RUB</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-[#637089]">结算</span>
                                        <span className="text-green-600 font-medium">{product.payout.toFixed(2)} RUB</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* 无财务数据时的提示 */}
                      {isExpanded && !fd && (
                        <div className="bg-[#F6F8FB] border-t border-[#E6EAF2] p-4 text-center text-sm text-[#637089]">
                          暂无财务明细数据，请先同步订单
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>}
          </div>

          {/* 已结算记录 */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
            <h3 className="text-base font-semibold text-[#152033] mb-4">已结算记录</h3>
            {loading ? <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div> :
              settledRecords.length === 0 ? <div className="text-center py-8 text-[#637089]">暂无已结算记录</div> :
              <table className="w-full">
                <thead className="bg-[#F6F8FB]">
                  <tr>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">订单ID</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">结算金额</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">平台佣金</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">采购成本</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">运费</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">净利润</th>
                    <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">结算时间</th>
                  </tr>
                </thead>
                <tbody>
                  {settledRecords.map((record) => (
                    <tr key={record.id} className="border-t border-[#E6EAF2]">
                      <td className="px-4 py-3 text-sm font-medium text-[#2F6BFF]">{record.order_id}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">¥{record.ozon_settlement_amount || '0'}</td>
                      <td className="px-4 py-3 text-sm text-orange-600">¥{record.ozon_commission || '0'}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">¥{record.purchase_cost || '0'}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">¥{record.domestic_shipping_cost || '0'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">¥{record.net_profit || '0'}</td>
                      <td className="px-4 py-3 text-sm text-[#637089]">{record.settled_at ? new Date(record.settled_at).toLocaleDateString('zh-CN') : '-'}</td>
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
