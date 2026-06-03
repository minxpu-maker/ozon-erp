import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ozon ERP - 订单管理',
  description: '跨境电商智能供应链管理系统',
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* 简化版布局，后续可扩展侧边栏 */}
      <main>{children}</main>
    </div>
  );
}
