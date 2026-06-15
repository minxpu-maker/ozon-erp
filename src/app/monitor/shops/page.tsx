'use client';

import { Building2 } from 'lucide-react';

export default function MonitorShopsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#152033]">店铺监控</h1>
        <p className="text-sm text-[#637089] mt-1">监控竞对店铺的新品上架和Listing变更</p>
      </div>
      
      <div className="bg-white rounded-xl border border-[#E6EAF2] p-12 text-center">
        <Building2 className="w-12 h-12 text-[#637089] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[#152033] mb-2">店铺监控页面</h3>
        <p className="text-[#637089]">功能开发中，敬请期待...</p>
      </div>
    </div>
  );
}
