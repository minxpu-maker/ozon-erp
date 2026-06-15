'use client';

import { LineChart } from 'lucide-react';

export default function MonitorKeywordsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#152033]">关键词排名</h1>
        <p className="text-sm text-[#637089] mt-1">监控商品在关键词搜索结果中的排名变化</p>
      </div>
      
      <div className="bg-white rounded-xl border border-[#E6EAF2] p-12 text-center">
        <LineChart className="w-12 h-12 text-[#637089] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[#152033] mb-2">关键词排名监控页面</h3>
        <p className="text-[#637089]">功能开发中，敬请期待...</p>
      </div>
    </div>
  );
}
