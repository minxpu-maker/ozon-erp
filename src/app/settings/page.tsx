'use client';

import { useState, useEffect } from 'react';
import { 
  Store, Plus, Pencil, Plug, RefreshCw, Trash2, Play, MoreVertical,
  ShoppingBag, ShoppingCart, Link as LinkIcon, Sliders, BellRing, 
  Printer, FileText, Save, CheckCircle, XCircle, Bell, Settings as SettingsIcon,
  LayoutDashboard, Package, ClipboardList, Truck, Box, Calculator,
  PackageSearch, Warehouse, Database, Users, BarChart3, UserCircle, Shield
} from 'lucide-react';
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

export default function SettingsPage() {
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

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: '仪表盘', href: '/dashboard' },
    { id: 'orders', icon: ShoppingCart, label: '订单管理', href: '/orders' },
    { id: 'purchase', icon: Package, label: '采购管理', href: '/purchase' },
    { id: 'quick-entry', icon: ClipboardList, label: '快捷录单', href: '/quick-entry' },
    { id: 'logistics', icon: Truck, label: '物流追踪', href: '/logistics' },
    { id: 'packaging', icon: Box, label: '打包流程', href: '/packaging' },
    { id: 'finance', icon: Calculator, label: '财务核算', href: '/finance' },
  ];

  const inventoryNavItems = [
    { id: 'inventory', icon: PackageSearch, label: '库存管理', href: '/inventory' },
    { id: 'wms', icon: Warehouse, label: '仓库管理', href: '/wms' },
  ];

  const dataNavItems = [
    { id: 'sku-management', icon: Database, label: 'SKU管理', href: '/sku-management' },
    { id: 'suppliers', icon: Users, label: '供应商管理', href: '/suppliers' },
    { id: 'reports', icon: BarChart3, label: '数据报表', href: '/reports' },
  ];

  const systemNavItems = [
    { id: 'accounts', icon: UserCircle, label: '账号管理', href: '/accounts' },
    { id: 'roles', icon: Shield, label: '角色权限', href: '/roles' },
    { id: 'settings', icon: SettingsIcon, label: '系统设置', href: '/settings', active: true },
  ];

  const settingsNavItems = [
    { id: 'platform', icon: Store, label: '平台账号' },
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
            {navItems.map(item => (
              <a
                key={item.id}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </a>
            ))}
            <div className="pt-3 pb-1">
              <span className="px-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">库存管理</span>
            </div>
            {inventoryNavItems.map(item => (
              <a
                key={item.id}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </a>
            ))}
            <div className="pt-3 pb-1">
              <span className="px-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">数据中心</span>
            </div>
            {dataNavItems.map(item => (
              <a
                key={item.id}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </a>
            ))}
            <div className="pt-3 pb-1">
              <span className="px-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">系统</span>
            </div>
            {systemNavItems.map(item => (
              <a
                key={item.id}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                  item.active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </a>
            ))}
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
                                    {shop.api_key ? `${shop.api_key.slice(0, 6)}...${shop.api_key.slice(-4)}` : '--'}
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
                                <button className="text-xs text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 transition-colors">
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
                                <button className="text-xs text-muted-foreground hover:text-foreground font-medium inline-flex items-center gap-1 transition-colors">
                                  <RefreshCw className="w-3 h-3" />立即同步
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
                        <button className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 transition-colors">
                          <RefreshCw className="w-3 h-3" />同步全部店铺
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
                    {/* Ozon推送通知配置 */}
                    <div className="bg-card rounded-lg shadow-sm p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Plug className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-foreground">Ozon 推送通知</h3>
                          <p className="text-xs text-muted-foreground">实时接收Ozon平台的订单状态变更、商品更新等通知</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        {/* Webhook URL */}
                        <div className="bg-muted/50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-medium">Webhook URL</Label>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                const url = `${window.location.origin}/api/ozon/webhook`;
                                navigator.clipboard.writeText(url);
                                alert('URL已复制到剪贴板');
                              }}
                            >
                              复制URL
                            </Button>
                          </div>
                          <code className="text-sm text-primary font-mono break-all">
                            {typeof window !== 'undefined' ? `${window.location.origin}/api/ozon/webhook` : 'https://你的域名/api/ozon/webhook'}
                          </code>
                        </div>
                        
                        {/* 配置步骤 */}
                        <div className="border border-border/50 rounded-lg p-4">
                          <p className="text-sm font-medium text-foreground mb-3">配置步骤（在Ozon卖家后台）</p>
                          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                            <li>进入 <strong className="text-foreground">设置 → 集成</strong></li>
                            <li>启用 <strong className="text-foreground">推送通知</strong> 功能</li>
                            <li>粘贴上方Webhook URL并点击 <strong className="text-foreground">检查</strong></li>
                            <li>选择需要的 <strong className="text-foreground">通知类型</strong></li>
                            <li>保存设置</li>
                          </ol>
                        </div>
                        
                        {/* 支持的通知类型 */}
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">支持的通知类型</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { type: 'new_posting', label: '新货件', desc: '创建新订单' },
                              { type: 'posting_cancelled', label: '发货取消', desc: '订单取消' },
                              { type: 'posting_status_changed', label: '状态变更', desc: '订单状态变化' },
                              { type: 'product_stocks_changed', label: '库存变更', desc: '商品库存变化' },
                            ].map(item => (
                              <div key={item.type} className="bg-primary/5 rounded-lg px-3 py-2">
                                <p className="text-sm font-medium text-foreground">{item.label}</p>
                                <p className="text-xs text-muted-foreground">{item.desc}</p>
                              </div>
                            ))}
                          </div>
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
    </div>
  );
}
