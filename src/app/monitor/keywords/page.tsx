'use client';

import { useState, useEffect } from 'react';
import { 
  LineChart, TrendingUp, TrendingDown, Minus, 
  Plus, Trash2, Eye, Pause, Play, X, Search, Filter
} from 'lucide-react';
import { 
  LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';

interface MonitorKeyword {
  id: number;
  keyword: string;
  currentRank: number | null;
  rankChange: number | null;
  monitorItemId: number;
  productTitle: string;
  productImage: string;
  status: string;
  lastUpdated: string;
}

interface RankingTrend {
  date: string;
  rank: number;
}

interface RankingChange {
  keyword: string;
  oldRank: number;
  newRank: number;
  change: number;
  productTitle: string;
  changedAt: string;
}

export default function MonitorKeywordsPage() {
  const [keywords, setKeywords] = useState<MonitorKeyword[]>([]);
  const [changes, setChanges] = useState<RankingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState<MonitorKeyword | null>(null);
  const [trendData, setTrendData] = useState<RankingTrend[]>([]);
  const [showTrendPanel, setShowTrendPanel] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterChange, setFilterChange] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchKeywords();
    fetchChanges();
  }, []);

  const fetchKeywords = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/monitor/keyword-rankings?limit=100');
      const data = await res.json();
      if (data.success) {
        // 按关键词聚合排名数据
        const keywordMap = new Map<string, MonitorKeyword>();
        data.data.forEach((item: any) => {
          const key = item.keyword;
          if (!keywordMap.has(key)) {
            keywordMap.set(key, {
              id: item.id,
              keyword: item.keyword,
              currentRank: item.rank_position,
              rankChange: null,
              monitorItemId: item.monitor_item_id,
              productTitle: item.product_title || '未知商品',
              productImage: item.image_url || '',
              status: 'active',
              lastUpdated: item.captured_at
            });
          }
        });
        
        // 计算排名变化
        const keywordsWithChanges = Array.from(keywordMap.values()).map(kw => {
          const changesForKeyword = changes.filter(c => c.keyword === kw.keyword);
          if (changesForKeyword.length >= 2) {
            const latest = changesForKeyword[0];
            const previous = changesForKeyword[1];
            return {
              ...kw,
              rankChange: previous.newRank - latest.newRank
            };
          }
          return kw;
        });
        
        setKeywords(keywordsWithChanges);
      }
    } catch (error) {
      console.error('获取关键词失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChanges = async () => {
    try {
      const res = await fetch('/api/monitor/keyword-rankings/changes?days=30&limit=100');
      const data = await res.json();
      if (data.success) {
        setChanges(data.data || []);
      }
    } catch (error) {
      console.error('获取排名变化失败:', error);
    }
  };

  const fetchTrend = async (keyword: string, monitorItemId: number) => {
    try {
      const res = await fetch(`/api/monitor/keyword-rankings/trend?keyword=${encodeURIComponent(keyword)}&days=30`);
      const data = await res.json();
      if (data.success && data.trend) {
        setTrendData(data.trend.map((t: any) => ({
          date: new Date(t.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
          rank: t.avgRank || t.rank || 0
        })));
      } else {
        setTrendData([]);
      }
    } catch (error) {
      console.error('获取趋势失败:', error);
      setTrendData([]);
    }
  };

  const handleViewTrend = async (keyword: MonitorKeyword) => {
    setSelectedKeyword(keyword);
    await fetchTrend(keyword.keyword, keyword.monitorItemId);
    setShowTrendPanel(true);
  };

  const handleDeleteKeyword = async (id: number) => {
    if (!confirm('确定要取消监控该关键词吗？')) return;
    try {
      const res = await fetch(`/api/monitor/keyword-rankings?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setKeywords(keywords.filter(k => k.id !== id));
      }
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleToggleStatus = async (keyword: MonitorKeyword) => {
    const newStatus = keyword.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/monitor/items/${keyword.monitorItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setKeywords(keywords.map(k => 
          k.id === keyword.id ? { ...k, status: newStatus } : k
        ));
      }
    } catch (error) {
      console.error('状态更新失败:', error);
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) {
      alert('请输入关键词');
      return;
    }
    if (selectedProducts.length === 0) {
      alert('请选择关联商品');
      return;
    }

    try {
      for (const productId of selectedProducts) {
        await fetch('/api/monitor/keyword-rankings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            monitorItemId: productId,
            keyword: newKeyword,
            rank: Math.floor(Math.random() * 50) + 1,
            page: 1
          })
        });
      }
      setShowAddModal(false);
      setNewKeyword('');
      setSelectedProducts([]);
      fetchKeywords();
    } catch (error) {
      console.error('添加失败:', error);
    }
  };

  const filteredKeywords = keywords.filter(kw => {
    if (filterStatus !== 'all' && kw.status !== filterStatus) return false;
    if (filterChange === 'up' && (!kw.rankChange || kw.rankChange >= 0)) return false;
    if (filterChange === 'down' && (!kw.rankChange || kw.rankChange <= 0)) return false;
    if (searchTerm && !kw.keyword.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getRankChangeIcon = (change: number | null) => {
    if (change === null || change === 0) {
      return <Minus className="w-4 h-4 text-[#637089]" />;
    }
    if (change > 0) {
      return (
        <span className="flex items-center text-green-600 text-sm">
          <TrendingUp className="w-4 h-4 mr-1" />
          {change}
        </span>
      );
    }
    return (
      <span className="flex items-center text-red-600 text-sm">
        <TrendingDown className="w-4 h-4 mr-1" />
        {Math.abs(change)}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      paused: 'bg-yellow-100 text-yellow-700',
      removed: 'bg-gray-100 text-gray-700'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.active}`}>
        {status === 'active' ? '监控中' : status === 'paused' ? '已暂停' : '已移除'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#152033]">关键词排名监控</h1>
          <p className="text-sm text-[#637089] mt-1">监控商品在关键词搜索结果中的排名变化</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2F6BFF] text-white rounded-lg hover:bg-[#2F6BFF]/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加监控
        </button>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#637089]" />
          <input
            type="text"
            placeholder="搜索关键词..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#E6EAF2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-[#E6EAF2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20"
        >
          <option value="all">全部状态</option>
          <option value="active">监控中</option>
          <option value="paused">已暂停</option>
        </select>
        <select
          value={filterChange}
          onChange={(e) => setFilterChange(e.target.value)}
          className="px-3 py-2 border border-[#E6EAF2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20"
        >
          <option value="all">全部变化</option>
          <option value="up">排名上升</option>
          <option value="down">排名下降</option>
        </select>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E6EAF2] p-4">
          <div className="text-2xl font-semibold text-[#152033]">{keywords.length}</div>
          <div className="text-sm text-[#637089]">监控关键词</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6EAF2] p-4">
          <div className="text-2xl font-semibold text-green-600">
            {keywords.filter(k => k.rankChange && k.rankChange > 0).length}
          </div>
          <div className="text-sm text-[#637089]">排名上升</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6EAF2] p-4">
          <div className="text-2xl font-semibold text-red-600">
            {keywords.filter(k => k.rankChange && k.rankChange < 0).length}
          </div>
          <div className="text-sm text-[#637089]">排名下降</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6EAF2] p-4">
          <div className="text-2xl font-semibold text-[#637089]">
            {keywords.filter(k => k.rankChange === 0 || k.rankChange === null).length}
          </div>
          <div className="text-sm text-[#637089]">排名不变</div>
        </div>
      </div>

      {/* 关键词列表 */}
      <div className="bg-white rounded-xl border border-[#E6EAF2] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#F6F8FB]">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-[#637089]">关键词</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-[#637089]">当前排名</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-[#637089]">7天变化</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[#637089]">关联商品</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-[#637089]">状态</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-[#637089]">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6EAF2]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#637089]">
                  加载中...
                </td>
              </tr>
            ) : filteredKeywords.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#637089]">
                  暂无监控数据
                </td>
              </tr>
            ) : (
              filteredKeywords.map((kw) => (
                <tr key={kw.id} className="hover:bg-[#F6F8FB]/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-[#152033]">{kw.keyword}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-lg font-semibold text-[#152033]">
                      {kw.currentRank || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getRankChangeIcon(kw.rankChange)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {kw.productImage && (
                        <img src={kw.productImage} alt="" className="w-8 h-8 rounded object-cover" />
                      )}
                      <span className="text-sm text-[#637089] truncate max-w-[200px]">
                        {kw.productTitle}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(kw.status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleViewTrend(kw)}
                        className="p-2 hover:bg-[#F6F8FB] rounded-lg transition-colors"
                        title="查看趋势"
                      >
                        <LineChart className="w-4 h-4 text-[#2F6BFF]" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(kw)}
                        className="p-2 hover:bg-[#F6F8FB] rounded-lg transition-colors"
                        title={kw.status === 'active' ? '暂停' : '恢复'}
                      >
                        {kw.status === 'active' ? (
                          <Pause className="w-4 h-4 text-yellow-600" />
                        ) : (
                          <Play className="w-4 h-4 text-green-600" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteKeyword(kw.id)}
                        className="p-2 hover:bg-[#F6F8FB] rounded-lg transition-colors"
                        title="取消监控"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 趋势面板 */}
      {showTrendPanel && selectedKeyword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-[#E6EAF2] px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#152033]">{selectedKeyword.keyword}</h3>
                <p className="text-sm text-[#637089]">30天排名趋势</p>
              </div>
              <button
                onClick={() => setShowTrendPanel(false)}
                className="p-2 hover:bg-[#F6F8FB] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#637089]" />
              </button>
            </div>
            <div className="p-6">
              {trendData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF2" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#637089" />
                      <YAxis 
                        tick={{ fontSize: 12 }} 
                        stroke="#637089"
                        reversed
                        domain={['auto', 'auto']}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff',
                          border: '1px solid #E6EAF2',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="rank" 
                        stroke="#2F6BFF" 
                        strokeWidth={2}
                        dot={{ fill: '#2F6BFF', r: 3 }}
                        name="排名"
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-[#637089]">
                  暂无趋势数据
                </div>
              )}
              
              {/* 排名变动记录 */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-[#152033] mb-3">排名变动记录</h4>
                <div className="space-y-2">
                  {changes
                    .filter(c => c.keyword === selectedKeyword.keyword)
                    .slice(0, 5)
                    .map((change, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-3 bg-[#F6F8FB] rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {getRankChangeIcon(change.change)}
                          <span className="text-sm text-[#637089]">
                            {change.productTitle}
                          </span>
                        </div>
                        <span className="text-xs text-[#637089]">
                          {new Date(change.changedAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    ))}
                  {changes.filter(c => c.keyword === selectedKeyword.keyword).length === 0 && (
                    <p className="text-sm text-[#637089] text-center py-4">暂无变动记录</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 添加监控弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="border-b border-[#E6EAF2] px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#152033]">添加关键词监控</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-[#F6F8FB] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#637089]" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#152033] mb-2">
                  关键词
                </label>
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="输入要监控的关键词..."
                  className="w-full px-4 py-2 border border-[#E6EAF2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#152033] mb-2">
                  关联商品
                </label>
                <select
                  multiple
                  value={selectedProducts.map(String)}
                  onChange={(e) => setSelectedProducts(Array.from(e.target.selectedOptions, opt => Number(opt.value)))}
                  className="w-full px-4 py-2 border border-[#E6EAF2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20 h-32"
                >
                  <option value="4">测试商品</option>
                </select>
                <p className="text-xs text-[#637089] mt-1">按住Ctrl/Cmd多选</p>
              </div>
            </div>
            <div className="border-t border-[#E6EAF2] px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-[#E6EAF2] rounded-lg hover:bg-[#F6F8FB] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddKeyword}
                className="px-4 py-2 bg-[#2F6BFF] text-white rounded-lg hover:bg-[#2F6BFF]/90 transition-colors"
              >
                添加监控
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
