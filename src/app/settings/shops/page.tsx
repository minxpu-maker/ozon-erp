'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast, Toaster } from 'sonner';

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
  const { data: shops = [], isLoading, mutate } = useSWR<Shop[]>('/api/shops', fetcher);

  const [showDialog, setShowDialog] = useState(false);
  const [editShop, setEditShop] = useState<Shop | null>(null);
  const [formShopName, setFormShopName] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [saving, setSaving] = useState(false);

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
    setFormClientId(shop.clientId);
    setFormApiKey('');
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formShopName.trim() || !formClientId.trim()) {
      toast.error('请填写店铺名称和Client-Id');
      return;
    }
    if (!editShop && !formApiKey.trim()) {
      toast.error('新增店铺必须填写Api-Key');
      return;
    }
    setSaving(true);
    try {
      const url = editShop ? `/api/shops/${editShop.id}` : '/api/shops';
      const method = editShop ? 'PUT' : 'POST';
      const body: Record<string, string> = {
        shopName: formShopName.trim(),
        clientId: formClientId.trim(),
      };
      if (formApiKey.trim()) body.apiKey = formApiKey.trim();
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
      toast.success(editShop ? '店铺已更新' : '店铺已新增');
    } catch (e: any) {
      toast.error(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      {/* 顶部操作栏 */}
      <div className="bg-white border-b border-[#E6EAF2] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#152033]">店铺管理</h1>
          <p className="text-sm text-[#637089] mt-0.5">管理Ozon店铺API密钥，支持多店铺统一管理</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-[#2F6BFF] text-white text-sm font-medium rounded-lg hover:bg-[#2F6BFF]/90 transition-colors">
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
      {/* 新增/编辑店铺Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) setEditShop(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editShop ? '编辑店铺' : '新增店铺'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-[#152033] mb-1.5">
                店铺名称 <span className="text-red-500">*</span>
              </label>
              <Input
                value={formShopName}
                onChange={(e) => setFormShopName(e.target.value)}
                placeholder="如: TIANTAN"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#152033] mb-1.5">
                Client-Id <span className="text-red-500">*</span>
              </label>
              <Input
                value={formClientId}
                onChange={(e) => setFormClientId(e.target.value)}
                placeholder="Ozon Client-Id"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#152033] mb-1.5">
                Api-Key {editShop ? '（留空则不修改）' : ''}<span className="text-red-500">{editShop ? '' : '*'}</span>
              </label>
              <Input
                type="password"
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder={editShop ? '留空则保持原密钥不变' : 'Ozon Api-Key（加密存储）'}
              />
              {editShop && (
                <p className="text-xs text-[#637089] mt-1">当前密钥: ••••••••（已加密存储）</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                setEditShop(null);
              }}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}
