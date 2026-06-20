'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Shop {
  id: string;
  shopName: string;
  ozonClientId: string;
  ozonApiKey?: string;
  apiKey: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  platform?: string;
}

interface KeyStatus {
  shopId: string;
  shopName: string;
  status: 'valid' | 'invalid' | 'checking' | 'error';
  error?: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ShopsPage() {
  const { data: res, mutate } = useSWR('/api/shops', fetcher);
  const shops: Shop[] = res?.shops ?? [];
  const total = res?.total ?? 0;

  // 密钥状态检测
  const { data: keyStatusData } = useSWR(
    shops.length > 0 ? '/api/shops/key-status' : null,
    fetcher,
    { refreshInterval: 60000 } // 每分钟检测一次
  );
  // API返回的是 shops 数组，statuses 兼容处理
  const keyStatuses: KeyStatus[] = keyStatusData?.shops ?? keyStatusData?.statuses ?? [];
  const keyStatusMap: Record<string, KeyStatus> = keyStatuses.reduce((acc, k) => {
    acc[k.shopId] = k;
    return acc;
  }, {} as Record<string, KeyStatus>);
  
  // 统计密钥失效的店铺（包括 invalid 和 error 状态）
  const invalidShops = keyStatuses.filter(k => k.status === 'invalid' || k.status === 'error');
  const hasInvalidKeys = invalidShops.length > 0;

  const [showDialog, setShowDialog] = useState(false);
  const [editShop, setEditShop] = useState<Shop | null>(null);
  const [formShopName, setFormShopName] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteShop, setDeleteShop] = useState<Shop | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openAdd = () => {
    setEditShop(null);
    setFormShopName('');
    setFormClientId('');
    setFormApiKey('');
    setShowDialog(true);
  };

