'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Store, Plus, Pencil, Plug, RefreshCw, Trash2, Play, MoreVertical,
  ShoppingBag, ShoppingCart, Link as LinkIcon, Sliders, BellRing, 
  Printer, FileText, Save, CheckCircle, XCircle, Bell, Settings as SettingsIcon,
  Copy, Box, LayoutDashboard, Package, ClipboardList, Truck, Calculator,
  PackageSearch, Warehouse, Database, Users, BarChart3, UserCircle, Shield,
  Target, Image, RefreshCw as Sync, AlertTriangle, TrendingUp, Search
} from 'lucide-react';
import { getNavItems } from '@/lib/nav-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Shop {
  id: string;
  name: string;
  client_id: string;
  api_key: string;
  is_primary: boolean;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

interface NotificationLog {
  id: string;
  type: string;
  message: string;
  data: string | null;
  created_at: string;
}

// 通知日志列表组件
function NotificationLogList() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
    // 每30秒刷新一次
    const interval = setInterval(loadLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications/logs?type=ozon_notification&limit=20');
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.logs);
      }
    } catch (e) {
      console.error('加载日志失败:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BellRing className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>暂无推送通知</p>
        <p className="text-xs mt-1">Ozon推送的通知将显示在这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => {
        let parsedData = null;
        try {
          parsedData = log.data ? JSON.parse(log.data) : null;
        } catch {
          // ignore
        }
        
        return (
          <div key={log.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <BellRing className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{log.message}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(log.created_at).toLocaleString('zh-CN')}
              </p>
              {parsedData && (
                <details className="mt-2">
                  <summary className="text-xs text-primary cursor-pointer">查看详情</summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                    {JSON.stringify(parsedData, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 插件API Key管理组件
function ExtensionKeyManager() {
  const [keys, setKeys] = useState<Array<{
    id: number;
    keyPrefix: string;
    shopId: string;
    shopName?: string;
    userId: string;
    permissions: string[];
    deviceInfo?: string;
    lastUsedAt?: string;
    expiresAt: string;
    isActive: boolean;
    createdAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState({ shopId: '', deviceInfo: '' });
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [shops, setShops] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    loadKeys();
    loadShops();
  }, []);

  const loadShops = async () => {
    try {
      const res = await fetch('/api/shops');
      const data = await res.json();
      if (data.success) {
        setShops(data.data);
      }
    } catch (e) {
      console.error('加载店铺失败:', e);
    }
  };

  const loadKeys = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/extension-api-keys');
      const data = await res.json();
      if (data.success) {
        setKeys(data.data);
      }
    } catch (e) {
      console.error('加载Keys失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const [creating, setCreating] = useState(false);

  const handleCreateKey = async () => {
    if (!newKeyData.shopId) {
      alert('请选择绑定的店铺');
      return;
    }
    try {
      setCreating(true);
      const res = await fetch('/api/extension-api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: newKeyData.shopId,
          userId: 'admin',
          deviceInfo: newKeyData.deviceInfo || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewlyCreatedKey(data.data.apiKey);
        setNewKeyData({ shopId: '', deviceInfo: '' });
        setShowCreateModal(false);
        loadKeys();
      } else {
        alert(data.error || '创建失败');
      }
    } catch (e) {
      console.error('创建Key失败:', e);
      alert('创建失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  const handleDisableKey = async (id: number, shopId: string) => {
    if (!confirm('确定要禁用此密钥吗？禁用后插件将无法使用此密钥。')) return;
    try {
      const res = await fetch(`/api/extension-api-keys?id=${id}&shopId=${shopId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        loadKeys();
      } else {
        alert(data.error || '禁用失败');
      }
    } catch (e) {
      console.error('禁用Key失败:', e);
      alert('禁用失败，请重试');
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 创建新Key按钮 */}
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateModal(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          生成新密钥
        </Button>
      </div>

      {/* 新创建的Key提示 */}
      {newlyCreatedKey && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-600">API Key 已生成</p>
              <p className="text-xs text-muted-foreground mt-1">
                请妥善保管，系统不会再次显示明文密钥
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 break-all">
                  {newlyCreatedKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyKey(newlyCreatedKey)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => setNewlyCreatedKey(null)}
              >
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Key列表 */}
      {keys.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Plug className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无API密钥</p>
          <p className="text-xs mt-1">生成密钥后，Chrome插件可使用此密钥采集数据</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className={`bg-muted/30 rounded-lg p-4 border border-border/20 ${!key.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-foreground">{key.keyPrefix}...</code>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${
                    key.isActive ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    {key.isActive ? '启用中' : '已禁用'}
                  </span>
                </div>
                {key.isActive && (
                  <button
                    onClick={() => handleDisableKey(key.id, key.shopId)}
                    className="text-xs text-destructive hover:text-destructive/80 font-medium inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />禁用
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">绑定店铺</span>
                  <p className="text-foreground mt-0.5">{key.shopName || key.shopId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">创建者</span>
                  <p className="text-foreground mt-0.5">{key.userId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">最后使用</span>
                  <p className="text-foreground mt-0.5">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString('zh-CN') : '从未使用'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">过期时间</span>
                  <p className="text-foreground mt-0.5">
                    {new Date(key.expiresAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-border/20">
                <span className="text-xs text-muted-foreground">权限：</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {key.permissions.map((perm) => (
                    <span key={perm} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-primary/10 text-primary">
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建Key弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-4">生成新API密钥</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">绑定店铺</Label>
                <Select value={newKeyData.shopId} onValueChange={(v) => setNewKeyData({ ...newKeyData, shopId: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="选择店铺" />
                  </SelectTrigger>
                  <SelectContent>
                    {shops.map((shop) => (
                      <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">设备信息（可选）</Label>
                <Input
                  className="mt-1"
                  placeholder="Chrome on Windows"
                  value={newKeyData.deviceInfo}
                  onChange={(e) => setNewKeyData({ ...newKeyData, deviceInfo: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>取消</Button>
              <Button onClick={handleCreateKey} disabled={creating}>{creating ? '生成中...' : '生成'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 市场信号列表组件
function MarketSignalsList() {
  const [signals, setSignals] = useState<Array<{
    id: number;
    sourceType: string;
    signalType: string;
    productId: string;
    productTitle: string;
    productTitleZh?: string;
    categoryPath?: string;
    price: string | null;
    originalPrice?: string | null;
    salesVolume: number | null;
    rating: string | null;
    reviewsCount: number | null;
    imageUrl?: string;
    brandName?: string;
    previousSignalId?: number | null;
    collectedAt: string;
    createdAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadSignals();
  }, [sourceFilter, page]);

  const loadSignals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
        ...(sourceFilter !== 'all' && { sourceType: sourceFilter }),
      });
      const res = await fetch(`/api/market-signals?${params}`);
      const data = await res.json();
      if (data.success) {
        setSignals(data.data.signals);
        setTotal(data.data.total);
      }
    } catch (e) {
      console.error('加载信号失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const getSourceBadge = (source: string) => {
    const styles: Record<string, string> = {
      wb: 'bg-purple-500/15 text-purple-600',
      ozon_market: 'bg-blue-500/15 text-blue-600',
      aliexpress: 'bg-orange-500/15 text-orange-600',
      1688: 'bg-yellow-500/15 text-yellow-600',
    };
    const labels: Record<string, string> = {
      wb: 'Wildberries',
      ozon_market: 'Ozon',
      aliexpress: 'AliExpress',
      '1688': '1688',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${styles[source] || 'bg-muted text-muted-foreground'}`}>
        {labels[source] || source}
      </span>
    );
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">数据源：</span>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="wb">Wildberries</SelectItem>
              <SelectItem value="ozon_market">Ozon</SelectItem>
              <SelectItem value="aliexpress">AliExpress</SelectItem>
              <SelectItem value="1688">1688</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          共 <strong className="text-foreground">{total}</strong> 条记录
        </div>
      </div>

      {/* 数据列表 */}
      {signals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无市场信号数据</p>
          <p className="text-xs mt-1">使用Chrome插件采集商品数据后会显示在这里</p>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <div key={signal.id} className="bg-muted/30 rounded-lg p-4 border border-border/20">
              <div className="flex gap-4">
                {/* 商品图片 */}
                <div className="w-20 h-20 bg-muted rounded-lg shrink-0 overflow-hidden flex items-center justify-center">
                  {signal.imageUrl ? (
                    <img
                      src={`/api/image-proxy?url=${encodeURIComponent(signal.imageUrl)}`}
                      alt={signal.productTitle}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  {!signal.imageUrl && <Image className="w-8 h-8 text-muted-foreground/50" />}
                  {signal.imageUrl && <Image className="w-8 h-8 text-muted-foreground/50 hidden" />}
                </div>
                {/* 商品信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getSourceBadge(signal.sourceType)}
                      {signal.previousSignalId && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-green-500/15 text-green-600">
                          历史记录 #{signal.previousSignalId}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(signal.collectedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate mb-1">
                    {signal.productTitleZh || signal.productTitle || '未知商品'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    ID: {signal.productId} {signal.brandName && `| 品牌: ${signal.brandName}`}
                  </p>
                  <div className="flex items-center gap-4 text-xs">
                    {signal.price !== null && (
                      <span>
                        <span className="text-muted-foreground">价格：</span>
                        <span className="font-semibold text-foreground">{parseFloat(signal.price).toLocaleString()} ₽</span>
                        {signal.originalPrice && parseFloat(signal.originalPrice) > parseFloat(signal.price) && (
                          <span className="text-muted-foreground line-through ml-1">{parseFloat(signal.originalPrice).toLocaleString()}</span>
                        )}
                      </span>
                    )}
                    {signal.salesVolume !== null && (
                      <span>
                        <span className="text-muted-foreground">销量：</span>
                        <span className="text-foreground">{signal.salesVolume.toLocaleString()}</span>
                      </span>
                    )}
                    {signal.rating !== null && (
                      <span>
                        <span className="text-muted-foreground">评分：</span>
                        <span className="text-foreground">{parseFloat(signal.rating).toFixed(1)}</span>
                        {signal.reviewsCount && <span className="text-muted-foreground"> ({signal.reviewsCount}评)</span>}
                      </span>
                    )}
                    {signal.categoryPath && (
                      <span className="text-muted-foreground truncate max-w-48" title={signal.categoryPath}>
                        {signal.categoryPath}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {Math.ceil(total / pageSize)} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const pathname = usePathname();
  const navItems = getNavItems(pathname);
  const [activeSection, setActiveSection] = useState('platform');
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddShopModal, setShowAddShopModal] = useState(false);
  const [newShop, setNewShop] = useState({
    name: '',
    client_id: '',
    api_key: '',
    is_primary: false,
  });
  const [testingShop, setTestingShop] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [syncingShop, setSyncingShop] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  
  // 汇率相关状态
  const [rubToCny, setRubToCny] = useState(0.08);
  const [savingRate, setSavingRate] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);

  // 加载店铺列表
  useEffect(() => {
    loadShops();
    loadExchangeRate();
  }, []);

  const loadShops = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/shops');
      const data = await response.json();
      if (data.success) {
        setShops(data.data);
      }
    } catch (error) {
      console.error('加载店铺列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载汇率配置
  const loadExchangeRate = async () => {
    try {
      const res = await fetch('/api/system-config?key=rub_to_cny');
      const data = await res.json();
      if (data.success && data.data?.value) {
        setRubToCny(parseFloat(data.data.value));
      }
    } catch (error) {
      console.error('加载汇率失败:', error);
    }
  };

  // 保存汇率配置
  const saveExchangeRate = async () => {
    setSavingRate(true);
    try {
      const res = await fetch('/api/system-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'rub_to_cny',
          value: rubToCny.toString(),
          description: '卢布兑人民币汇率',
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('汇率保存成功');
      } else {
        alert('保存失败');
      }
    } catch (error) {
      console.error('保存汇率失败:', error);
      alert('保存失败');
    } finally {
      setSavingRate(false);
    }
  };

  // 获取实时汇率
  const fetchRealtimeRate = async () => {
    setFetchingRate(true);
    try {
      const res = await fetch('/api/exchange-rate');
      const data = await res.json();
      if (data.success && data.rate) {
        setRubToCny(data.rate);
        // 自动保存
        await fetch('/api/system-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'rub_to_cny',
            value: data.rate.toString(),
            description: '卢布兑人民币汇率',
          }),
        });
        alert(`实时汇率获取成功：1 卢布 = ${data.rate} 人民币`);
      } else {
        alert('获取实时汇率失败');
      }
    } catch (error) {
      console.error('获取实时汇率失败:', error);
      alert('获取实时汇率失败');
    } finally {
      setFetchingRate(false);
    }
  };

  // 添加店铺
  const handleAddShop = async () => {
    try {
      const response = await fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShop),
      });
      const data = await response.json();
      if (data.success) {
        setShowAddShopModal(false);
        setNewShop({ name: '', client_id: '', api_key: '', is_primary: false });
        loadShops();
      } else {
        alert(data.error || '添加失败');
      }
    } catch (error) {
      console.error('添加店铺失败:', error);
      alert('添加失败');
    }
  };

  // 编辑店铺
  const handleEditShop = async () => {
    if (!editingShop) return;
    try {
      const response = await fetch(`/api/shops/${editingShop.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingShop.name,
          client_id: editingShop.client_id,
          api_key: editingShop.api_key,
          is_primary: editingShop.is_primary,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setEditingShop(null);
        loadShops();
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('编辑店铺失败:', error);
      alert('保存失败');
    }
  };

  // 测试连接
  const handleTestConnection = async (shopId: string) => {
    try {
      setTestingShop(shopId);
      setTestResult(null);
      const response = await fetch(`/api/shops/${shopId}/test`, {
        method: 'POST',
      });
      const data = await response.json();
      setTestResult({
        success: data.success,
        message: data.success ? data.message : data.error,
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: '测试连接失败',
      });
    } finally {
      setTestingShop(null);
    }
  };

  // 删除店铺
  const handleDeleteShop = async (shopId: string) => {
    if (!confirm('确定要删除此店铺吗？')) return;
    try {
      const response = await fetch(`/api/shops/${shopId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        loadShops();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除店铺失败:', error);
      alert('删除失败');
    }
  };

  // 同步单个店铺
  const handleSyncShop = async (shopId: string) => {
    try {
      setSyncingShop(shopId);
      const response = await fetch(`/api/shops/${shopId}/sync`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        alert(`同步成功: ${data.data?.synced || 0} 条数据已更新`);
        loadShops();
      } else {
        alert(data.error || '同步失败');
      }
    } catch (error) {
      console.error('同步店铺失败:', error);
      alert('同步失败，请稍后重试');
    } finally {
      setSyncingShop(null);
    }
  };

  // 同步全部店铺
  const handleSyncAllShops = async () => {
    try {
      setSyncingAll(true);
      const activeShops = shops.filter(s => s.is_active);
      let successCount = 0;
      let failCount = 0;
      
      for (const shop of activeShops) {
        try {
          const response = await fetch(`/api/shops/${shop.id}/sync`, {
            method: 'POST',
          });
          const data = await response.json();
          if (data.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }
      
      alert(`同步完成: 成功 ${successCount} 个，失败 ${failCount} 个`);
      loadShops();
    } catch (error) {
      console.error('同步全部店铺失败:', error);
      alert('同步失败，请稍后重试');
    } finally {
      setSyncingAll(false);
    }
  };

  // 切换店铺状态
  const handleToggleShop = async (shopId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/shops/${shopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      const data = await response.json();
      if (data.success) {
        loadShops();
      }
    } catch (error) {
      console.error('切换状态失败:', error);
    }
  };

  // 定义分组导航项
  const inventoryNavItems = [
    { id: 'inventory', icon: PackageSearch, label: '库存管理', href: '/inventory' },
    { id: 'wms', icon: Warehouse, label: '仓库管理', href: '/wms' },
  ];

  const dataNavItems = [
    { id: 'sku-management', icon: Database, label: 'SKU管理', href: '/sku-management' },
    { id: 'suppliers', icon: Users, label: '供应商管理', href: '/suppliers' },
    { id: 'reports', icon: BarChart3, label: '数据报表', href: '/reports' },
    { id: 'source-health', icon: AlertTriangle, label: '数据源健康度', href: '/data-center/source-health' },
    { id: 'source-management', icon: Sync, label: '数据源管理', href: '/data-center/source-management' },
    { id: 'notifications', icon: Bell, label: '知识库通知', href: '/data-center/notifications' },
  ];

  const systemNavItems = [
    { id: 'accounts', icon: UserCircle, label: '账号管理', href: '/accounts' },
    { id: 'roles', icon: Shield, label: '角色权限', href: '/roles' },
    { id: 'settings', icon: SettingsIcon, label: '系统设置', href: '/settings', active: true },
  ];

  const settingsNavItems = [
    { id: 'platform', icon: Store, label: '平台账号' },
    { id: 'extension', icon: Plug, label: '插件管理' },
    { id: 'signals', icon: TrendingUp, label: '市场信号' },
    { id: 'system', icon: Sliders, label: '系统参数' },
    { id: 'notification', icon: BellRing, label: '通知设置' },
    { id: 'printer', icon: Printer, label: '打印机配置' },
    { id: 'log', icon: FileText, label: '操作日志' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card sticky top-0 z-40 h-14 flex items-center justify-between px-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Box className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-base">Ozon ERP</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Bell className="w-4 h-4" />
            <span className="bg-destructive text-white text-xs px-1.5 py-0.5 rounded-full font-medium">3</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-medium text-sm">初</div>
            <span className="text-sm font-medium">小初</span>
          </div>
        </div>
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 3.5rem)' }}>
        {/* Sidebar */}
        <aside className="w-56 shrink-0 bg-card border-r border-border/50 overflow-y-auto">
          <div className="p-3 space-y-0.5">
            {navItems.map((item, index) => {
              // 处理 divider 分隔符
              if (item.type === 'divider') {
                return (
                  <div key={`divider-${index}-${item.label}`} className="pt-3 pb-1">
                    <span className="px-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">{item.label}</span>
                  </div>
                );
              }
              const Icon = item.icon;
              return (
                <Link
                  key={item.href!}
                  href={item.href!}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    item.active
                      ? 'bg-[#2F6BFF]/10 text-[#2F6BFF]'
                      : 'text-[#637089] hover:bg-[#EEF1F6] hover:text-[#152033]'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-3 pb-1">
              <span className="px-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">库存管理</span>
            </div>
            {inventoryNavItems.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors"
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-3 pb-1">
              <span className="px-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">数据中心</span>
            </div>
            {dataNavItems.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors"
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-3 pb-1">
              <span className="px-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">系统</span>
            </div>
            {systemNavItems.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    item.active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-background">
          <div className="p-6">
            {/* Page Title */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">系统设置</h1>
              <p className="text-sm text-muted-foreground mt-1">管理平台账号、系统参数和操作日志</p>
            </div>

            <div className="flex gap-6">
              {/* Left Settings Navigation */}
              <div className="w-48 shrink-0">
                <nav className="bg-card rounded-lg shadow-sm p-2">
                  {settingsNavItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md font-medium text-sm transition-colors text-left ${
                        activeSection === item.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Right Content */}
              <div className="flex-1 min-w-0">
                {/* Platform Section */}
                {activeSection === 'platform' && (
                  <div className="space-y-4">
                    {/* Ozon Shop Management */}
                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Store className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-foreground">Ozon 店铺管理</h3>
                            <p className="text-xs text-muted-foreground">支持绑定多个Ozon店铺，实现多店统一管理</p>
                          </div>
                        </div>
                        <Button onClick={() => setShowAddShopModal(true)} className="gap-1.5">
                          <Plus className="w-4 h-4" />
                          添加店铺
                        </Button>
                      </div>

                      {/* Shop List */}
                      <div className="space-y-3">
                        {loading ? (
                          <div className="text-center py-8 text-muted-foreground">加载中...</div>
                        ) : shops.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">暂无店铺，请添加</div>
                        ) : (
                          shops.map(shop => (
                            <div
                              key={shop.id}
                              className={`bg-muted/30 rounded-lg p-4 border border-border/20 ${!shop.is_active ? 'opacity-60' : ''}`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${
                                    shop.is_primary ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {shop.is_primary ? '主店铺' : '子店铺'}
                                  </span>
                                  <h4 className="text-sm font-semibold text-foreground">{shop.name}</h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${
                                    shop.is_active ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {shop.is_active ? '已启用' : '未启用'}
                                  </span>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-3 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Client ID</span>
                                  <p className="text-foreground font-mono mt-0.5">{shop.client_id}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">API Key</span>
                                  <p className="text-foreground font-mono mt-0.5">
                                    {shop.api_key || '--'}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">最后同步</span>
                                  <p className="text-foreground mt-0.5">
                                    {shop.last_sync_at ? new Date(shop.last_sync_at).toLocaleString('zh-CN') : '--'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20">
                                <button
                                  onClick={() => setEditingShop(shop)}
                                  className="text-xs text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 transition-colors"
                                >
                                  <Pencil className="w-3 h-3" />编辑
                                </button>
                                <span className="text-border">|</span>
                                <button
                                  onClick={() => handleTestConnection(shop.id)}
                                  disabled={testingShop === shop.id}
                                  className="text-xs text-muted-foreground hover:text-foreground font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                                >
                                  <Plug className="w-3 h-3" />
                                  {testingShop === shop.id ? '测试中...' : '测试连接'}
                                </button>
                                <span className="text-border">|</span>
                                <button 
                                  onClick={() => handleSyncShop(shop.id)}
                                  disabled={syncingShop === shop.id}
                                  className="text-xs text-muted-foreground hover:text-foreground font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                                >
                                  <RefreshCw className={`w-3 h-3 ${syncingShop === shop.id ? 'animate-spin' : ''}`} />
                                  {syncingShop === shop.id ? '同步中...' : '立即同步'}
                                </button>
                                {!shop.is_primary && (
                                  <>
                                    <span className="text-border">|</span>
                                    <button
                                      onClick={() => handleToggleShop(shop.id, shop.is_active)}
                                      className={`text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                                        shop.is_active
                                          ? 'text-muted-foreground hover:text-foreground'
                                          : 'text-green-600 hover:text-green-600/80'
                                      }`}
                                    >
                                      {shop.is_active ? (
                                        <>
                                          <XCircle className="w-3 h-3" />停用
                                        </>
                                      ) : (
                                        <>
                                          <Play className="w-3 h-3" />启用
                                        </>
                                      )}
                                    </button>
                                    <span className="text-border">|</span>
                                    <button
                                      onClick={() => handleDeleteShop(shop.id)}
                                      className="text-xs text-destructive hover:text-destructive/80 font-medium inline-flex items-center gap-1 transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />删除
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Test Result */}
                      {testResult && (
                        <div className={`mt-4 p-3 rounded-lg ${testResult.success ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
                          {testResult.message}
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/20 text-xs text-muted-foreground">
                        <span>
                          共绑定 <strong className="text-foreground">{shops.length}</strong> 个店铺，
                          已启用 <strong className="text-green-600">{shops.filter(s => s.is_active).length}</strong> 个
                        </span>
                        <button 
                          onClick={handleSyncAllShops}
                          disabled={syncingAll}
                          className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${syncingAll ? 'animate-spin' : ''}`} />
                          {syncingAll ? '同步中...' : '同步全部店铺'}
                        </button>
                      </div>
                    </div>

                    {/* 1688 Account */}
                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-yellow-500" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-foreground">1688 账号</h3>
                            <p className="text-xs text-muted-foreground">阿里巴巴批发平台</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-green-500/15 text-green-600">已授权</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">账号名称</Label>
                          <Input value="采购专用账号" readOnly className="mt-1.5 bg-muted" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">授权状态</Label>
                          <div className="flex items-center gap-2 h-9 mt-1.5">
                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                            <span className="text-sm text-foreground">已授权</span>
                            <span className="text-xs text-muted-foreground">（有效期至 2024-12-31）</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/20">
                        <Button variant="outline" className="gap-2">
                          <RefreshCw className="w-4 h-4" />
                          重新授权
                        </Button>
                      </div>
                    </div>

                    {/* Pinduoduo Account */}
                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-destructive" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-foreground">拼多多 账号</h3>
                            <p className="text-xs text-muted-foreground">拼多多采购平台</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-yellow-500/15 text-yellow-600">待授权</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">账号名称</Label>
                          <Input value="拼多多采购号" readOnly className="mt-1.5 bg-muted" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">授权状态</Label>
                          <div className="flex items-center gap-2 h-9 mt-1.5">
                            <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                            <span className="text-sm text-foreground">待授权</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/20">
                        <Button className="gap-2">
                          <LinkIcon className="w-4 h-4" />
                          立即授权
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* System Section */}
                {activeSection === 'system' && (
                  <div className="space-y-4">
                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <h3 className="text-base font-semibold text-foreground mb-4">汇率设置</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-3 border-b border-border/20">
                          <div>
                            <p className="text-sm font-medium text-foreground">卢布兑人民币汇率</p>
                            <p className="text-xs text-muted-foreground mt-0.5">用于将订单金额从卢布转换为人民币显示，当前汇率：1 卢布 = {rubToCny} 人民币</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number" 
                              step="0.001"
                              value={rubToCny}
                              onChange={(e) => setRubToCny(parseFloat(e.target.value) || 0)}
                              className="w-24 text-center" 
                            />
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={saveExchangeRate}
                              disabled={savingRate}
                            >
                              {savingRate ? '保存中...' : '保存'}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={fetchRealtimeRate}
                              disabled={fetchingRate}
                            >
                              {fetchingRate ? '获取中...' : '获取实时汇率'}
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          提示：点击"获取实时汇率"按钮可自动获取最新的卢布兑人民币汇率
                        </p>
                      </div>
                    </div>

                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <h3 className="text-base font-semibold text-foreground mb-4">同步设置</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-3 border-b border-border/20">
                          <div>
                            <p className="text-sm font-medium text-foreground">订单同步频率</p>
                            <p className="text-xs text-muted-foreground mt-0.5">自动从平台同步订单数据的时间间隔</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input type="number" defaultValue={30} className="w-20 text-center" />
                            <span className="text-sm text-muted-foreground">分钟</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between py-3 border-b border-border/20">
                          <div>
                            <p className="text-sm font-medium text-foreground">物流同步频率</p>
                            <p className="text-xs text-muted-foreground mt-0.5">自动同步物流信息的时间间隔</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input type="number" defaultValue={60} className="w-20 text-center" />
                            <span className="text-sm text-muted-foreground">分钟</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <h3 className="text-base font-semibold text-foreground mb-4">自动化设置</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-3 border-b border-border/20">
                          <div>
                            <p className="text-sm font-medium text-foreground">自动创建采购任务</p>
                            <p className="text-xs text-muted-foreground mt-0.5">订单确认后自动创建对应的采购任务</p>
                          </div>
                          <Checkbox defaultChecked />
                        </div>
                        <div className="flex items-center justify-between py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">SKU自动匹配</p>
                            <p className="text-xs text-muted-foreground mt-0.5">自动将订单商品与SKU库匹配</p>
                          </div>
                          <Checkbox defaultChecked />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button className="gap-2">
                        <Save className="w-4 h-4" />
                        保存设置
                      </Button>
                    </div>
                  </div>
                )}

                {/* Notification Section */}
                {activeSection === 'notification' && (
                  <div className="space-y-4">
                    {/* Ozon多店铺推送通知配置 */}
                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Plug className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-foreground">Ozon 推送通知</h3>
                          <p className="text-xs text-muted-foreground">为每个店铺配置独立的推送通知，实时接收订单状态变更、商品更新等</p>
                        </div>
                      </div>
                      
                      {/* 店铺列表 */}
                      <div className="space-y-3">
                        {shops.map((shop) => (
                          <div key={shop.id} className="border border-border/50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <Store className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground">{shop.name}</p>
                                  <p className="text-xs text-muted-foreground">Client ID: {shop.client_id}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {shop.is_primary && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">主店铺</span>
                                )}
                                <span className={`text-xs px-2 py-0.5 rounded ${shop.is_active ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                                  {shop.is_active ? '已启用' : '未启用'}
                                </span>
                              </div>
                            </div>
                            
                            {/* Webhook配置 */}
                            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium">Webhook URL</Label>
                                <div className="flex items-center gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/ozon/webhook?shop_id=${shop.id}`;
                                      navigator.clipboard.writeText(url);
                                      alert('URL已复制');
                                    }}
                                  >
                                    <Copy className="w-3 h-3 mr-1" />
                                    复制
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`/api/ozon/webhook?shop_id=${shop.id}`);
                                        const data = await res.json();
                                        alert(data.success ? '连接正常' : '连接失败');
                                      } catch {
                                        alert('验证失败');
                                      }
                                    }}
                                  >
                                    验证
                                  </Button>
                                </div>
                              </div>
                              <code className="text-xs text-primary font-mono break-all block">
                                {typeof window !== 'undefined' ? `${window.location.origin}/api/ozon/webhook?shop_id=${shop.id}` : `https://你的域名/api/ozon/webhook?shop_id=${shop.id}`}
                              </code>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* 配置说明 */}
                      <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                        <p className="text-sm font-medium text-foreground mb-2">📋 配置步骤（Ozon卖家后台）</p>
                        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                          <li>登录对应店铺的 <strong className="text-foreground">Ozon卖家后台</strong></li>
                          <li>进入 <strong className="text-foreground">设置 → 集成 → 推送通知</strong></li>
                          <li>粘贴该店铺的 <strong className="text-foreground">Webhook URL</strong></li>
                          <li>点击 <strong className="text-foreground">检查</strong> 验证连接状态</li>
                          <li>勾选需要的通知类型并保存</li>
                        </ol>
                      </div>
                      
                      {/* 支持的通知类型 */}
                      <div className="mt-4">
                        <p className="text-sm font-medium text-foreground mb-2">支持的通知类型</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { type: 'new_posting', label: '新订单', icon: '📦' },
                            { type: 'posting_cancelled', label: '订单取消', icon: '❌' },
                            { type: 'posting_status_changed', label: '状态变更', icon: '🔄' },
                            { type: 'product_stocks_changed', label: '库存变更', icon: '📊' },
                          ].map(item => (
                            <div key={item.type} className="bg-muted/30 rounded-lg px-3 py-2 text-center">
                              <span className="text-lg">{item.icon}</span>
                              <p className="text-xs text-foreground mt-1">{item.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <h3 className="text-base font-semibold text-foreground mb-4">异常订单通知</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-3 border-b border-border/20">
                          <div>
                            <p className="text-sm font-medium text-foreground">启用通知</p>
                            <p className="text-xs text-muted-foreground mt-0.5">订单异常时发送通知提醒</p>
                          </div>
                          <Checkbox defaultChecked />
                        </div>
                        <div className="py-3">
                          <p className="text-sm font-medium text-foreground mb-3">通知方式</p>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox defaultChecked />
                              <span className="text-sm text-foreground">站内消息</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox defaultChecked />
                              <span className="text-sm text-foreground">邮件通知</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox />
                              <span className="text-sm text-foreground">短信通知</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <h3 className="text-base font-semibold text-foreground mb-4">库存预警通知</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-3 border-b border-border/20">
                          <div>
                            <p className="text-sm font-medium text-foreground">启用通知</p>
                            <p className="text-xs text-muted-foreground mt-0.5">库存低于阈值时发送预警</p>
                          </div>
                          <Checkbox defaultChecked />
                        </div>
                        <div className="flex items-center justify-between py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">预警阈值</p>
                            <p className="text-xs text-muted-foreground mt-0.5">库存低于此数值时触发预警</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input type="number" defaultValue={10} className="w-20 text-center" />
                            <span className="text-sm text-muted-foreground">件</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button className="gap-2">
                        <Save className="w-4 h-4" />
                        保存设置
                      </Button>
                    </div>
                  </div>
                )}

                {/* Printer Section */}
                {activeSection === 'printer' && (
                  <div className="space-y-4">
                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <h3 className="text-base font-semibold text-foreground mb-4">面单打印机</h3>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">选择打印机</Label>
                          <Select defaultValue="printer-a">
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="printer-a">打印机 A - Zebra ZT410</SelectItem>
                              <SelectItem value="printer-b">打印机 B - HP LaserJet</SelectItem>
                              <SelectItem value="printer-c">打印机 C - Brother QL-800</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">打印纸尺寸</Label>
                          <Select defaultValue="100x150">
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="100x150">100mm × 150mm (标准面单)</SelectItem>
                              <SelectItem value="100x100">100mm × 100mm (小面单)</SelectItem>
                              <SelectItem value="100x180">100mm × 180mm (大面单)</SelectItem>
                              <SelectItem value="custom">自定义尺寸</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button className="gap-2">
                        <Save className="w-4 h-4" />
                        保存设置
                      </Button>
                    </div>
                  </div>
                )}

                {/* Extension Management Section */}
                {activeSection === 'extension' && (
                  <div className="space-y-4">
                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Plug className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-foreground">Chrome 插件管理</h3>
                            <p className="text-xs text-muted-foreground">管理插件API密钥，用于从Ozon/WB采集商品数据</p>
                          </div>
                        </div>
                      </div>
                      <ExtensionKeyManager />
                    </div>
                  </div>
                )}

                {/* Market Signals Section */}
                {activeSection === 'signals' && (
                  <div className="space-y-4">
                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-foreground">市场信号数据</h3>
                            <p className="text-xs text-muted-foreground">插件采集的商品数据，供选品引擎分析</p>
                          </div>
                        </div>
                      </div>
                      <MarketSignalsList />
                    </div>
                  </div>
                )}

                {/* Log Section */}
                {activeSection === 'log' && (
                  <div className="space-y-4">
                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-foreground">Ozon 推送通知日志</h3>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/notifications/logs?type=ozon_notification&limit=50');
                              const data = await res.json();
                              if (data.success) {
                                console.log('通知日志:', data.data.logs);
                              }
                            } catch (e) {
                              console.error('刷新日志失败:', e);
                            }
                          }}
                        >
                          <RefreshCw className="w-4 h-4 mr-1.5" />
                          刷新
                        </Button>
                      </div>
                      
                      {/* 日志列表将通过客户端渲染 */}
                      <NotificationLogList />
                    </div>
                    
                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <h3 className="text-base font-semibold text-foreground mb-4">操作日志</h3>
                      <div className="text-center py-8 text-muted-foreground">
                        暂无操作日志
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add Shop Modal */}
      <Dialog open={showAddShopModal} onOpenChange={setShowAddShopModal}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>添加Ozon店铺</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>店铺名称 <span className="text-destructive">*</span></Label>
              <Input
                placeholder="请输入店铺名称"
                value={newShop.name}
                onChange={(e) => setNewShop({ ...newShop, name: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Client ID <span className="text-destructive">*</span></Label>
              <Input
                placeholder="请输入Ozon应用的Client ID"
                value={newShop.client_id}
                onChange={(e) => setNewShop({ ...newShop, client_id: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>API Key <span className="text-destructive">*</span></Label>
              <Input
                type="password"
                placeholder="请输入Ozon应用的API Key"
                value={newShop.api_key}
                onChange={(e) => setNewShop({ ...newShop, api_key: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="set-as-main"
                checked={newShop.is_primary}
                onCheckedChange={(checked) => setNewShop({ ...newShop, is_primary: !!checked })}
              />
              <label htmlFor="set-as-main" className="text-sm text-foreground cursor-pointer">设为主店铺</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddShopModal(false)}>
              取消
            </Button>
            <Button onClick={handleAddShop} className="gap-2">
              <Plus className="w-4 h-4" />
              添加店铺
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Shop Modal */}
      <Dialog open={!!editingShop} onOpenChange={(open) => !open && setEditingShop(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>编辑店铺</DialogTitle>
          </DialogHeader>
          {editingShop && (
            <>
              <div className="space-y-4 py-4">
                <div>
                  <Label>店铺名称 <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="请输入店铺名称"
                    value={editingShop.name}
                    onChange={(e) => setEditingShop({ ...editingShop, name: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Client ID <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="请输入Ozon应用的Client ID"
                    value={editingShop.client_id}
                    onChange={(e) => setEditingShop({ ...editingShop, client_id: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>API Key <span className="text-destructive">*</span></Label>
                  <Input
                    type="password"
                    placeholder="请输入Ozon应用的API Key"
                    value={editingShop.api_key}
                    onChange={(e) => setEditingShop({ ...editingShop, api_key: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-set-as-main"
                    checked={editingShop.is_primary}
                    onCheckedChange={(checked) => setEditingShop({ ...editingShop, is_primary: !!checked })}
                  />
                  <label htmlFor="edit-set-as-main" className="text-sm text-foreground cursor-pointer">设为主店铺</label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingShop(null)}>
                  取消
                </Button>
                <Button onClick={handleEditShop} className="gap-2">
                  <Save className="w-4 h-4" />
                  保存修改
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
