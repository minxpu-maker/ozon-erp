'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { use } from 'react';

export default function SelectionEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  return (
    <AppLayout title="商品卡编辑器" subtitle={`编辑商品卡 ID: ${id}`}>
      <div className="bg-white rounded-lg border border-[#E6EAF2] p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 bg-[#2F6BFF]/10 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">✏️</span>
          </div>
          <h2 className="text-lg font-semibold text-[#152033] mb-2">功能开发中</h2>
          <p className="text-sm text-[#637089]">商品卡编辑器正在开发中...</p>
        </div>
      </div>
    </AppLayout>
  );
}
