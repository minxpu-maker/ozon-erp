'use client';
import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Truck, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// 格式化人民币金额
const formatCNY = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '¥0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '¥0.00';
  return `¥${num.toFixed(2)}`;
};

export default function FreightReconcilePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unchecked' | 'diff'>('unchecked');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [editFreight, setEditFreight] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchFreightRecords();
  }, []);

  const fetchFreightRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/freight');
      const data = await res.json();
      setRecords(data.records || []);
    } catch (error) {
      console.error('获取运费记录失败:', error);
      setRecords([]);
    }
    setLoading(false);
  };

  // 统计
  const uncheckedCount = records.filter(r => !r.reconciled).length;
  const diffCount = records.filter(r => {
    const diff = Math.abs(parseFloat(r.estimatedFreight || 0) - parseFloat(r.actualFreight || 0));
    const base = parseFloat(r.estimatedFreight || 1);
    return diff / base > 0.05;
  }).length;
  const totalDiff = records.reduce((sum, r) => {
    return sum + (parseFloat(r.actualFreight || 0) - parseFloat(r.estimatedFreight || 0));
  }, 0);

  // 筛选
  const filtered = records.filter(r => {
    if (filterStatus === 'unchecked') return !r.reconciled;
    if (filterStatus === 'diff') {
      const diff = Math.abs(parseFloat(r.estimatedFreight || 0) - parseFloat(r.actualFreight || 0));
      const base = parseFloat(r.estimatedFreight || 1);
      return diff / base > 0.05;
    }
    return true;
  });

  // 计算单行差异
  const getDiff = (r: any) => {
    const est = parseFloat(r.estimatedFreight) || 0;
    const act = parseFloat(r.actualFreight) || 0;
    return act - est;
  };

  // 是否差异大于5%
  const isDiffHigh = (r: any) => {
    const diff = Math.abs(getDiff(r));
    const base = parseFloat(r.estimatedFreight) || 1;
    return diff / base > 0.05;
  };

  // 更新实际运费
  const handleUpdateFreight = async (id: number) => {
    const freight = editFreight[id];
    if (!freight) return;
    setUpdatingId(id);
    try {
      await fetch(`/api/finance/freight/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualFreight: parseFloat(freight) }),
      });
      setEditFreight(prev => { const next = { ...prev }; delete next[id]; return next; });
      fetchFreightRecords();
    } catch (error) {
      console.error('更新运费失败:', error);
    }
    setUpdatingId(null);
  };

  // 标记已核对
  const handleReconcile = async (id: number) => {
    setUpdatingId(id);
    try {
      await fetch(`/api/finance/freight/${id}/reconcile`, {
        method: 'POST',
      });
      fetchFreightRecords();
    } catch (error) {
      console.error('标记核对失败:', error);
    }
    setUpdatingId(null);
  };

  return (
    <AppLayout title="运费核对" subtitle="对比预估运费与实际运费差异，逐笔核对">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#152033]">运费核对</h1>
        <p className="text-sm text-[#637089] mt-1">对比预估运费与实际运费差异，逐笔核对确认</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#637089]">未核对</span>
            <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center"><Clock className="w-4 h-4 text-orange-600" /></div>
          </div>
          <div className="text-2xl font-bold text-[#152033]">{uncheckedCount}<span className="text-sm font-normal text-[#637089] ml-1">笔</span></div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#637089]">差异 &gt;5%</span>
            <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
          </div>
          <div className="text-2xl font-bold text-red-600">{diffCount}<span className="text-sm font-normal text-[#637089] ml-1">笔</span></div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#637089]">累计差异</span>
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center"><Truck className="w-4 h-4 text-blue-600" /></div>
          </div>
          <div className={`text-2xl font-bold ${totalDiff >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCNY(totalDiff)}
          </div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2] mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#637089] mr-2">筛选：</span>
          {[
            { key: 'unchecked', label: '未核对' },
            { key: 'diff', label: '差异>5%' },
            { key: 'all', label: '全部' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key as any)}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                filterStatus === f.key
                  ? 'bg-[#2F6BFF] text-white'
                  : 'bg-gray-100 text-[#637089] hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={fetchFreightRecords} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-lg shadow-sm border border-[#E6EAF2]">
        {loading ? (
          <div className="text-center py-16 text-[#637089]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#637089]">暂无运费记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F6F8FB]">
                <tr>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">订单号</th>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">快递单号</th>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">预估运费</th>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">实际运费</th>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">差异</th>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">状态</th>
                  <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const diff = getDiff(r);
                  const diffHigh = isDiffHigh(r);
                  const hasActual = r.actualFreight !== null && r.actualFreight !== undefined && r.actualFreight !== '';

                  return (
                    <tr key={r.id} className="border-t border-[#E6EAF2] hover:bg-[#F6F8FB]/50">
                      <td className="px-4 py-3 text-sm font-medium text-[#2F6BFF]">{r.orderId || r.order_id || '-'}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">{r.trackingNo || r.tracking_no || '-'}</td>
                      <td className="px-4 py-3 text-sm text-[#152033]">{formatCNY(r.estimatedFreight)}</td>
                      <td className="px-4 py-3">
                        {!hasActual ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="输入实际运费"
                              value={editFreight[r.id] ?? ''}
                              onChange={(e) => setEditFreight(prev => ({ ...prev, [r.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && editFreight[r.id]) {
                                  handleUpdateFreight(r.id);
                                }
                              }}
                              className="w-28 h-7 text-sm"
                            />
                            {editFreight[r.id] && (
                              <button
                                onClick={() => handleUpdateFreight(r.id)}
                                disabled={updatingId === r.id}
                                className="text-xs text-[#2F6BFF] hover:underline"
                              >
                                确认
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className={`text-sm font-medium ${diffHigh ? 'text-red-600' : 'text-[#152033]'}`}>
                            {formatCNY(r.actualFreight)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {hasActual ? (
                          <span className={`text-sm font-medium ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-[#637089]'}`}>
                            {diff > 0 ? '+' : ''}{formatCNY(diff)}
                          </span>
                        ) : (
                          <span className="text-sm text-[#637089]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.reconciled ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> 已核对
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                            <Clock className="w-3 h-3" /> 待核对
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!r.reconciled && hasActual ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReconcile(r.id)}
                            disabled={updatingId === r.id}
                            className="text-xs"
                          >
                            标记已核对
                          </Button>
                        ) : (
                          <span className="text-xs text-[#637089]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
