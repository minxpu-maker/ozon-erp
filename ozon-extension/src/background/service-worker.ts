/**
 * Chrome Extension Service Worker
 * 后台服务工作线程
 * 
 * 职责：
 * 1. 接收 Content Script 的采集数据并推送到后端
 * 2. 管理插件配置（API Key、店铺信息等）
 * 3. 管理采集历史和离线队列
 * 4. 处理连续采集的定时任务
 */

import { 
  MarketSignalPayload, 
  ExtensionConfig, 
  CollectionRecord,
  BatchPushRequest,
  BatchPushResponse,
} from '../shared/types';
import { 
  MESSAGE_TYPES, 
  STORAGE_KEYS, 
  DEFAULT_CONFIG,
  COLLECTION_INTERVALS,
} from '../shared/constants';
import { ErpApiClient, createApiClient } from '../shared/api';

console.log('[BG] Service worker loaded');

// ============================================================================
// 状态管理
// ============================================================================

/** 当前配置 */
let currentConfig: ExtensionConfig | null = null;

/** API 客户端 */
let apiClient: ErpApiClient | null = null;

/** 连续采集定时器 */
let collectionInterval: ReturnType<typeof setInterval> | null = null;

/** 采集历史记录 */
let collectionHistory: CollectionRecord[] = [];

/** 离线队列 */
let offlineQueue: Array<{
  id: string;
  payload: MarketSignalPayload;
  queuedAt: string;
  retryCount: number;
}> = [];

// ============================================================================
// 配置管理
// ============================================================================

/**
 * 从 chrome.storage 加载配置
 */
async function loadConfig(): Promise<ExtensionConfig | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CONFIG);
    const config = result[STORAGE_KEYS.CONFIG];
    if (config && config.apiKey && config.erpBaseUrl) {
      currentConfig = config;
      apiClient = createApiClient(config);
      console.log('[BG] Config loaded:', { erpBaseUrl: config.erpBaseUrl, shopId: config.shopId });
      return config;
    }
    return null;
  } catch (error) {
    console.error('[BG] Failed to load config:', error);
    return null;
  }
}

/**
 * 保存配置到 chrome.storage
 */
async function saveConfig(config: ExtensionConfig): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: config });
    currentConfig = config;
    apiClient = createApiClient(config);
    console.log('[BG] Config saved:', { erpBaseUrl: config.erpBaseUrl, shopId: config.shopId });
  } catch (error) {
    console.error('[BG] Failed to save config:', error);
    throw error;
  }
}

// ============================================================================
// 数据推送
// ============================================================================

/**
 * 推送单个信号到后端
 */
