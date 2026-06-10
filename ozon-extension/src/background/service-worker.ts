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
function addCollectionRecord(record: CollectionRecord): void {
  collectionHistory.unshift(record);
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
  message: { signals: MarketSignalPayload[] }
): Promise<BatchPushResponse> {
  console.log('[BG] Batch push received:', message.signals.length, 'signals');
  return pushBatchToBackend(message.signals);
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
// 初始化
// ============================================================================

async function init(): Promise<void> {
  console.log('[BG] Initializing service worker');
  
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

// 初始化
init();

export {};
