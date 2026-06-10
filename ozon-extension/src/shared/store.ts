/**
 * Zustand 状态管理 Store
 * 
 * 管理插件的运行时状态：
 * - 配置信息（API Key、店铺信息）
 * - 采集模式和状态
 * - 采集历史记录
 * - 离线队列
 * 
 * 注意：store 只在当前页面生命周期内有效
 * 持久化数据需要配合 chrome.storage.local 使用
 */

import { create } from 'zustand';
import {
  ExtensionConfig,
  CollectionRecord,
  CollectMode,
  MarketSignalPayload,
} from './types';

/**
 * 离线队列项类型
 */
export interface OfflineQueueItem {
  /** 队列项ID */
  id: string;
  /** 原始推送数据 */
  payload: MarketSignalPayload;
  /** 加入队列时间 */
  queuedAt: string;
  /** 重试次数 */
  retryCount: number;
  /** 最后一次错误信息 */
  lastError?: string;
}

/**
 * Store 状态接口
 */
export interface ExtensionStoreState {
  // ========== 状态 ==========
  
  /** 插件配置（API Key、店铺信息等） */
  config: ExtensionConfig | null;
  
  /** 当前采集模式 */
  collectMode: CollectMode;
  
  /** 连续采集是否正在运行 */
  isContinuousActive: boolean;
  
  /** 当前页面采集到的商品数据预览 */
  currentSignal: MarketSignalPayload | null;
  
  /** 采集历史记录 */
  collectionHistory: CollectionRecord[];
  
  /** 是否正在推送数据 */
  isPushing: boolean;
  
  /** 推送失败的离线暂存队列 */
  offlineQueue: OfflineQueueItem[];
  
  /** 最后一次错误信息 */
  lastError: string | null;
  
  /** 是否已初始化（从 chrome.storage 加载完成） */
  isInitialized: boolean;

  // ========== 方法 ==========
  
  /** 设置插件配置 */
  setConfig: (config: ExtensionConfig) => void;
  
  /** 切换采集模式 */
  setCollectMode: (mode: CollectMode) => void;
  
  /** 设置连续采集运行状态 */
  setIsContinuousActive: (active: boolean) => void;
  
  /** 设置当前采集预览数据 */
  setCurrentSignal: (signal: MarketSignalPayload | null) => void;
  
  /** 往采集历史头部插入一条记录 */
  addRecord: (record: CollectionRecord) => void;
  
  /** 更新采集记录 */
  updateRecord: (id: string, updates: Partial<CollectionRecord>) => void;
  
  /** 删除采集记录 */
  deleteRecord: (id: string) => void;
  
  /** 清空采集历史 */
  clearHistory: () => void;
  
  /** 设置推送中状态 */
  setIsPushing: (pushing: boolean) => void;
  
  /** 往离线队列尾部追加一条 */
  addToOfflineQueue: (item: MarketSignalPayload) => void;
  
  /** 从离线队列移除一条 */
  removeFromOfflineQueue: (id: string) => void;
  
  /** 更新离线队列项 */
  updateOfflineQueueItem: (id: string, updates: Partial<OfflineQueueItem>) => void;
  
  /** 清空离线队列 */
  clearOfflineQueue: () => void;
  
  /** 设置错误信息 */
  setLastError: (error: string | null) => void;
  
  /** 设置初始化状态 */
  setIsInitialized: (initialized: boolean) => void;
  
  /** 重置所有状态 */
  reset: () => void;
}

/**
 * 历史记录最大数量
 */
const MAX_HISTORY_SIZE = 100;

/**
 * 离线队列最大数量
 */
const MAX_OFFLINE_QUEUE_SIZE = 500;

/**
 * 初始状态
 */
const initialState = {
  config: null,
  collectMode: 'single' as CollectMode,
  isContinuousActive: false,
  currentSignal: null,
  collectionHistory: [] as CollectionRecord[],
  isPushing: false,
  offlineQueue: [] as OfflineQueueItem[],
  lastError: null,
  isInitialized: false,
};

/**
 * 创建 Zustand store
 */
