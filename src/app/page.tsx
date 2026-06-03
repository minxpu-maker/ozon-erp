import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">O</span>
              </div>
              <span className="font-semibold text-foreground">Ozon ERP</span>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/orders"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                订单管理
              </Link>
              <Link
                href="/settings"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                系统设置
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* 欢迎区域 */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Ozon ERP 电商管理系统
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            集成订单处理、智能采购、供应链管理的跨境电商ERP系统。
            支持零库存管理、人机协同绑定、硬件强集成。
          </p>
        </div>

        {/* 功能卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 订单管理 */}
          <Link
            href="/orders"
            className="group bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                订单管理
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Ozon 订单同步、状态管理、批量发货、订单筛选
            </p>
          </Link>

          {/* 系统设置 */}
          <Link
            href="/settings"
            className="group bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.43-.888 3.018.842 2.13 2.258a1.723 1.723 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.723 1.723 0 00-1.065 2.573c.888 1.43-.842 3.018-2.258 2.13a1.723 1.723 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.723 1.723 0 00-2.573-1.066c-1.43.888-3.018-.842-2.13-2.258a1.723 1.723 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.723 1.723 0 001.065-2.573c-.888-1.43.842-3.018 2.258-2.13a1.723 1.723 0 002.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                系统设置
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Ozon API 配置、订单同步设置、系统参数管理
            </p>
          </Link>

          {/* 采购管理 */}
          <div className="bg-card border border-border rounded-lg p-6 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="font-semibold text-muted-foreground">采购管理</h2>
            </div>
            <p className="text-sm text-muted-foreground">待开发</p>
          </div>

          {/* 入库验货 */}
          <div className="bg-card border border-border rounded-lg p-6 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h2 className="font-semibold text-muted-foreground">入库验货</h2>
            </div>
            <p className="text-sm text-muted-foreground">待开发</p>
          </div>

          {/* 打包发货 */}
          <div className="bg-card border border-border rounded-lg p-6 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <h2 className="font-semibold text-muted-foreground">打包发货</h2>
            </div>
            <p className="text-sm text-muted-foreground">待开发</p>
          </div>

          {/* 财务核算 */}
          <div className="bg-card border border-border rounded-lg p-6 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.452 2.599 1M12 8V7m0 1v1m0 2v6m0 2v1m0-1c-1.11 0-2.08-.452-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="font-semibold text-muted-foreground">财务核算</h2>
            </div>
            <p className="text-sm text-muted-foreground">待开发</p>
          </div>
        </div>

        {/* 快速开始 */}
        <div className="mt-12 bg-muted/50 border border-border rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-4">快速开始</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>进入 <Link href="/settings" className="text-primary hover:underline">系统设置</Link> 配置 Ozon API 凭证</li>
            <li>点击"测试连接"验证配置是否正确</li>
            <li>设置订单同步参数（间隔、自动创建采购任务等）</li>
            <li>进入 <Link href="/orders" className="text-primary hover:underline">订单管理</Link> 开始同步和管理订单</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
