'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Shop {
  id: string;
  shopName: string;
  ozonClientId: string;
  apiKey: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ShopsPage() {
  const { data: res, mutate } = useSWR('/api/shops', fetcher);
  const shops: Shop[] = res?.data ?? [];

  const [showDialog, setShowDialog] = useState(false);
  const [editShop, setEditShop] = useState<Shop | null>(null);
  const [formShopName, setFormShopName] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const [testingId, setTestingId] = useState<string | null>(null);

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

  // 通过 Chrome 插件桥接（浏览器网络，可访问外网）
  const testViaExtension = async (shopId: string, ozonClientId: string, ozonApiKey: string): Promise<{ connected: boolean; error?: string }> => {
    const win = window as unknown as Record<string, unknown>;
    const relay = win.__ozonExtensionRelay as { ozonApiCall: (p: {
      shopId: string; ozonClientId: string; ozonApiKey: string;
      method: 'GET' | 'POST'; path: string; body?: Record<string, unknown>;
    }) => Promise<{ connected: boolean; error?: string; data?: unknown }> } | undefined;
    if (!relay) return { connected: false, error: '插件未安装' };
    return relay.ozonApiCall({
      shopId,
      ozonClientId,
      ozonApiKey,
      method: 'POST',
      path: '/v1/product/list',
      body: { limit: 1 },
    });
  };

  // 通过服务端 API 测试
  const testViaServer = async (shopId: string): Promise<{ connected: boolean; error?: string }> => {
    const res = await fetch(`/api/shops/${shopId}/test-connection`, { method: 'POST' });
    const data = await res.json();
    return data;
  };

  const handleTestConnection = async (shopId: string) => {
    setTestingId(shopId);
    try {
      // 1. 优先尝试 Chrome 插件桥接（浏览器网络，可访问外网）
      const extAvailable = (window as unknown as Record<string, unknown>).__ozonExtensionRelay !== undefined;
      if (extAvailable) {
        const credRes = await fetch(`/api/shops/${shopId}/credentials`);
        const credData = await credRes.json();
        const cred = credData?.data;
        if (cred?.ozonClientId && cred?.ozonApiKey) {
          const extResult = await testViaExtension(shopId, cred.ozonClientId, cred.ozonApiKey);
          if (extResult.connected) {
            alert('✅ 连接正常，API密钥验证通过（通过浏览器插件）');
            setTestingId(null);
            return;
          } else if (extResult.error) {
            alert('❌ 连接失败：' + extResult.error);
            setTestingId(null);
            return;
          }
        }
      }
      // 2. 降级到服务端 API
      const result = await testViaServer(shopId);
      if (result.connected) {
        alert('✅ 连接正常，API密钥验证通过');
      } else {
        alert('❌ 连接失败：' + (result.error || '请检查API密钥'));
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

  return (
    <AppLayout title="店铺管理" subtitle="管理Ozon店铺API密钥，支持多店铺统一管理">
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
                  <p className="font-medium text-[#152033] text-sm">{shop.shopName}</p>
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
    </AppLayout>
  );
}