export const useExtensionStore = create<ExtensionStoreState>((set) => ({
  // ========== 初始状态 ==========
  ...initialState,

  // ========== 方法实现 ==========
  
  setConfig: (config: ExtensionConfig) => {
    set({ config });
  },
  
  setCollectMode: (mode: CollectMode) => {
    set({ collectMode: mode });
  },
  
  setIsContinuousActive: (active: boolean) => {
    set({ isContinuousActive: active });
  },
  
  setCurrentSignal: (signal: MarketSignalPayload | null) => {
    set({ currentSignal: signal });
  },
  
  addRecord: (record: CollectionRecord) => {
    set((state) => {
      const newHistory = [record, ...state.collectionHistory];
      // 超过最大数量时截断（保留最新的）
      if (newHistory.length > MAX_HISTORY_SIZE) {
        return { collectionHistory: newHistory.slice(0, MAX_HISTORY_SIZE) };
      }
      return { collectionHistory: newHistory };
    });
  },
  
  updateRecord: (id: string, updates: Partial<CollectionRecord>) => {
    set((state) => ({
      collectionHistory: state.collectionHistory.map((record) =>
        record.id === id ? { ...record, ...updates } : record
      ),
    }));
  },
  
  deleteRecord: (id: string) => {
    set((state) => ({
      collectionHistory: state.collectionHistory.filter((record) => record.id !== id),
    }));
  },
  
  clearHistory: () => {
    set({ collectionHistory: [] });
  },
  
  setIsPushing: (pushing: boolean) => {
    set({ isPushing: pushing });
  },
  
  addToOfflineQueue: (payload: MarketSignalPayload) => {
    set((state) => {
      const newItem: OfflineQueueItem = {
        id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        payload,
        queuedAt: new Date().toISOString(),
        retryCount: 0,
      };
      const newQueue = [...state.offlineQueue, newItem];
      // 超过最大数量时截断（保留最新的）
      if (newQueue.length > MAX_OFFLINE_QUEUE_SIZE) {
        return { 
          offlineQueue: newQueue.slice(-MAX_OFFLINE_QUEUE_SIZE),
          lastError: `离线队列已满，已移除最早 ${newQueue.length - MAX_OFFLINE_QUEUE_SIZE} 条记录`,
        };
      }
      return { offlineQueue: newQueue };
    });
  },
  
  removeFromOfflineQueue: (id: string) => {
    set((state) => ({
      offlineQueue: state.offlineQueue.filter((item) => item.id !== id),
    }));
  },
  
  updateOfflineQueueItem: (id: string, updates: Partial<OfflineQueueItem>) => {
    set((state) => ({
      offlineQueue: state.offlineQueue.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  },
  
  clearOfflineQueue: () => {
    set({ offlineQueue: [] });
  },
  
  setLastError: (error: string | null) => {
    set({ lastError: error });
  },
  
  setIsInitialized: (initialized: boolean) => {
    set({ isInitialized: initialized });
  },
  
  reset: () => {
    set(initialState);
  },
}));

// ========== 选择器（Selectors）==========

/**
 * 获取当前配置
 */
export const selectConfig = (state: ExtensionStoreState) => state.config;

/**
 * 获取采集模式
 */
export const selectCollectMode = (state: ExtensionStoreState) => state.collectMode;

/**
 * 获取是否连续采集中
 */
export const selectIsContinuousActive = (state: ExtensionStoreState) => state.isContinuousActive;

/**
 * 获取当前信号预览
 */
export const selectCurrentSignal = (state: ExtensionStoreState) => state.currentSignal;

/**
 * 获取采集历史
 */
export const selectCollectionHistory = (state: ExtensionStoreState) => state.collectionHistory;

/**
 * 获取离线队列
 */
export const selectOfflineQueue = (state: ExtensionStoreState) => state.offlineQueue;

/**
 * 获取是否正在推送
 */
export const selectIsPushing = (state: ExtensionStoreState) => state.isPushing;

/**
 * 获取是否已初始化
 */
export const selectIsInitialized = (state: ExtensionStoreState) => state.isInitialized;

/**
 * 获取是否有未推送的记录
 */
export const selectHasUnpushedRecords = (state: ExtensionStoreState) =>
  state.collectionHistory.some((r) => r.pushStatus === 'pending' || r.pushStatus === 'failed');

/**
 * 获取采集统计信息
 */
export const selectCollectionStats = (state: ExtensionStoreState) => {
  const history = state.collectionHistory;
  return {
    total: history.length,
    pending: history.filter((r) => r.pushStatus === 'pending').length,
    pushed: history.filter((r) => r.pushStatus === 'pushed').length,
    failed: history.filter((r) => r.pushStatus === 'failed').length,
  };
};
