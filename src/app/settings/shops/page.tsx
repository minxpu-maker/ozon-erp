'use client';

import useSWR from 'swr';

interface Shop {
  id: number;
  shopName: string;
  clientId: string;
  apiKey: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ShopsPage() {
  const { data: shops = [], isLoading } = useSWR<Shop[]>('/api/shops', fetcher);

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      {/* 顶部操作栏 */}
      <div className="bg-white border-b border-[#E6EAF2] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#152033]">店铺管理</h1>
          <p className="text-sm text-[#637089] mt-0.5">管理Ozon店铺API密钥，支持多店铺统一管理</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#2F6BFF] text-white text-sm font-medium rounded-lg hover:bg-[#2F6BFF]/90 transition-colors">
          + 新增店铺
        </button>
      </div>

      {/* 店铺列表 */}
      <div className="p-6">
        {isLoading ? (
          <div className="text-center py-16 text-[#637089]">加载中...</div>
        ) : shops.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-5xl mb-4">🏪</div>
            <p className="text-[#152033] font-medium mb-1">暂无店铺</p>
            <p className="text-sm text-[#637089]">点击上方「+ 新增店铺」添加第一个Ozon店铺</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {shops.map((shop) => (
              <div
                key={shop.id}
                className="bg-white rounded-lg border border-[#E6EAF2] p-4 hover:shadow-md transition-shadow"
              >
                {/* 卡片头部 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#2F6BFF]/10 rounded-lg flex items-center justify-center text-[#2F6BFF] font-bold text-sm">
                      OZ
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#152033]">{shop.shopName}</h3>
                      <p className="text-xs text-[#637089]">Ozon · Client-Id: {shop.clientId}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    shop.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {shop.isActive ? '活跃' : '停用'}
                  </span>
                </div>

                {/* 卡片底部 */}
                <div className="text-xs text-[#637089]">
                  最后同步: {shop.lastSyncedAt ? new Date(shop.lastSyncedAt).toLocaleString('zh-CN') : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
