'use client';

import { AppLayout } from '@/components/layout/AppLayout';

export default function SelectionPage() {
  return (
    <AppLayout title="AI 选品看板" subtitle="智能选品 · 发现优质商机">
      <div className="bg-white rounded-lg border border-[#E6EAF2] p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 bg-[#2F6BFF]/10 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">🎯</span>
          </div>
          <h2 className="text-lg font-semibold text-[#152033] mb-2">功能开发中</h2>
          <p className="text-sm text-[#637089]">AI 智能选品功能正在开发中，敬请期待...</p>
        </div>
      </div>
    </AppLayout>
  );
}