async function pushSignalToBackend(signal: MarketSignalPayload): Promise<{
  success: boolean;
  signalId?: number;
  error?: string;
}> {
  if (!apiClient || !currentConfig) {
    return { success: false, error: 'API client not initialized' };
  }
  
  try {
    const request: BatchPushRequest = {
      shopId: currentConfig.shopId,
      signals: [signal],
    };
    
    const response: BatchPushResponse = await apiClient.pushSignals(request);
    
    if (response.ok && response.results && response.results.length > 0) {
      const result = response.results[0];
      console.log('[BG] Signal pushed successfully:', result.signalId, result.status);
      return { success: true, signalId: result.signalId };
    }
    
    return { success: false, error: 'Push failed' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BG] Push signal failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * 批量推送信号到后端
 */
async function pushBatchToBackend(signals: MarketSignalPayload[]): Promise<BatchPushResponse> {
  if (!apiClient || !currentConfig) {
    return { ok: false, results: [] };
  }
  
  try {
    const request: BatchPushRequest = {
      shopId: currentConfig.shopId,
      signals,
    };
    
    return await apiClient.pushSignals(request);
  } catch (error) {
    console.error('[BG] Batch push failed:', error);
    return { ok: false, results: [] };
  }
}

// ============================================================================
// 采集历史管理
// ============================================================================

const MAX_HISTORY_SIZE = 100;
const MAX_OFFLINE_QUEUE_SIZE = 500;

/**
 * 添加采集记录到历史
 */
function addCollectionRecord(record: Omit<CollectionRecord, 'id' | 'collectedAt'>): void {
  const fullRecord: CollectionRecord = {
    ...record,
    id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    collectedAt: new Date().toISOString(),
  };
  collectionHistory.unshift(fullRecord);
  if (collectionHistory.length > MAX_HISTORY_SIZE) {
    collectionHistory = collectionHistory.slice(0, MAX_HISTORY_SIZE);
  }
  
  // 异步保存到 storage
  chrome.storage.local.set({ [STORAGE_KEYS.COLLECTIONS]: collectionHistory }).catch(() => {});
}

/**
 * 添加到离线队列
 */
function addToOfflineQueue(payload: MarketSignalPayload): string {
  const item = {
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    payload,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
  };
  
  offlineQueue.push(item);
  if (offlineQueue.length > MAX_OFFLINE_QUEUE_SIZE) {
    offlineQueue = offlineQueue.slice(-MAX_OFFLINE_QUEUE_SIZE);
  }
  
  // 异步保存到 storage
  chrome.storage.local.set({ [STORAGE_KEYS.OFFLINE_QUEUE]: offlineQueue }).catch(() => {});
  
  return item.id;
}

/**
 * 刷新离线队列 - 尝试推送所有离线数据
 * D-046: 网络恢复后自动把之前推送失败的数据重新推送
 */
async function flushOfflineQueue(): Promise<{ success: number; failed: number }> {
  console.log('[BG] flushOfflineQueue called, queue size:', offlineQueue.length);
  
  // 没有配置，无法推送
  if (!currentConfig) {
    console.log('[BG] No config, cannot flush offline queue');
    return { success: 0, failed: 0 };
  }
  
  // 队列为空
  if (offlineQueue.length === 0) {
    console.log('[BG] Offline queue is empty');
    return { success: 0, failed: 0 };
  }
  
  // 确保 apiClient 已初始化
  if (!apiClient) {
    apiClient = createApiClient(currentConfig);
  }
  
  let successCount = 0;
  let failedCount = 0;
  const remainingQueue: typeof offlineQueue = [];
  
  // 逐条推送队列中的请求
  for (const item of offlineQueue) {
    try {
      console.log('[BG] Retrying offline item:', item.id);
      
      const response = await apiClient.pushSignals({
        shopId: currentConfig.shopId,
        signals: [item.payload],
      });
      
      if (response.ok) {
        successCount++;
        console.log('[BG] Offline item pushed successfully:', item.id);
        
        // 添加到采集历史
        addCollectionRecord({
          platform: item.payload.sourceType,
          productTitle: item.payload.productTitle,
          price: item.payload.price,
          imageUrl: item.payload.imageUrl,
          pushStatus: 'pushed',
          signalId: response.results?.[0]?.signalId,
        });
      } else {
        // 推送失败（业务错误），保留到剩余队列
        failedCount++;
        item.retryCount++;
        remainingQueue.push(item);
        console.warn('[BG] Offline item push failed (business error):', item.id);
        
        // 如果是认证错误，停止后续推送
        if (response.error?.includes('401') || response.error?.includes('403')) {
          console.warn('[BG] Auth error, stopping flush');
          // 把剩余的所有项都保留
          const currentIndex = offlineQueue.indexOf(item);
          remainingQueue.push(...offlineQueue.slice(currentIndex + 1).map(i => {
            i.retryCount++;
            return i;
          }));
          break;
        }
      }
    } catch (error) {
      // 网络错误，停止推送后续的（大概率也失败）
      failedCount++;
      item.retryCount++;
      remainingQueue.push(item);
      console.error('[BG] Offline item push failed (network error):', item.id, error);
      
      // 把剩余的所有项都保留
      const currentIndex = offlineQueue.indexOf(item);
      if (currentIndex < offlineQueue.length - 1) {
        remainingQueue.push(...offlineQueue.slice(currentIndex + 1).map(i => {
          i.retryCount++;
          return i;
        }));
      }
      break;
    }
  }
  
  // 更新离线队列
  offlineQueue = remainingQueue;
  await chrome.storage.local.set({ [STORAGE_KEYS.OFFLINE_QUEUE]: offlineQueue });
  
  console.log('[BG] flushOfflineQueue complete:', { success: successCount, failed: failedCount, remaining: offlineQueue.length });
  
  // 通知 popup 更新
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.PUSH_RESULT,
    success: true,
    flushed: { success: successCount, failed: failedCount },
  }).catch(() => {});
  
  return { success: successCount, failed: failedCount };
}

