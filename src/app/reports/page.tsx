'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { BarChart3, RefreshCw, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';

export default function ReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) { console.error('获取报表失败:', error); }
    finally { setLoading(false); }
  };

  return (
    <AppLayout title="数据报表" subtitle="经营报表 · 采购报表 · 效率报表">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#637089]">总订单数</span>
            <div className="w-8 h-8 bg-[#2F6BFF]/10 rounded-lg flex items-center justify-center"><BarChart2 className="w-4 h-4 text-[#2F6BFF]" /></div>
          </div>
          <div className="text-2xl font-bold text-[#152033]">{stats?.orderStats?.total || 0}<span className="text-sm font-normal text-[#637089] ml-1">笔</span></div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#637089]">订单总金额</span>
            <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-green-600" /></div>
          </div>
          <div className="text-2xl font-bold text-[#152033]">¥{stats?.orderStats?.totalAmount || '0'}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#637089]">采购总额</span>
            <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center"><TrendingDown className="w-4 h-4 text-red-600" /></div>
          </div>
          <div className="text-2xl font-bold text-[#152033]">¥{stats?.purchaseStats?.totalAmount || '0'}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border border-[#E6EAF2]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#637089]">净利润</span>
            <div className="w-8 h-8 bg-[#2F6BFF]/10 rounded-lg flex items-center justify-center"><BarChart3 className="w-4 h-4 text-[#2F6BFF]" /></div>
          </div>
          <div className="text-2xl font-bold text-green-600">¥{stats?.profitStats?.totalProfit || '0'}</div>
        </div>
      </div>

      {/* 图表区域占位 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-[#E6EAF2]">
          <h3 className="text-base font-semibold text-[#152033] mb-4">订单趋势</h3>
          <div className="h-64 flex items-center justify-center text-[#637089]">
            <BarChart2 className="w-16 h-16 opacity-30" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-[#E6EAF2]">
          <h3 className="text-base font-semibold text-[#152033] mb-4">利润趋势</h3>
          <div className="h-64 flex items-center justify-center text-[#637089]">
            <TrendingUp className="w-16 h-16 opacity-30" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
