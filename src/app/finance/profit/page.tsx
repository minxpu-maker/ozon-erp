'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { TrendingUp } from 'lucide-react';

export default function ProfitPage() {
  return (
    <AppLayout title="利润看板">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">利润看板</h3>
          <p className="text-sm text-gray-400">功能开发中，敬请期待</p>
        </div>
      </div>
    </AppLayout>
  );
}