// ============================================================================
// 消息处理
// ============================================================================

/**
 * 处理页面就绪通知
 */
function handlePageReady(message: { platform: string; url: string; productId?: string }): void {
  console.log('[BG] Page ready:', message.platform, message.productId);
  
  // 如果正在连续采集，通知 content script 开始采集
  if (collectionInterval && message.platform === 'wb') {
    chrome.tabs.query({ url: '*://www.wildberries.ru/*' }).then(tabs => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.COLLECT_START }).catch(() => {});
        }
      }
    });
  }
}

/**
 * 处理推送信号消息
 */
async function handlePushSignal(
  message: { data: MarketSignalPayload; source?: string },
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean; signalId?: number; error?: string }> {
  const signal = message.data;
  const tabId = sender.tab?.id;
  
  console.log('[BG] Push signal received:', signal.productId, 'from', message.source);
  
  // 推送到后端
  const result = await pushSignalToBackend(signal);
  
  // 创建采集记录
  const record: CollectionRecord = {
    id: `record_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    platform: signal.sourceType,
    productTitle: signal.productTitle,
    price: signal.price ?? 0,
    imageUrl: signal.imageUrl,
    collectedAt: new Date().toISOString(),
    pushStatus: result.success ? 'pushed' : 'failed',
    signalId: result.signalId,
    error: result.error,
  };
  
  addCollectionRecord(record);
  
  // 如果推送失败，添加到离线队列
  if (!result.success) {
    addToOfflineQueue(signal);
  }
  
  // 通知 popup 更新
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.PUSH_RESULT,
    success: result.success,
    record,
  }).catch(() => {});
  
  // 通知 content script 采集完成
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_TYPES.COLLECTION_COMPLETE,
      success: result.success,
      signalId: result.signalId,
    }).catch(() => {});
  }
  
  return result;
}

/**
 * 处理批量推送消息
 */
async function handlePushBatch(
  message: { signals?: MarketSignalPayload[]; data?: MarketSignalPayload[] }
): Promise<BatchPushResponse> {
  // 支持两种消息格式：signals 或 data
  const signals = message.signals || message.data || [];
  console.log('[BG] Batch push received:', signals.length, 'signals');
  return pushBatchToBackend(signals);
}

/**
 * 处理获取配置消息
 */
async function handleGetConfig(): Promise<{ config: ExtensionConfig | null }> {
  if (!currentConfig) {
    await loadConfig();
  }
  return { config: currentConfig };
}

/**
 * 处理设置配置消息
 */
async function handleSetConfig(message: { config: ExtensionConfig }): Promise<{ success: boolean }> {
  try {
    await saveConfig(message.config);
    return { success: true };
  } catch {
    return { success: false };
  }
}

/**
 * 处理获取采集历史消息
 */
async function handleGetCollections(): Promise<{ collections: CollectionRecord[] }> {
  // 尝试从 storage 加载
  if (collectionHistory.length === 0) {
    const result = await chrome.storage.local.get(STORAGE_KEYS.COLLECTIONS);
    collectionHistory = result[STORAGE_KEYS.COLLECTIONS] || [];
  }
  return { collections: collectionHistory };
}

/**
 * 处理清空采集历史消息
 */
async function handleClearCollections(): Promise<{ success: boolean }> {
  collectionHistory = [];
  await chrome.storage.local.remove(STORAGE_KEYS.COLLECTIONS);
  return { success: true };
}

/**
 * 处理开始连续采集消息
 */
function handleCollectStart(): { success: boolean } {
  if (collectionInterval) {
    return { success: true }; // 已经在采集
  }
  
  console.log('[BG] Starting continuous collection');
  
  collectionInterval = setInterval(() => {
    // 发送采集消息到当前活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      for (const tab of tabs) {
        if (tab.id && tab.url) {
          // 根据 URL 决定发送哪种消息
          if (tab.url.includes('wildberries.ru/catalog')) {
            chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.COLLECT_START }).catch(() => {});
          } else if (tab.url.includes('ozon.ru/product')) {
            chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.COLLECT_START }).catch(() => {});
          }
        }
      }
    });
  }, COLLECTION_INTERVALS.DEFAULT);
  
  return { success: true };
}

/**
 * 处理停止连续采集消息
 */
function handleCollectStop(): { success: boolean } {
  if (collectionInterval) {
    clearInterval(collectionInterval);
    collectionInterval = null;
    console.log('[BG] Continuous collection stopped');
  }
  return { success: true };
}

// ============================================================================
// 消息监听器
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const msgType = message.type;
  console.log('[BG] Message received:', msgType);
  
  // 同步响应的处理器
  switch (msgType) {
    case MESSAGE_TYPES.GET_CONFIG:
      handleGetConfig().then(sendResponse);
      return true;
      
    case MESSAGE_TYPES.SET_CONFIG:
      handleSetConfig(message).then(sendResponse);
      return true;
      
    case MESSAGE_TYPES.GET_COLLECTIONS:
      handleGetCollections().then(sendResponse);
      return true;
      
    case MESSAGE_TYPES.CLEAR_COLLECTIONS:
      handleClearCollections().then(sendResponse);
      return true;
      
    case MESSAGE_TYPES.COLLECT_START:
      sendResponse(handleCollectStart());
      return true;
      
    case MESSAGE_TYPES.COLLECT_STOP:
      sendResponse(handleCollectStop());
      return true;
      
    case MESSAGE_TYPES.PAGE_READY:
      handlePageReady(message);
      sendResponse({ received: true });
      return true;
      
    case MESSAGE_TYPES.ONLINE:
      // D-046: 网络恢复，尝试刷新离线队列
      (async () => {
        const result = await flushOfflineQueue();
        sendResponse({ success: true, flushed: result });
      })();
      return true;
      
    case MESSAGE_TYPES.FLUSH_OFFLINE:
      // 手动触发离线队列刷新
      (async () => {
        const result = await flushOfflineQueue();
        sendResponse({ success: true, flushed: result });
      })();
      return true;
      
    case MESSAGE_TYPES.PUSH_SIGNAL:
      handlePushSignal(message, sender).then(sendResponse);
      return true;
      
    case MESSAGE_TYPES.PUSH_BATCH:
      handlePushBatch(message).then(sendResponse);
      return true;
      
    default:
      // 未知消息类型，返回 false 不保持通道
      return false;
  }
});

// ============================================================================
// 右键菜单
// ============================================================================

const CONTEXT_MENU_ID = 'collect-to-ozon';

/**
 * 注册右键菜单
 */
function registerContextMenu(): void {
  // 移除已存在的菜单（避免重复注册）
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: '采集到Ozon选品系统',
      contexts: ['page', 'link', 'image'],
      documentUrlPatterns: [
        'https://www.wildberries.ru/*',
        'https://wildberries.ru/*',
        'https://ozon.ru/*',
        'https://www.ozon.ru/*',
      ],
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[BG] Context menu creation failed:', chrome.runtime.lastError);
      } else {
        console.log('[BG] Context menu registered');
      }
    });
  });
}

/**
 * 处理右键菜单点击
 */
async function handleContextMenuClick(
  _info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined
): Promise<void> {
  if (!tab?.id || !tab.url) {
    console.warn('[BG] Context menu clicked but no tab info');
    return;
  }
  
  console.log('[BG] Context menu clicked on tab:', tab.id, tab.url);
  
  try {
    // 向内容脚本发送采集消息
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: MESSAGE_TYPES.COLLECT_SINGLE,
      source: 'context_menu',
    });
    
    if (!response?.success || !response?.data) {
      console.warn('[BG] No data received from content script');
      return;
    }
    
    // 判断是单条还是批量
    const isBatch = response.isBatch === true;
    let signals: MarketSignalPayload[];
    
    if (isBatch && Array.isArray(response.data)) {
      signals = response.data;
    } else {
      signals = [response.data];
    }
    
    console.log('[BG] Context menu collected:', signals.length, 'signals');
    
    // 推送到后端
    const result = await pushBatchToBackend(signals);
    
    // 创建采集记录
    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i];
      const signalResult = result.results?.[i];
      
      const record: CollectionRecord = {
        id: `record_${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${i}`,
        platform: signal.sourceType,
        productTitle: signal.productTitle,
        price: signal.price ?? 0,
        imageUrl: signal.imageUrl,
        collectedAt: new Date().toISOString(),
        pushStatus: result.ok && signalResult ? 'pushed' : 'failed',
        signalId: signalResult?.signalId,
        error: result.ok ? undefined : 'Push failed',
      };
      
      addCollectionRecord(record);
      
      if (!result.ok) {
        addToOfflineQueue(signal);
      }
    }
    
    // 显示通知
    if (result.ok) {
      console.log('[BG] Context menu push success:', signals.length, 'signals');
    } else {
      console.warn('[BG] Context menu push failed');
    }
  } catch (error) {
    console.error('[BG] Context menu handling failed:', error);
  }
}

// ============================================================================
// 初始化
// ============================================================================

async function init(): Promise<void> {
  console.log('[BG] Initializing service worker');
  
  // 注册右键菜单
  registerContextMenu();
  
  // 加载配置
  await loadConfig();
  
  // 加载采集历史
  const historyResult = await chrome.storage.local.get(STORAGE_KEYS.COLLECTIONS);
  collectionHistory = historyResult[STORAGE_KEYS.COLLECTIONS] || [];
  
  // 加载离线队列
  const queueResult = await chrome.storage.local.get(STORAGE_KEYS.OFFLINE_QUEUE);
  offlineQueue = queueResult[STORAGE_KEYS.OFFLINE_QUEUE] || [];
  
  console.log('[BG] Init complete:', {
    hasConfig: !!currentConfig,
    historyCount: collectionHistory.length,
    queueCount: offlineQueue.length,
  });
  
  // D-046: 启动时尝试刷新离线队列（处理上次关闭时残留的离线数据）
  if (offlineQueue.length > 0) {
    console.log('[BG] Attempting to flush offline queue on startup');
    // 延迟一小段时间，等待网络就绪
    setTimeout(() => {
      flushOfflineQueue().catch(err => {
        console.error('[BG] Failed to flush offline queue on startup:', err);
      });
    }, 2000);
  }
}

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[BG] Installed:', details.reason);
  
  if (details.reason === 'install') {
    // 首次安装，初始化默认配置
    await chrome.storage.local.set({
      [STORAGE_KEYS.CONFIG]: DEFAULT_CONFIG,
    });
    console.log('[BG] Default config initialized');
  }
  
  await init();
});

// 监听扩展启动事件
chrome.runtime.onStartup.addListener(async () => {
  console.log('[BG] Extension started');
  await init();
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  handleContextMenuClick(info, tab);
});

// 初始化
init();

export {};
