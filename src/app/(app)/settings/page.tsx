'use client';

import { useState, useEffect } from 'react';

interface OzonConfig {
  clientId: string;
  apiKey: string;
  configured: boolean;
}

interface SyncConfig {
  enabled: boolean;
  interval: number;
  autoCreatePurchase: boolean;
  skuAutoMatch: boolean;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  status: 'idle' | 'running' | 'error';
}

export default function SettingsPage() {
  const [ozonConfig, setOzonConfig] = useState<OzonConfig>({
    clientId: '',
    apiKey: '',
    configured: false,
  });
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    enabled: true,
    interval: 30,
    autoCreatePurchase: true,
    skuAutoMatch: true,
    lastSyncAt: null,
    nextSyncAt: null,
    status: 'idle',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // 加载 Ozon 配置
      const testRes = await fetch('/api/ozon/test');
      const testData = await testRes.json();
      
      // 加载同步配置
      const syncRes = await fetch('/api/orders/sync-schedule');
      const syncData = await syncRes.json();

      if (testData.success) {
        setOzonConfig(prev => ({
          ...prev,
          configured: testData.configured,
        }));
      }

      if (syncData.success && syncData.data) {
        setSyncConfig(syncData.data);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 保存 Ozon 配置
  const saveOzonConfig = async () => {
    setSaving(true);
    try {
      // 更新环境变量（实际应通过安全接口）
      const res = await fetch('/api/ozon/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: ozonConfig.clientId,
          apiKey: ozonConfig.apiKey,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setOzonConfig(prev => ({ ...prev, configured: true }));
        setTestResult({ success: true, message: '配置已保存' });
      } else {
        setTestResult({ success: false, message: data.error || '保存失败' });
      }
    } catch (error) {
      setTestResult({ success: false, message: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  // 测试 API 连接
  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ozon/test');
      const data = await res.json();
      
      if (data.success) {
        setTestResult({ success: true, message: 'API 连接成功' });
      } else {
        setTestResult({ success: false, message: data.error || '连接失败' });
      }
    } catch (error) {
      setTestResult({ success: false, message: '连接测试失败' });
    } finally {
      setTesting(false);
    }
  };

  // 保存同步配置
  const saveSyncConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/orders/sync-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: syncConfig.enabled,
          interval: syncConfig.interval,
          autoCreatePurchase: syncConfig.autoCreatePurchase,
          skuAutoMatch: syncConfig.skuAutoMatch,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setSyncConfig(data.data);
      }
    } catch (error) {
      console.error('保存同步配置失败:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 max-w-4xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">系统设置</h1>
          <p className="text-muted-foreground mt-1">配置 Ozon API 和系统参数</p>
        </div>

        {/* Ozon API 配置 */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-foreground mb-4">Ozon API 配置</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Client ID
              </label>
              <input
                type="text"
                value={ozonConfig.clientId}
                onChange={(e) => setOzonConfig(prev => ({ ...prev, clientId: e.target.value }))}
                placeholder="输入 Ozon Client ID"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                API Key
              </label>
              <input
                type="password"
                value={ozonConfig.apiKey}
                onChange={(e) => setOzonConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="输入 Ozon API Key"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg ${testResult.success ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
                {testResult.message}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={saveOzonConfig}
                disabled={saving || !ozonConfig.clientId || !ozonConfig.apiKey}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存配置'}
              </button>
              <button
                onClick={testConnection}
                disabled={testing || !ozonConfig.configured}
                className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted disabled:opacity-50"
              >
                {testing ? '测试中...' : '测试连接'}
              </button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>获取 API 凭证：</p>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>登录 Ozon Seller 后台</li>
                <li>进入 设置 → API 密钥</li>
                <li>创建或复制 API Key</li>
              </ol>
            </div>
          </div>
        </div>

        {/* 同步配置 */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-foreground mb-4">订单同步配置</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">启用自动同步</div>
                <div className="text-xs text-muted-foreground">定时从 Ozon 同步订单数据</div>
              </div>
              <button
                onClick={() => setSyncConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  syncConfig.enabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    syncConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                同步间隔（分钟）
              </label>
              <input
                type="number"
                value={syncConfig.interval}
                onChange={(e) => setSyncConfig(prev => ({ ...prev, interval: Number(e.target.value) }))}
                min={5}
                max={1440}
                className="w-32 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-xs text-muted-foreground ml-2">范围：5-1440 分钟</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">自动创建采购任务</div>
                <div className="text-xs text-muted-foreground">新订单自动生成采购任务</div>
              </div>
              <button
                onClick={() => setSyncConfig(prev => ({ ...prev, autoCreatePurchase: !prev.autoCreatePurchase }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  syncConfig.autoCreatePurchase ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    syncConfig.autoCreatePurchase ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">SKU 自动匹配</div>
                <div className="text-xs text-muted-foreground">根据 Ozon SKU 自动匹配本地商品</div>
              </div>
              <button
                onClick={() => setSyncConfig(prev => ({ ...prev, skuAutoMatch: !prev.skuAutoMatch }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  syncConfig.skuAutoMatch ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    syncConfig.skuAutoMatch ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 同步状态 */}
            <div className="border-t border-border pt-4 mt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">上次同步：</span>
                  <span className="text-foreground">
                    {syncConfig.lastSyncAt 
                      ? new Date(syncConfig.lastSyncAt).toLocaleString('zh-CN')
                      : '暂无'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">下次同步：</span>
                  <span className="text-foreground">
                    {syncConfig.nextSyncAt 
                      ? new Date(syncConfig.nextSyncAt).toLocaleString('zh-CN')
                      : '未启用'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">同步状态：</span>
                  <span className={`${
                    syncConfig.status === 'running' ? 'text-primary' :
                    syncConfig.status === 'error' ? 'text-destructive' : 'text-foreground'
                  }`}>
                    {syncConfig.status === 'running' ? '运行中' :
                     syncConfig.status === 'error' ? '错误' : '空闲'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={saveSyncConfig}
              disabled={saving}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存同步配置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
