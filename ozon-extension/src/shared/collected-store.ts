/**
 * 本地采集状态管理模块
 * 管理已采集商品的本地存储和同步
 */

export interface CollectedState {
  collectedIds: string[];
  lastSync: number;
}

const STORAGE_KEY = 'ozon_ext_collected';
const SYNC_INTERVAL = 5 * 60 * 1000; // 5分钟同步一次

class CollectedStore {
  private state: CollectedState = {
    collectedIds: [],
    lastSync: 0
  };
  private listeners: Set<(collected: Set<string>) => void> = new Set();

  /**
   * 初始化 - 从storage加载并同步
   */
  async init(): Promise<void> {
    await this.load();
    await this.syncFromBackend();
  }

  /**
   * 从chrome.storage加载
   */
  private async load(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        this.state = result[STORAGE_KEY];
      }
    } catch (e) {
      console.error('[CollectedStore] Load failed:', e);
    }
  }

  /**
   * 保存到chrome.storage
   */
  private async save(): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: this.state });
    } catch (e) {
      console.error('[CollectedStore] Save failed:', e);
    }
  }

  /**
   * 从后端同步已采集ID列表
   */
  async syncFromBackend(): Promise<void> {
    try {
      const config = await this.getConfig();
      if (!config.apiUrl) return;

      const response = await fetch(`${config.apiUrl}/api/market-signals/collected-ids`, {
        method: 'GET',
        headers: {
          'X-API-Key': config.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.collectedIds && Array.isArray(data.collectedIds)) {
          // 合并后端数据
          const backendIds = new Set<string>();
          data.collectedIds.forEach((id: unknown) => {
            if (typeof id === 'string') backendIds.add(id);
          });
          const localIds = new Set(this.state.collectedIds);
          // 以本地为准（本地可能有未同步的新数据）
          backendIds.forEach(id => localIds.add(id));
          this.state.collectedIds = Array.from(localIds);
          this.state.lastSync = Date.now();
          await this.save();
          this.notifyListeners();
        }
      }
    } catch (e) {
      console.error('[CollectedStore] Sync failed:', e);
    }
  }

  /**
   * 检查商品是否已采集
   */
  isCollected(productId: string): boolean {
    return this.state.collectedIds.includes(productId);
  }

  /**
   * 标记商品已采集
   */
  async markCollected(productId: string): Promise<void> {
    if (!this.isCollected(productId)) {
      this.state.collectedIds.push(productId);
      this.state.lastSync = Date.now();
      await this.save();
      this.notifyListeners();
    }
  }

  /**
   * 批量标记已采集
   */
  async markBatchCollected(productIds: string[]): Promise<void> {
    let changed = false;
    for (const id of productIds) {
      if (!this.isCollected(id)) {
        this.state.collectedIds.push(id);
        changed = true;
      }
    }
    if (changed) {
      this.state.lastSync = Date.now();
      await this.save();
      this.notifyListeners();
    }
  }

  /**
   * 获取已采集ID的Set
   */
  getCollectedSet(): Set<string> {
    return new Set(this.state.collectedIds);
  }

  /**
   * 获取上次同步时间
   */
  getLastSync(): number {
    return this.state.lastSync;
  }

  /**
   * 订阅变化通知
   */
  subscribe(callback: (collected: Set<string>) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const collected = this.getCollectedSet();
    this.listeners.forEach(cb => cb(collected));
  }

  /**
   * 获取配置（从message-bus获取）
   */
  private async getConfig(): Promise<{ apiUrl?: string; apiKey?: string }> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (response) => {
        resolve(response || {});
      });
    });
  }

  /**
   * 检查是否需要同步
   */
  needsSync(): boolean {
    return Date.now() - this.state.lastSync > SYNC_INTERVAL;
  }
}

export const collectedStore = new CollectedStore();
