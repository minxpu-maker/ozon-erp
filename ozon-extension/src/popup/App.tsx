import { useState, useEffect, useCallback } from 'react';
import type { MarketSignalPayload, ExtensionConfig, CollectionRecord } from '../shared/types';
import { MESSAGE_TYPES, STORAGE_KEYS, DEFAULT_ERP_URL } from '../shared/constants';

type PageType = 'main' | 'settings';
interface PlatformInfo {
  platform: 'wb' | 'ozon_market';
  name: string;
}

function App() {
  // 页面状态
  const [currentPage, setCurrentPage] = useState<PageType>('main');
  
  // 平台识别
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  
  // 数据状态
  const [previewData, setPreviewData] = useState<MarketSignalPayload | null>(null);
  const [history, setHistory] = useState<CollectionRecord[]>([]);
  const [config, setConfig] = useState<ExtensionConfig | null>(null);
  
  // 操作状态
  const [isCollecting, setIsCollecting] = useState(false);
  const [isContinuousActive, setIsContinuousActive] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'warning' | 'error' | 'info'>('info');

  // 初始化
  useEffect(() => {
    initializePopup();
  }, []);

  const initializePopup = async () => {
    try {
      // 获取当前tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab?.url) {
        setCurrentTabId(tab.id);
        const platform = detectPlatform(tab.url);
        setPlatformInfo(platform);
      }

      // 加载配置
      const configData = await chrome.storage.local.get(STORAGE_KEYS.CONFIG);
      if (configData[STORAGE_KEYS.CONFIG]) {
        setConfig(configData[STORAGE_KEYS.CONFIG]);
      }

      // 加载采集历史
      const historyData = await chrome.storage.local.get(STORAGE_KEYS.COLLECTIONS);
      if (historyData[STORAGE_KEYS.COLLECTIONS]) {
        setHistory(historyData[STORAGE_KEYS.COLLECTIONS].slice(0, 10));
      }

      // 检查连续采集状态
      const stateData = await chrome.storage.local.get('continuousCollectionActive');
      setIsContinuousActive(!!stateData.continuousCollectionActive);
    } catch (error) {
      console.error('初始化失败:', error);
    }
  };

  // 平台识别 - 必须与 manifest.json 中的 content_scripts 匹配规则一致
  const detectPlatform = (url: string): PlatformInfo | null => {
    // WB 商品详情页: /catalog/数字/detail.aspx
    if (/wildberries\.ru\/catalog\/\d+\/detail\.aspx/i.test(url)) {
      return { platform: 'wb', name: 'Wildberries' };
    }
    // Ozon 商品详情页或搜索页
    if (/ozon\.ru\/(product|search|category)/i.test(url)) {
      return { platform: 'ozon_market', name: 'Ozon' };
    }
    return null;
  };

  // 显示消息
  const showMessage = useCallback((msg: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  }, []);

  // 一键采集
  const handleCollect = async () => {
    if (!platformInfo || !currentTabId) {
      showMessage('请先打开Wildberries或Ozon页面', 'warning');
      return;
    }

    if (!config) {
      showMessage('⚠️ 请先在设置中配置API Key', 'error');
      return;
    }

    setIsCollecting(true);
    setPreviewData(null);

    try {
      // 发送采集消息到内容脚本
      const response = await chrome.tabs.sendMessage(currentTabId, { type: MESSAGE_TYPES.COLLECT_SINGLE });
      
      if (response?.success && response?.data) {
        const data = response.data;
        setPreviewData(data);
        
        // 推送到后端
        const signals = response.isBatch ? data : [data];
        
        try {
          // 发送 signals 数组，Service Worker 会处理
          const pushResponse = await chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.PUSH_BATCH,
            signals,  // 直接传数组，不包装
          });
          
          if (pushResponse?.success) {
            const count = response.isBatch ? signals.length : 1;
            showMessage(`✅ 采集成功，已推送${count}条数据到ERP`, 'success');
          } else {
            showMessage('⚠️ 采集成功，推送失败（已暂存离线队列）', 'warning');
          }
        } catch {
          showMessage('⚠️ 采集成功，推送失败（已暂存离线队列）', 'warning');
        }
        
        // 刷新历史
        setTimeout(initializePopup, 1000);
      } else {
        showMessage('❌ 采集失败：未获取到数据', 'error');
      }
    } catch (error) {
      console.error('采集失败:', error);
      showMessage('❌ 采集失败，请刷新页面后重试', 'error');
    } finally {
      setIsCollecting(false);
    }
  };

  // 连续采集
  const handleContinuousCollect = async () => {
    if (!platformInfo) {
      showMessage('请先打开Wildberries或Ozon页面', 'warning');
      return;
    }

    if (!config) {
      showMessage('⚠️ 请先在设置中配置API Key', 'error');
      return;
    }

    try {
      if (isContinuousActive) {
        // 停止连续采集
        await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.COLLECT_STOP });
        setIsContinuousActive(false);
        await chrome.storage.local.set({ continuousCollectionActive: false });
        showMessage('⏹ 连续采集已停止', 'info');
      } else {
        // 启动连续采集
        await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.COLLECT_START });
        setIsContinuousActive(true);
        await chrome.storage.local.set({ continuousCollectionActive: true });
        showMessage('🔄 连续采集中，每5秒采集当前页面', 'success');
      }
    } catch (error) {
      console.error('连续采集操作失败:', error);
      showMessage('❌ 操作失败，请重试', 'error');
    }
  };

  // 截断文本
  const truncate = (text: string, maxLen: number): string => {
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  };

  // 格式化价格
  const formatPrice = (price?: number): string => {
    if (price === undefined || price === null) return '-';
    return `${price.toLocaleString()}₽`;
  };

  // 设置页面
  if (currentPage === 'settings') {
    return <SettingsPage onBack={() => setCurrentPage('main')} config={config} onConfigUpdate={setConfig} />;
  }

  // 主页面
  return (
    <div style={styles.container}>
      {/* 顶部栏 */}
      <div style={styles.header}>
        <h1 style={styles.title}>Ozon智能选品助手</h1>
        <button style={styles.settingsButton} onClick={() => setCurrentPage('settings')} title="设置">
          ⚙️
        </button>
      </div>

      {/* 平台状态区 */}
      <div style={styles.content}>
        {platformInfo ? (
          <div style={styles.platformCard}>
            <span style={styles.platformIcon}>📦</span>
            <span style={styles.platformText}>{platformInfo.name} 页面已识别</span>
            {isContinuousActive && <span style={styles.collectingBadge}>● 采集中</span>}
          </div>
        ) : (
          <div style={styles.platformCardInactive}>
            <span style={styles.platformIcon}>⚠️</span>
            <span style={styles.platformText}>请打开Wildberries或Ozon页面</span>
          </div>
        )}

        {/* 预览数据 */}
        {previewData && (
          <div style={styles.previewCard}>
            <div style={styles.previewTitle}>{truncate(previewData.productTitle || '未知商品', 40)}</div>
            <div style={styles.previewInfo}>
              {formatPrice(previewData.price)} | {previewData.rating ? `${previewData.rating}⭐` : '无评分'}
            </div>
          </div>
        )}

        {/* 采集按钮区 */}
        <div style={styles.buttonRow}>
          <button
            style={{
              ...styles.collectButton,
              ...((!platformInfo || isCollecting) ? styles.buttonDisabled : {}),
            }}
            onClick={handleCollect}
            disabled={!platformInfo || isCollecting}
          >
            {isCollecting ? '采集中...' : '一键采集'}
          </button>
          <button
            style={{
              ...styles.continuousButton,
              backgroundColor: isContinuousActive ? '#DC2626' : '#059669',
              ...(!platformInfo ? styles.buttonDisabled : {}),
            }}
            onClick={handleContinuousCollect}
            disabled={!platformInfo}
          >
            {isContinuousActive ? '⏹ 停止' : '🔄 连续采集'}
          </button>
        </div>

        {/* 消息提示 */}
        {message && (
          <div style={{ ...styles.messageBox, ...styles[`message${messageType}` as keyof typeof styles] }}>
            {message}
          </div>
        )}

        {/* 连续采集说明 */}
        {isContinuousActive && (
          <div style={styles.continuousHint}>
            每5秒自动采集当前页面，翻页后继续采集，点击停止结束
          </div>
        )}

        {/* 采集历史 */}
        <div style={styles.historySection}>
          <div style={styles.historyTitle}>最近采集</div>
          {history.length === 0 ? (
            <div style={styles.historyEmpty}>暂无采集记录</div>
          ) : (
            <div style={styles.historyList}>
              {history.map((record) => (
                <div key={record.id} style={styles.historyItem}>
                  <div style={styles.historyItemTitle}>{truncate(record.productTitle, 25)}</div>
                  <div style={styles.historyItemInfo}>
                    {record.platform === 'wb' ? 'WB' : 'Ozon'} | {formatPrice(record.price)} | {record.pushStatus === 'pushed' ? '✅' : '⏳'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 配置缺失提示 */}
      {!config && (
        <div style={styles.configWarning}>⚠️ 请先在设置中配置API Key</div>
      )}

      {/* 底部 */}
      <div style={styles.footer}>
        <span style={styles.version}>v1.0.0</span>
      </div>
    </div>
  );
}

// 设置页面组件
function SettingsPage({ onBack, config, onConfigUpdate }: {
  onBack: () => void;
  config: ExtensionConfig | null;
  onConfigUpdate: (config: ExtensionConfig | null) => void;
}) {
  const [erpBaseUrl, setErpBaseUrl] = useState(config?.erpBaseUrl || DEFAULT_ERP_URL);
  const [apiKey, setApiKey] = useState(config?.apiKey || '');
  const [shopId, setShopId] = useState(config?.shopId || '');
  const [shopName, setShopName] = useState(config?.shopName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    if (!erpBaseUrl || !apiKey || !shopId) {
      setMessage('请填写完整配置信息');
      return;
    }

    if (!apiKey.startsWith('ozon_ext_')) {
      setMessage('API Key 格式错误，应以 ozon_ext_ 开头');
      return;
    }

    setIsSaving(true);
    try {
      const newConfig: ExtensionConfig = {
        erpBaseUrl: erpBaseUrl.replace(/\/$/, ''),
        apiKey,
        shopId,
        shopName: shopName || '未命名店铺',
      };

      await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: newConfig });
      onConfigUpdate(newConfig);
      setMessage('✅ 保存成功');
      setTimeout(onBack, 1000);
    } catch (error) {
      console.error('保存失败:', error);
      setMessage('❌ 保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!apiKey) {
      setMessage('请先输入API Key');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.VALIDATE_CONFIG,
        data: { erpBaseUrl, apiKey },
      });

      if (response?.success) {
        setMessage('✅ API Key 验证通过');
      } else {
        setMessage('❌ API Key 验证失败: ' + (response?.error || '未知错误'));
      }
    } catch (error) {
      setMessage('❌ 验证失败，请检查网络');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onBack}>← 返回</button>
        <h1 style={styles.title}>设置</h1>
      </div>
      <div style={styles.settingsContent}>
        <div style={styles.formGroup}>
          <label style={styles.label}>ERP后端地址</label>
          <input
            style={styles.input}
            type="text"
            placeholder="https://your-erp.com"
            value={erpBaseUrl}
            onChange={(e) => setErpBaseUrl(e.target.value)}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>API Key</label>
          <input
            style={styles.input}
            type="password"
            placeholder="ozon_ext_xxxxx"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>店铺ID</label>
          <input
            style={styles.input}
            type="text"
            placeholder="店铺ID"
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>店铺名称（可选）</label>
          <input
            style={styles.input}
            type="text"
            placeholder="店铺名称"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
          />
        </div>

        {message && <div style={styles.settingsMessage}>{message}</div>}

        <div style={styles.settingsButtons}>
          <button style={styles.validateButton} onClick={handleValidate}>验证</button>
          <button
            style={{ ...styles.saveButton, ...(isSaving ? styles.buttonDisabled : {}) }}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 360,
    minHeight: 400,
    backgroundColor: '#f6f8fb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#2f6bff',
    color: 'white',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
  },
  settingsButton: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: 14,
    cursor: 'pointer',
    padding: 0,
  },
  content: {
    padding: 16,
  },
  platformCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    backgroundColor: '#f3e8ff',
    borderRadius: 8,
    border: '1px solid #c084fc',
    marginBottom: 12,
  },
  platformCardInactive: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    marginBottom: 12,
  },
  platformIcon: {
    fontSize: 16,
  },
  platformText: {
    fontSize: 14,
    color: '#152033',
    fontWeight: 500,
    flex: 1,
  },
  collectingBadge: {
    fontSize: 11,
    color: '#16a37b',
    backgroundColor: '#d1fae5',
    padding: '2px 8px',
    borderRadius: 4,
    fontWeight: 500,
  },
  previewCard: {
    padding: '10px 12px',
    backgroundColor: '#fff',
    borderRadius: 8,
    border: '1px solid #e6eaf2',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: '#152033',
    marginBottom: 4,
  },
  previewInfo: {
    fontSize: 12,
    color: '#637089',
  },
  buttonRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  collectButton: {
    flex: 1,
    padding: '10px 16px',
    backgroundColor: '#7C3AED',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  continuousButton: {
    flex: 1,
    padding: '10px 16px',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  messageBox: {
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 12,
  },
  messagesuccess: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  messagewarning: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  messageerror: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  messageinfo: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
  },
  continuousHint: {
    padding: '8px 12px',
    backgroundColor: '#d1fae5',
    borderRadius: 6,
    fontSize: 12,
    color: '#065f46',
    marginBottom: 12,
  },
  historySection: {
    marginTop: 8,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#152033',
    marginBottom: 8,
  },
  historyEmpty: {
    fontSize: 13,
    color: '#9ca3af',
    padding: '8px 0',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  historyItem: {
    padding: '8px 10px',
    backgroundColor: '#fff',
    borderRadius: 6,
    border: '1px solid #e6eaf2',
  },
  historyItemTitle: {
    fontSize: 13,
    color: '#152033',
    marginBottom: 2,
  },
  historyItemInfo: {
    fontSize: 11,
    color: '#637089',
  },
  configWarning: {
    padding: '8px 16px',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    fontSize: 12,
    textAlign: 'center',
  },
  footer: {
    padding: '8px 16px',
    borderTop: '1px solid #e6eaf2',
    textAlign: 'right',
  },
  version: {
    fontSize: 11,
    color: '#9ca3af',
  },
  // Settings page styles
  settingsContent: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: '#152033',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 14,
    boxSizing: 'border-box' as const,
  },
  settingsMessage: {
    padding: '8px 12px',
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  settingsButtons: {
    display: 'flex',
    gap: 8,
  },
  validateButton: {
    flex: 1,
    padding: '10px 16px',
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
  },
  saveButton: {
    flex: 1,
    padding: '10px 16px',
    backgroundColor: '#2f6bff',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
  },
};

export default App;