  const openEdit = (shop: Shop) => {
    setEditShop(shop);
    setFormShopName(shop.shopName);
    setFormClientId(shop.ozonClientId);
    setFormApiKey('');
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formShopName.trim() || !formClientId.trim()) {
      alert('请填写店铺名称和Client-Id');
      return;
    }
    if (!editShop && !formApiKey.trim()) {
      alert('新增店铺必须填写Api-Key');
      return;
    }
    setSaving(true);
    try {
      const url = editShop ? `/api/shops/${editShop.id}` : '/api/shops';
      const method = editShop ? 'PUT' : 'POST';
      const body: Record<string, string> = {
        shopName: formShopName.trim(),
        ozonClientId: formClientId.trim(),
      };
      if (formApiKey.trim()) {
        body.ozonApiKey = formApiKey.trim();
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '保存失败');
      }
      setShowDialog(false);
      setEditShop(null);
      mutate();
      alert(editShop ? '店铺已更新' : '店铺已新增');
    } catch (e: unknown) {
      alert((e as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 方式一：前端直调 Ozon API（浏览器网络，可访问外网）
  const testDirectly = async (shopId: string): Promise<{ connected: boolean; error?: string }> => {
    try {
      // 1. 从服务端获取解密后的凭证
      const credRes = await fetch(`/api/shops/${shopId}/credentials`);
      const credData = await credRes.json();
      if (!credData.success) return { connected: false, error: credData.error || '获取凭证失败' };
      const { ozonClientId, ozonApiKey } = credData.data;

      // 2. 浏览器直调 Ozon API
      const ozonRes = await fetch('https://api-seller.ozon.ru/v3/product/list', {
        method: 'POST',
        headers: {
          'Client-Id': ozonClientId,
          'Api-Key': ozonApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filter: { category_id: 0 }, limit: 1 }),
      });
      
      const responseText = await ozonRes.text();
      
      // 尝试解析 JSON
      let responseData: { code?: number; message?: string; result?: unknown; items?: unknown[] } | null = null;
      if (responseText) {
        try {
          responseData = JSON.parse(responseText);
        } catch {
          // JSON 解析失败
        }
      }
      
      // 优先检查 HTTP 状态码
      if (!ozonRes.ok) {
        return { 
          connected: false, 
          error: `HTTP ${ozonRes.status}: ${responseText?.slice(0, 100) || '无响应'}` 
        };
      }
      
      // 检查 Ozon API 业务错误（code > 0 表示错误）
      if (responseData && typeof responseData.code === 'number' && responseData.code > 0) {
        return { 
          connected: false, 
          error: responseData.message || `API错误 (code: ${responseData.code})` 
        };
      }
      
      // 检查响应体是否包含成功数据
      if (responseData && (responseData.result !== undefined || responseData.items !== undefined)) {
        return { connected: true };
      }
      
      // 响应体为空或格式异常，视为失败
      return { 
        connected: false, 
        error: responseData?.message || '响应格式异常，无法确定连接状态' 
      };
      
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('net::') || msg.includes('CORS')) {
        return { connected: false, error: 'CORS阻止直调，请安装Chrome插件绕过' };
      }
      return { connected: false, error: msg };
    }
  };

  const testViaServer = async (shopId: string): Promise<{ connected: boolean; error?: string }> => {
    const res = await fetch(`/api/shops/${shopId}/test-connection`, { method: 'POST' });
    const data = await res.json();
    // 确保返回正确的格式
    if (data.connected === true) {
      return { connected: true };
    }
    return { connected: false, error: data.error || '服务端连接失败' };
  };

  // 通过 Chrome 插件桥接（备用）
  const testViaExtension = async (_shopId: string, _ozonClientId: string, _ozonApiKey: string): Promise<{ connected: boolean; error?: string }> => {
    const win = window as unknown as Record<string, unknown>;
    const relay = win.__ozonExtensionRelay as { ozonApiCall: (p: {
      shopId: string; ozonClientId: string; ozonApiKey: string;
      method: 'GET' | 'POST'; path: string; body?: Record<string, unknown>;
    }) => Promise<{ connected: boolean; error?: string; data?: unknown }> } | undefined;
    if (!relay) return { connected: false, error: '插件未安装' };
    return relay.ozonApiCall({
      shopId: _shopId, ozonClientId: _ozonClientId, ozonApiKey: _ozonApiKey,
      method: 'POST', path: '/v1/product/list', body: { limit: 1 },
    });
  };

  const handleTestConnection = async (shopId: string) => {
    setTestingId(shopId);
    try {
      // 1. 优先：前端直调 Ozon API（浏览器网络访问外网，无沙箱限制）
      const directResult = await testDirectly(shopId);
      if (directResult.connected) {
        alert('✅ 连接正常，API密钥验证通过（浏览器直连）');
        setTestingId(null);
        return;
      }
      // 显示浏览器直调结果（包含真实错误码，方便诊断）
      alert('⚠️ 浏览器直调：' + directResult.error + '\n\n将尝试服务端代理...');

      // 2. 降级：服务端 API（沙箱服务器无法访问外网，此处必定失败）
      const serverResult = await testViaServer(shopId);
      if (serverResult.connected) {
        alert('✅ 连接正常，API密钥验证通过');
        setTestingId(null);
        return;
      }
      alert('⚠️ 服务端代理：' + serverResult.error);
      // 继续尝试插件（如果有）

      const credRes = await fetch(`/api/shops/${shopId}/credentials`);
      const credData = await credRes.json();
      const cred = credData?.data;
      if (cred?.ozonClientId && cred?.ozonApiKey) {
        const extResult = await testViaExtension(shopId, cred.ozonClientId, cred.ozonApiKey);
        if (extResult.connected) {
          alert('✅ 连接正常，API密钥验证通过（通过浏览器插件）');
        } else {
          alert('❌ 连接失败：' + (extResult.error || '未知错误'));
        }
      } else {
        alert('❌ 直连和插件均失败，服务端也无法连接（沙箱网络限制）');
      }
    } catch {
      alert('测试请求失败');
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (shop: Shop) => {
    const next = !shop.isActive;
    try {
      await fetch(`/api/shops/${shop.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      mutate();
      alert(`店铺已${next ? '启用' : '停用'}`);
    } catch {
      alert(`${next ? '启用' : '停用'}失败`);
    }
  };

  const handleDelete = async () => {
    if (!deleteShop) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/shops/${deleteShop.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        mutate();
        setDeleteShop(null);
        alert('店铺已删除');
      } else {
        alert(data.error || '删除失败');
      }
    } catch {
      alert('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout title="店铺管理" subtitle="管理Ozon店铺API密钥，支持多店铺统一管理">
      {/* 密钥失效警告 */}
      {hasInvalidKeys && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-red-500 text-lg">⚠️</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-700 text-sm">API密钥已失效</h3>
              <p className="text-xs text-red-600 mt-1">
                以下 {invalidShops.length} 个店铺的API密钥已过期或被禁用，订单同步将无法进行：
              </p>
              <div className="mt-2 space-y-1">
                {invalidShops.map(shop => (
                  <div key={shop.shopId} className="flex items-center gap-2 text-xs">
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">
                      {shop.shopName}
                    </span>
                    {shop.error && (
                      <span className="text-red-500/70">{shop.error}</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-red-600 mt-2">
                请前往 <a href="https://seller.ozon.ru/settings/api-keys" target="_blank" rel="noopener noreferrer" className="underline font-medium">Ozon Seller后台</a> 重新生成API密钥，然后点击「编辑」更新。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E6EAF2] p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-[#152033]">店铺列表</h2>
            <p className="text-xs text-[#637089] mt-0.5">已绑定 {shops.length} 个店铺</p>
          </div>
          <Button className="bg-[#2F6BFF] hover:bg-[#2F6BFF]/90" onClick={openAdd}>
            + 新增店铺
          </Button>
        </div>

        <div className="space-y-3">
          {shops.map(shop => (
            <div key={shop.id} className="bg-[#F6F8FB] rounded-lg border border-[#E6EAF2] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#2F6BFF] rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  OZ
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[#152033] text-sm">{shop.shopName}</p>
                    {/* 密钥状态徽章 */}
                    {shop.ozonApiKey && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        keyStatusMap[shop.id]?.status === 'valid'
                          ? 'bg-green-100 text-green-700'
                          : (keyStatusMap[shop.id]?.status === 'invalid' || keyStatusMap[shop.id]?.status === 'error')
                          ? 'bg-red-100 text-red-700'
                          : keyStatusMap[shop.id]?.status === 'checking'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {keyStatusMap[shop.id]?.status === 'valid' ? '✓ 正常' : 
                         (keyStatusMap[shop.id]?.status === 'invalid' || keyStatusMap[shop.id]?.status === 'error') ? '✗ 已失效' : 
                         keyStatusMap[shop.id]?.status === 'checking' ? '检测中...' : 
                         '? 未知'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#637089]">
                    Ozon · Client-Id: {shop.ozonClientId}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleTestConnection(shop.id)}
                  disabled={testingId === shop.id}
                >
                  {testingId === shop.id ? '测试中...' : '测试连接'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleToggleActive(shop)}
                >
                  {shop.isActive ? '停用' : '启用'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => openEdit(shop)}
                >
                  编辑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300"
                  onClick={() => setDeleteShop(shop)}
                >
                  删除
                </Button>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  shop.isActive
                    ? 'bg-[#16A37B]/10 text-[#16A37B]'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {shop.isActive ? '活跃' : '停用'}
                </span>
              </div>
            </div>
          ))}

          {shops.length === 0 && (
            <div className="bg-[#F6F8FB] rounded-lg border border-dashed border-[#E6EAF2] p-8 text-center">
              <p className="text-3xl mb-2">🏪</p>
              <p className="text-sm text-[#637089]">暂无店铺</p>
              <p className="text-xs text-gray-300 mt-1">点击「+ 新增店铺」添加第一个Ozon店铺</p>
            </div>
          )}
        </div>

        {shops.length > 0 && (
          <p className="text-xs text-[#637089] mt-3">
            最后同步: {shops[0]?.lastSyncedAt ? new Date(shops[0].lastSyncedAt).toLocaleString('zh-CN') : '—'}
          </p>
        )}
      </div>

      {/* 新增/编辑 Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { if (!v) { setShowDialog(false); setEditShop(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editShop ? '编辑店铺' : '新增店铺'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-[#152033] mb-1.5 block">
                店铺名称 <span className="text-red-500">*</span>
              </label>
              <Input
                value={formShopName}
                onChange={e => setFormShopName(e.target.value)}
                placeholder="如: TIANTAN"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#152033] mb-1.5 block">
                Client-Id <span className="text-red-500">*</span>
              </label>
              <Input
                value={formClientId}
                onChange={e => setFormClientId(e.target.value)}
                placeholder="Ozon Client-Id"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#152033] mb-1.5 block">
                Api-Key {editShop ? '（留空则不修改）' : ''} {!editShop && <span className="text-red-500">*</span>}
              </label>
              <Input
                type="password"
                value={formApiKey}
                onChange={e => setFormApiKey(e.target.value)}
                placeholder={editShop ? '留空则保持原密钥不变' : 'Ozon Api-Key（加密存储）'}
              />
              {editShop && (
                <p className="text-xs text-[#637089] mt-1">当前密钥: ••••••••（已加密存储）</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditShop(null); }}>
              取消
            </Button>
            <Button
              className="bg-[#2F6BFF] hover:bg-[#2F6BFF]/90"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={!!deleteShop} onOpenChange={v => { if (!v) setDeleteShop(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-[#637089]">
              确定要删除店铺 <span className="font-medium text-[#152033]">{deleteShop?.shopName}</span> 吗？
            </p>
            <p className="text-xs text-red-500 mt-2">删除后，与该店铺关联的订单数据不会丢失，但将无法继续同步新订单。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteShop(null)} disabled={deleting}>
              取消
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
