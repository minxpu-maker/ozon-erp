'use client';

import { TopBar } from './TopBar';
import Sidebar from './Sidebar';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      {/* 顶部工作台栏 - 固定48px */}
      <TopBar />

      <div className="flex" style={{ height: 'calc(100vh - 48px)' }}>
        {/* 左侧导航 */}
        <Sidebar />

        {/* 主内容区 */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
