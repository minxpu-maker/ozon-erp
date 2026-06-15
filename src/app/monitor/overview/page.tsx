'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Eye, 
  TrendingUp, 
  TrendingDown,
  Package,
  ArrowUp,
  ArrowDown,
  Clock,
  Building2,
  RefreshCw,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';

interface MonitorStats {
  totalMonitored: number;
  todayChanges: number;
  rankUp: number;
  rankDown: number;
}

interface PriceChange {
  id: number;
  productTitle: string;
  signalId: number;
  imageUrl: string;
  changeType: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
}

interface KeywordRankingChange {
  keyword: string;
  oldRank: number;
  newRank: number;
  change: number;
  changeType: string;
  monitorItemId: number;
}

interface ListingChange {
  signalId: number;
  productTitle: string;
  imageUrl: string;
  changeType: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
  platform: string;
}

interface ShopNewProduct {
  sellerName: string;
  productTitle: string;
  price: string;
  listedDate: string;
  category: string;
  productStatus: string;
}

export default function MonitorOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MonitorStats>({
    totalMonitored: 0,
    todayChanges: 0,
    rankUp: 0,
    rankDown: 0,
  });
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [keywordChanges, setKeywordChanges] = useState<KeywordRankingChange[]>([]);
  const [listingChanges, setListingChanges] = useState<ListingChange[]>([]);
  const [shopNewProducts, setShopNewProducts] = useState<ShopNewProduct[]>([]);
  const [listingPage, setListingPage] = useState(1);
  const [shopPage, setShopPage] = useState(1);
  const [listingTotal, setListingTotal] = useState(0);
  const [shopTotal, setShopTotal] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMonitorStats(),
        fetchPriceChanges(),
        fetchKeywordChanges(),
        fetchListingChanges(1),
        fetchShopNewProducts(1),
      ]);
    } catch (error) {
      console.error('Failed to fetch monitor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonitorStats = async () => {
    try {
      const [itemsRes, changesRes, kwChangesRes] = await Promise.all([
        fetch('/api/monitor/items?type=product&status=active&limit=1'),
        fetch('/api/monitor/listing-changes?days=1'),
        fetch('/api/monitor/keyword-rankings/changes?days=1'),
      ]);
      
      const [itemsData, changesData, kwChangesData] = await Promise.all([
        itemsRes.json(),
        changesRes.json(),
        kwChangesRes.json(),
      ]);

      const totalMonitored = itemsData.total || 0;
      const todayChanges = changesData.total || 0;
      const rankUp = (kwChangesData.data || []).filter((k: any) => k.change > 0).length;
      const rankDown = (kwChangesData.data || []).filter((k: any) => k.change < 0).length;

      setStats({ totalMonitored, todayChanges, rankUp, rankDown });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchPriceChanges = async () => {
    try {
      const res = await fetch('/api/monitor/listing-changes?days=30&changeType=price&limit=5');
      const data = await res.json();
      
      const changes: PriceChange[] = (data.data || [])
        .filter((item: any) => item.changeType === 'price')
        .slice(0, 5)
        .map((item: any, index: number) => ({
          id: index,
          productTitle: item.productTitle,
          signalId: item.signalId,
          imageUrl: item.imageUrl || '',
          changeType: 'price',
          oldValue: item.oldValue,
          newValue: item.newValue,
          changedAt: item.changedAt,
        }));
      
      setPriceChanges(changes);
    } catch (error) {
      console.error('Failed to fetch price changes:', error);
    }
  };

  const fetchKeywordChanges = async () => {
    try {
      const res = await fetch('/api/monitor/keyword-rankings/changes?days=7&limit=5');
      const data = await res.json();
      
      const changes: KeywordRankingChange[] = (data.data || [])
        .slice(0, 5)
        .map((item: any) => ({
          keyword: item.keyword,
          oldRank: item.oldRank,
          newRank: item.newRank,
          change: item.change,
          changeType: item.changeType,
          monitorItemId: item.monitorItemId,
        }));
      
      setKeywordChanges(changes);
    } catch (error) {
      console.error('Failed to fetch keyword changes:', error);
    }
  };

  const fetchListingChanges = async (page: number) => {
    try {
      const res = await fetch(`/api/monitor/listing-changes?days=7&limit=10&page=${page}`);
      const data = await res.json();
      
      setListingChanges(data.data || []);
      setListingTotal(data.total || 0);
      setListingPage(page);
    } catch (error) {
      console.error('Failed to fetch listing changes:', error);
    }
  };

  const fetchShopNewProducts = async (page: number) => {
    try {
      const res = await fetch(`/api/monitor/shops/new-products?days=7&limit=10&page=${page}`);
      const data = await res.json();
      
      setShopNewProducts(data.data || []);
      setShopTotal(data.total || 0);
      setShopPage(page);
    } catch (error) {
      console.error('Failed to fetch shop new products:', error);
    }
  };

  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      
      if (hours < 1) return '刚刚';
      if (hours < 24) return `${hours}小时前`;
      const days = Math.floor(hours / 24);
      return `${days}天前`;
    } catch {
      return timeStr;
    }
  };

  const getChangeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      price: '价格',
      title: '标题',
      image: '图片',
      rating: '评分',
      reviewCount: '评论',
      sales: '销量',
    };
    return labels[type] || type;
  };

  const getChangeTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      price: 'bg-orange-100 text-orange-700',
      title: 'bg-blue-100 text-blue-700',
      image: 'bg-purple-100 text-purple-700',
      rating: 'bg-yellow-100 text-yellow-700',
      reviewCount: 'bg-green-100 text-green-700',
      sales: 'bg-cyan-100 text-cyan-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-[#1677FF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#152033]">监控总览</h1>
          <p className="text-sm text-[#637089] mt-1">实时掌握您的商品监控动态</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E6EAF2] rounded-lg text-sm text-[#637089] hover:bg-[#F6F8FB] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          刷新数据
        </button>
      </div>

      {/* 监控概况卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-[#E6EAF2]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1677FF]/10 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-[#1677FF]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#152033]">{stats.totalMonitored}</div>
              <div className="text-sm text-[#637089]">监控中</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-[#E6EAF2]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#152033]">{stats.todayChanges}</div>
              <div className="text-sm text-[#637089]">今日变更</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-[#E6EAF2]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ArrowUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#152033]">{stats.rankUp}</div>
              <div className="text-sm text-[#637089]">排名上升</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-[#E6EAF2]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <ArrowDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#152033]">{stats.rankDown}</div>
              <div className="text-sm text-[#637089]">排名下降</div>
            </div>
          </div>
        </div>
      </div>

      {/* 价格变动和关键词排名 Top5 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 价格变动 Top5 */}
        <div className="bg-white rounded-xl border border-[#E6EAF2]">
          <div className="px-5 py-4 border-b border-[#E6EAF2] flex items-center justify-between">
            <h2 className="font-semibold text-[#152033]">价格变动 Top5</h2>
            <Link 
              href="/monitor/products" 
              className="text-sm text-[#1677FF] hover:underline flex items-center gap-1"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-5">
            {priceChanges.length === 0 ? (
              <div className="text-center py-8 text-[#637089]">
                暂无价格变动数据
              </div>
            ) : (
              <div className="space-y-3">
                {priceChanges.map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#F6F8FB] transition-colors cursor-pointer"
                  >
                    {item.imageUrl ? (
                      <img 
                        src={item.imageUrl} 
                        alt={item.productTitle}
                        className="w-10 h-10 rounded object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 bg-[#F6F8FB] rounded flex items-center justify-center">
                        <Package className="w-5 h-5 text-[#637089]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#152033] truncate">
                        {item.productTitle}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[#637089]">{item.oldValue}</span>
                        <ArrowRight className="w-3 h-3 text-[#637089]" />
                        <span className="text-xs font-medium text-[#1677FF]">{item.newValue}</span>
                      </div>
                    </div>
                    <span className="text-xs text-[#637089]">{formatTime(item.changedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 关键词排名变动 Top5 */}
        <div className="bg-white rounded-xl border border-[#E6EAF2]">
          <div className="px-5 py-4 border-b border-[#E6EAF2] flex items-center justify-between">
            <h2 className="font-semibold text-[#152033]">关键词排名变动 Top5</h2>
            <Link 
              href="/monitor/keywords" 
              className="text-sm text-[#1677FF] hover:underline flex items-center gap-1"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-5">
            {keywordChanges.length === 0 ? (
              <div className="text-center py-8 text-[#637089]">
                暂无关键词排名数据
              </div>
            ) : (
              <div className="space-y-3">
                {keywordChanges.map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#F6F8FB] transition-colors cursor-pointer"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      item.changeType === 'up' 
                        ? 'bg-green-100 text-green-700' 
                        : item.changeType === 'down'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {item.change > 0 ? '+' : ''}{item.change}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#152033] truncate">
                        {item.keyword}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[#637089]">#{item.oldRank}</span>
                        <span className="text-xs text-[#637089]">→</span>
                        <span className="text-xs font-medium text-[#1677FF]">#{item.newRank}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Listing变更列表 */}
      <div className="bg-white rounded-xl border border-[#E6EAF2]">
        <div className="px-5 py-4 border-b border-[#E6EAF2] flex items-center justify-between">
          <h2 className="font-semibold text-[#152033]">Listing变更记录</h2>
          <div className="text-sm text-[#637089]">共 {listingTotal} 条</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F6F8FB]">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">商品</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">变更类型</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">变更内容</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF2]">
              {listingChanges.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[#637089]">
                    暂无变更记录
                  </td>
                </tr>
              ) : (
                listingChanges.map((item, index) => (
                  <tr key={index} className="hover:bg-[#F6F8FB]/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt={item.productTitle}
                            className="w-10 h-10 rounded object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 bg-[#F6F8FB] rounded flex items-center justify-center">
                            <Package className="w-5 h-5 text-[#637089]" />
                          </div>
                        )}
                        <Link 
                          href={`/selection/editor/${item.signalId}`}
                          className="text-sm font-medium text-[#152033] truncate max-w-xs hover:text-[#1677FF] hover:underline"
                        >
                          {item.productTitle}
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getChangeTypeColor(item.changeType)}`}>
                        {getChangeTypeLabel(item.changeType)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-[#637089]">{item.oldValue}</span>
                      <ArrowRight className="w-4 h-4 text-[#637089] inline mx-1" />
                      <span className="text-sm font-medium text-[#1677FF]">{item.newValue}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 text-sm text-[#637089]">
                        <Clock className="w-4 h-4" />
                        {formatTime(item.changedAt)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* 分页 */}
        {listingTotal > 10 && (
          <div className="px-5 py-4 border-t border-[#E6EAF2] flex items-center justify-between">
            <div className="text-sm text-[#637089]">
              第 {listingPage} 页，共 {Math.ceil(listingTotal / 10)} 页
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchListingChanges(listingPage - 1)}
                disabled={listingPage <= 1}
                className="px-3 py-1.5 text-sm border border-[#E6EAF2] rounded hover:bg-[#F6F8FB] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                onClick={() => fetchListingChanges(listingPage + 1)}
                disabled={listingPage >= Math.ceil(listingTotal / 10)}
                className="px-3 py-1.5 text-sm border border-[#E6EAF2] rounded hover:bg-[#F6F8FB] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 店铺上新列表 */}
      <div className="bg-white rounded-xl border border-[#E6EAF2]">
        <div className="px-5 py-4 border-b border-[#E6EAF2] flex items-center justify-between">
          <h2 className="font-semibold text-[#152033]">店铺上新</h2>
          <Link 
            href="/monitor/shops" 
            className="text-sm text-[#1677FF] hover:underline flex items-center gap-1"
          >
            店铺监控 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F6F8FB]">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">店铺</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">商品</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">价格</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#637089] uppercase tracking-wider">上架时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF2]">
              {shopNewProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[#637089]">
                    暂无新商品
                  </td>
                </tr>
              ) : (
                shopNewProducts.map((item, index) => (
                  <tr key={index} className="hover:bg-[#F6F8FB]/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#637089]" />
                        <span className="text-sm font-medium text-[#152033]">
                          {item.sellerName}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-[#152033]">{item.productTitle}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-[#152033]">{item.price}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 text-sm text-[#637089]">
                        <Clock className="w-4 h-4" />
                        {item.listedDate}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* 分页 */}
        {shopTotal > 10 && (
          <div className="px-5 py-4 border-t border-[#E6EAF2] flex items-center justify-between">
            <div className="text-sm text-[#637089]">
              第 {shopPage} 页，共 {Math.ceil(shopTotal / 10)} 页
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchShopNewProducts(shopPage - 1)}
                disabled={shopPage <= 1}
                className="px-3 py-1.5 text-sm border border-[#E6EAF2] rounded hover:bg-[#F6F8FB] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                onClick={() => fetchShopNewProducts(shopPage + 1)}
                disabled={shopPage >= Math.ceil(shopTotal / 10)}
                className="px-3 py-1.5 text-sm border border-[#E6EAF2] rounded hover:bg-[#F6F8FB] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
