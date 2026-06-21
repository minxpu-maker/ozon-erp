'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, Plug, Copy, Trash2, CheckCircle, AlertCircle, Loader2,
  HelpCircle, Info, Zap, ChevronDown, ChevronUp, Key, Store,
  ExternalLink, Download, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast, ToastProvider, ToastContainer } from '@/hooks/useToast';

interface ApiKey {
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
  isExpired?: boolean;
  status?: string;
}

interface Shop {
  id: string;
  name: string;
}

// 权限说明映射
const permissionLabels: Record<string, string> = {
  'read:signals': '读取市场信号',
  'write:signals': '推送市场信号',
  'read:opportunities': '读取选品机会',
};

export default function ExtensionSettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 使用说明折叠状态：首次展开，配置过后（有Key）默认折叠
  const [helpExpanded, setHelpExpanded] = useState(true);
  
  // 创建Key弹窗
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState({ shopId: '', deviceInfo: '' });
  const [creating, setCreating] = useState(false);
  
  // 新创建的Key显示
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // 删除确认弹窗
  const [deleteKeyId, setDeleteKeyId] = useState<number | null>(null);
  const [deleteKeyShopId, setDeleteKeyShopId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // 禁用/启用操作
  const [togglingKeyId, setTogglingKeyId] = useState<number | null>(null);

  useEffect(() => {
    loadKeys();
    loadShops();
  }, []);

  // 配置过后（有Key）自动折叠使用说明
  useEffect(() => {
    if (keys.length > 0 && helpExpanded) {
      setHelpExpanded(false);
    }
  }, [keys.length]);

  const loadShops = async () => {
    try {
      const res = await fetch('/api/shops');
      const data = await res.json();
      if (data.success) {
        setShops(data.data);
      } else {
        console.error('加载店铺失败:', data.error);
      }
    } catch (e) {
      console.error('加载店铺失败:', e);
      setError('加载店铺列表失败');
    }
  };

  const loadKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/extension-api-keys');
      const data = await res.json();
      if (data.success) {
        setKeys(data.data);
      } else {
        setError(data.error || '加载失败');
      }
    } catch (e) {
      console.error('加载Keys失败:', e);
      setError('加载API密钥列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyData.shopId) {
      toast.error('请选择绑定的店铺');
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
        setShowKeyModal(true);
        setNewKeyData({ shopId: '', deviceInfo: '' });
        setShowCreateModal(false);
        loadKeys();
        toast.success('API Key 已生成');
      } else {
        toast.error(data.error || '创建失败');
      }
    } catch (e) {
      console.error('创建Key失败:', e);
      toast.error('创建失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopySuccess(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => {
        setCopySuccess(false);
        setShowKeyModal(false);
        setNewlyCreatedKey(null);
      }, 1500);
    } catch (e) {
      console.error('复制失败:', e);
      toast.error('复制失败，请手动复制');
    }
  };

  const handleToggleKey = async (id: number, shopId: string, currentStatus: boolean) => {
    try {
      setTogglingKeyId(id);
      const res = await fetch(`/api/extension-api-keys?id=${id}&shopId=${shopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: currentStatus ? 'disabled' : 'active' }),
      });
      const data = await res.json();
      if (data.success) {
        loadKeys();
        toast.success(currentStatus ? '已禁用' : '已启用');
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch (e) {
      console.error('切换状态失败:', e);
      toast.error('操作失败，请重试');
    } finally {
      setTogglingKeyId(null);
    }
  };

  const handleDeleteKey = async () => {
    if (!deleteKeyId || !deleteKeyShopId) return;
    try {
      const res = await fetch(`/api/extension-api-keys?id=${deleteKeyId}&shopId=${deleteKeyShopId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        loadKeys();
        toast.success('已删除');
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch (e) {
      console.error('删除Key失败:', e);
      toast.error('删除失败，请重试');
    } finally {
      setShowDeleteDialog(false);
      setDeleteKeyId(null);
      setDeleteKeyShopId(null);
    }
  };

  const openDeleteDialog = (id: number, shopId: string) => {
    setDeleteKeyId(id);
    setDeleteKeyShopId(shopId);
    setShowDeleteDialog(true);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <Toaster position="top-center" richColors />
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Key className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">插件设置</h1>
            <p className="text-sm text-muted-foreground">管理Chrome插件的API Key，配置数据采集</p>
          </div>
        </div>
      </div>

      {/* 区域一：使用说明 */}
      <div className="bg-card rounded-lg shadow-sm border border-border/50 mb-6">
        <button
          onClick={() => setHelpExpanded(!helpExpanded)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Plug className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground">Chrome插件配置步骤</span>
          </div>
          {helpExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {helpExpanded && (
          <div className="px-5 pb-4 pt-0">
            <div className="bg-muted/30 rounded-lg p-4 border border-border/20">
              <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">1.</span>
                  <span>点击下方「生成新Key」创建API Key</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">2.</span>
                  <span>安装Chrome插件（下载链接在页面底部）</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">3.</span>
                  <span>在插件设置中粘贴API Key + 店铺ID</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">4.</span>
                  <span>插件采集商品数据后会自动推送到本系统</span>
                </li>
              </ol>
              <div className="mt-4 pt-3 border-t border-border/20 text-xs text-muted-foreground">
                <p><strong>鉴权方式：</strong>Bearer Token，请求头格式 <code className="bg-muted px-1.5 py-0.5 rounded ml-1">Authorization: Bearer ozon_ext_xxx</code></p>
                <p className="mt-1"><strong>接口地址：</strong><code className="bg-muted px-1.5 py-0.5 rounded ml-1">POST /api/market-signals/batch</code></p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 区域二：生成新Key */}
      <div className="bg-card rounded-lg shadow-sm border border-border/50 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">生成新API Key</h3>
              <p className="text-xs text-muted-foreground">为Chrome插件创建数据推送凭证</p>
            </div>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            生成新Key
          </Button>
        </div>
      </div>

      {/* 区域三：Key列表 */}
      <div className="bg-card rounded-lg shadow-sm border border-border/50 p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Info className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">已生成的API Key</h3>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto hover:opacity-70">×</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Plug className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>暂无API密钥</p>
            <p className="text-xs mt-1">生成密钥后，Chrome插件可使用此密钥采集数据</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Key</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">绑定店铺</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">创建时间</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">最后使用</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">过期时间</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">状态</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id} className={`border-b border-border/30 ${!key.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <code className="text-sm font-mono text-foreground">
                        {key.keyPrefix}_****{key.id.toString().padStart(4, '0').slice(-4)}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{key.shopName || key.shopId}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(key.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString('zh-CN') : '从未使用'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(key.expiresAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      {key.isExpired ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-destructive/15 text-destructive">
                          🔴 已过期
                        </span>
                      ) : key.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/15 text-green-600">
                          🟢 启用
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                          🔴 禁用
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {togglingKeyId === key.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            {!key.isExpired && (
                              <button
                                onClick={() => handleToggleKey(key.id, key.shopId, key.isActive)}
                                className="text-xs text-primary hover:text-primary/80 font-medium"
                              >
                                {key.isActive ? '禁用' : '启用'}
                              </button>
                            )}
                            <button
                              onClick={() => openDeleteDialog(key.id, key.shopId)}
                              className="text-xs text-destructive hover:text-destructive/80 font-medium"
                            >
                              删除
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 区域四：下载链接 */}
      <div className="bg-card rounded-lg shadow-sm border border-border/50 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Download className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Chrome插件下载</h3>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" className="gap-1.5" disabled>
            <ExternalLink className="w-4 h-4" />
            Chrome商店下载（即将上线）
          </Button>
          <Button variant="outline" className="gap-1.5" disabled>
            <Download className="w-4 h-4" />
            CRX文件下载（即将提供）
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          插件正在开发中，请稍候。届时将提供Chrome商店链接和CRX文件直接下载。
        </p>
      </div>

      {/* 创建Key弹窗 */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>生成新API Key</DialogTitle>
            <DialogDescription>
              创建一个新的API密钥，用于Chrome插件数据推送
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                placeholder="例如：Chrome on Windows"
                value={newKeyData.deviceInfo}
                onChange={(e) => setNewKeyData({ ...newKeyData, deviceInfo: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>取消</Button>
            <Button onClick={handleCreateKey} disabled={creating}>
              {creating ? '生成中...' : '生成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新Key显示弹窗 */}
      <Dialog open={showKeyModal} onOpenChange={(open) => {
        if (!open && !copySuccess) {
          // 提示用户复制
          toast.warning('请确保已复制Key，关闭后无法再次查看完整Key');
        }
        setShowKeyModal(open);
        if (!open) {
          setNewlyCreatedKey(null);
          setCopySuccess(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              API Key 已生成
            </DialogTitle>
            <DialogDescription className="text-destructive font-medium">
              ⚠️ 仅显示一次，请立即复制！
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted rounded-lg p-4">
              <code className="text-sm font-mono text-foreground break-all">
                {newlyCreatedKey}
              </code>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              请将此Key粘贴到Chrome插件的设置页面中。关闭此窗口后，系统不会再次显示完整的Key。
            </p>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => newlyCreatedKey && handleCopyKey(newlyCreatedKey)}
              className="gap-1.5"
            >
              {copySuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  复制Key
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后插件将无法推送数据，确认要删除此API Key吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false);
              setDeleteKeyId(null);
              setDeleteKeyShopId(null);
            }}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKey} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}