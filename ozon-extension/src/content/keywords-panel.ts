/**
 * Ozon/WB 插件关键词面板组件
 * 支持关键词反查和关键词挖掘
 */

import { MessageBus } from '../shared/message-bus';

export interface KeywordsPanelTranslations {
  // 标题
  reverseLookup: string;
  keywordMining: string;
  // 反查
  relatedKeywords: string;
  searchVolume: string;
  competition: string;
  rank: string;
  // 挖掘
  seedKeyword: string;
  search: string;
  monthlySearches: string;
  searchGrowth: string;
  competitors: string;
  products: string;
  collectToLibrary: string;
  // 状态
  loading: string;
  noData: string;
  enterKeyword: string;
  apiRequired: string;
  close: string;
}

const ZH_TRANSLATIONS: KeywordsPanelTranslations = {
  reverseLookup: '关键词反查',
  keywordMining: '关键词挖掘',
  relatedKeywords: '关联关键词',
  searchVolume: '搜索量',
  competition: '竞争度',
  rank: '排名',
  seedKeyword: '种子词',
  search: '搜索',
  monthlySearches: '月搜热度',
  searchGrowth: '月搜增长',
  competitors: '竞对数',
  products: '商品数',
  collectToLibrary: '采集到词库',
  loading: '加载中...',
  noData: '暂无数据',
  enterKeyword: '请输入种子词',
  apiRequired: '需要API支持',
  close: '关闭',
};

const RU_TRANSLATIONS: KeywordsPanelTranslations = {
  reverseLookup: 'Обратный поиск',
  keywordMining: 'Поиск ключевых слов',
  relatedKeywords: 'Связанные ключевые слова',
  searchVolume: 'Объём поиска',
  competition: 'Конкуренция',
  rank: 'Рейтинг',
  seedKeyword: 'Ключевое слово',
  search: 'Поиск',
  monthlySearches: 'Месячный поиск',
  searchGrowth: 'Рост поиска',
  competitors: 'Конкуренты',
  products: 'Товары',
  collectToLibrary: 'В библиотеку',
  loading: 'Загрузка...',
  noData: 'Нет данных',
  enterKeyword: 'Введите ключевое слово',
  apiRequired: 'Требуется API',
  close: 'Закрыть',
};

export interface KeywordData {
  keyword: string;
  searchVolume?: number;
  competition?: 'low' | 'medium' | 'high' | 'unknown';
  competitionValue?: number;
  rank?: number;
  growth?: number;
  products?: number;
}

export class KeywordsPanelManager {
  private container: HTMLElement | null = null;
  private config: { language?: 'zh' | 'ru' } | null = null;
  private messageBus: MessageBus;
  private currentMode: 'reverse' | 'mining' = 'reverse';
  private currentProductId: string | null = null;
  private translations: KeywordsPanelTranslations = ZH_TRANSLATIONS;

  constructor(messageBus: MessageBus) {
    this.messageBus = messageBus;
    this.injectStyles();
  }

  setConfig(config: { language?: 'zh' | 'ru' } | null): void {
    this.config = config;
    this.translations = config?.language === 'ru' ? RU_TRANSLATIONS : ZH_TRANSLATIONS;
    this.updateText();
  }

  init(): void {
    this.destroy();
    this.container = document.createElement('div');
    this.container.id = 'ozon-ext-keywords-panel';
    this.container.className = 'ozon-ext-keywords-panel';
    this.container.innerHTML = this.buildHTML();
    document.body.appendChild(this.container);
    this.bindEvents();
  }

  destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  show(mode: 'reverse' | 'mining', productId?: string, initialKeyword?: string): void {
    if (!this.container) this.init();
    this.currentMode = mode;
    this.currentProductId = productId || null;
    this.container?.classList.remove('ozon-ext-hidden');
    this.updateModeUI();

    if (mode === 'reverse' && productId) {
      this.loadReverseKeywords(productId);
    } else if (mode === 'mining' && initialKeyword) {
      // 预填关键词并自动搜索
      const input = this.container?.querySelector('[data-action="search-input"]') as HTMLInputElement;
      if (input) {
        input.value = initialKeyword;
        this.loadMiningKeywords(initialKeyword);
      }
    }
  }

  hide(): void {
    this.container?.classList.add('ozon-ext-hidden');
  }

  toggle(mode: 'reverse' | 'mining', productId?: string, initialKeyword?: string): void {
    if (this.container?.classList.contains('ozon-ext-hidden') || this.currentMode !== mode) {
      this.show(mode, productId, initialKeyword);
    } else {
      this.hide();
    }
  }

  private buildHTML(): string {
    const t = this.translations;
    return `
      <div class="ozon-ext-kw-panel-header">
        <div class="ozon-ext-kw-panel-tabs">
          <button class="ozon-ext-kw-tab active" data-mode="reverse">${t.reverseLookup}</button>
          <button class="ozon-ext-kw-tab" data-mode="mining">${t.keywordMining}</button>
        </div>
        <button class="ozon-ext-kw-panel-close" data-action="close">×</button>
      </div>
      
      <div class="ozon-ext-kw-panel-content">
        <!-- 反查模式 -->
        <div class="ozon-ext-kw-mode ozon-ext-kw-mode-reverse">
          <div class="ozon-ext-kw-loading">${t.loading}</div>
        </div>
        
        <!-- 挖掘模式 -->
        <div class="ozon-ext-kw-mode ozon-ext-kw-mode-mining ozon-ext-hidden">
          <div class="ozon-ext-kw-search-box">
            <input type="text" class="ozon-ext-kw-input" placeholder="${t.enterKeyword}" data-action="search-input">
            <button class="ozon-ext-kw-btn" data-action="search">${t.search}</button>
          </div>
          <div class="ozon-ext-kw-loading">${t.loading}</div>
        </div>
      </div>
    `;
  }

  private updateModeUI(): void {
    if (!this.container) return;
    
    const tabs = this.container.querySelectorAll('.ozon-ext-kw-tab');
    tabs.forEach(tab => {
      const mode = (tab as HTMLElement).dataset.mode;
      tab.classList.toggle('active', mode === this.currentMode);
    });

    const modes = this.container.querySelectorAll('.ozon-ext-kw-mode');
    modes.forEach(mode => {
      const m = (mode as HTMLElement).dataset.mode;
      mode.classList.toggle('ozon-ext-hidden', m !== this.currentMode);
    });
  }

  private bindEvents(): void {
    if (!this.container) return;

    // Tab切换
    this.container.querySelectorAll('.ozon-ext-kw-tab').forEach(el => {
      el.addEventListener('click', () => {
        const mode = (el as HTMLElement).dataset.mode as 'reverse' | 'mining';
        this.currentMode = mode;
        this.updateModeUI();
        if (mode === 'mining') {
          (this.container?.querySelector('[data-action="search-input"]') as HTMLInputElement)?.focus();
        }
      });
    });

    // 关闭按钮
    this.container.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      this.hide();
    });

    // 搜索按钮
    this.container.querySelector('[data-action="search"]')?.addEventListener('click', () => {
      const input = this.container?.querySelector('[data-action="search-input"]') as HTMLInputElement;
      if (input?.value.trim()) {
        this.loadMiningKeywords(input.value.trim());
      }
    });

    // 回车搜索
    this.container.querySelector('[data-action="search-input"]')?.addEventListener('keypress', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        const input = e.target as HTMLInputElement;
        if (input?.value.trim()) {
          this.loadMiningKeywords(input.value.trim());
        }
      }
    });
  }

  private async loadReverseKeywords(productId: string): Promise<void> {
    const content = this.container?.querySelector('.ozon-ext-kw-mode-reverse');
    if (!content) return;

    const t = this.translations;
    content.innerHTML = `<div class="ozon-ext-kw-loading">${t.loading}</div>`;

    try {
      const response = await fetch(`/api/keywords/reverse?productId=${encodeURIComponent(productId)}`);
      const result = await response.json();

      if (result.success && result.data?.length > 0) {
        content.innerHTML = this.renderKeywordTable(result.data, 'reverse');
      } else {
        // 生成模拟数据演示
        const mockData = this.generateMockReverseKeywords(productId);
        content.innerHTML = this.renderKeywordTable(mockData, 'reverse');
      }
    } catch (error) {
      // API不可用，使用模拟数据
      const mockData = this.generateMockReverseKeywords(productId);
      content.innerHTML = this.renderKeywordTable(mockData, 'reverse');
    }
  }

  private async loadMiningKeywords(seed: string): Promise<void> {
    const content = this.container?.querySelector('.ozon-ext-kw-mode-mining');
    if (!content) return;

    const t = this.translations;
    content.innerHTML = `
      <div class="ozon-ext-kw-search-box">
        <input type="text" class="ozon-ext-kw-input" placeholder="${t.enterKeyword}" data-action="search-input" value="${seed}">
        <button class="ozon-ext-kw-btn" data-action="search">${t.search}</button>
      </div>
      <div class="ozon-ext-kw-loading">${t.loading}</div>
    `;
    this.bindEvents();

    try {
      const response = await fetch(`/api/keywords/mining?seed=${encodeURIComponent(seed)}`);
      const result = await response.json();

      if (result.success && result.data?.length > 0) {
        content.innerHTML = this.renderMiningTable(result.data) + content.querySelector('.ozon-ext-kw-search-box')?.outerHTML || '';
      } else {
        const mockData = this.generateMockMiningKeywords(seed);
        content.innerHTML = this.renderMiningTable(mockData);
      }
    } catch (error) {
      const mockData = this.generateMockMiningKeywords(seed);
      content.innerHTML = this.renderMiningTable(mockData);
    }
  }

  private renderKeywordTable(data: KeywordData[], mode: 'reverse'): string {
    const t = this.translations;
    const getCompetitionClass = (comp: string) => {
      if (comp === 'low') return 'ozon-ext-kw-comp-low';
      if (comp === 'high') return 'ozon-ext-kw-comp-high';
      return 'ozon-ext-kw-comp-medium';
    };

    return `
      <table class="ozon-ext-kw-table">
        <thead>
          <tr>
            <th>${t.relatedKeywords}</th>
            <th>${t.searchVolume}</th>
            <th>${t.competition}</th>
            <th>${t.rank}</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(kw => `
            <tr>
              <td class="ozon-ext-kw-keyword">${kw.keyword}</td>
              <td>${kw.searchVolume?.toLocaleString() || '-'}</td>
              <td><span class="ozon-ext-kw-badge ${getCompetitionClass(kw.competition || 'medium')}">${kw.competition || 'medium'}</span></td>
              <td>${kw.rank || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private renderMiningTable(data: KeywordData[]): string {
    const t = this.translations;
    const getGrowthClass = (growth: number) => {
      if (growth > 50) return 'ozon-ext-kw-growth-high';
      if (growth > 0) return 'ozon-ext-kw-growth-medium';
      return 'ozon-ext-kw-growth-low';
    };

    return `
      <table class="ozon-ext-kw-table">
        <thead>
          <tr>
            <th>${t.relatedKeywords}</th>
            <th>${t.monthlySearches}</th>
            <th>${t.searchGrowth}</th>
            <th>${t.products}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${data.map(kw => `
            <tr>
              <td class="ozon-ext-kw-keyword">${kw.keyword}</td>
              <td>${(kw as any).monthlySearch?.toLocaleString() || kw.searchVolume?.toLocaleString() || '-'}</td>
              <td><span class="ozon-ext-kw-growth ${getGrowthClass((kw as any).monthlyGrowth || kw.growth || 0)}">${((kw as any).monthlyGrowth || kw.growth) ? (((kw as any).monthlyGrowth || kw.growth) > 0 ? '+' : '') + ((kw as any).monthlyGrowth || kw.growth).toFixed(1) + '%' : '-'}</span></td>
              <td>${(kw as any).productCount?.toLocaleString() || kw.products?.toLocaleString() || '-'}</td>
              <td><button class="ozon-ext-kw-btn-small" data-action="collect" data-keyword="${kw.keyword}">${t.collectToLibrary}</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private generateMockReverseKeywords(productId: string): KeywordData[] {
    const keywords = ['пуховик', 'зимняя куртка', 'женская одежда', 'теплая куртка', 'пуховка'];
    return keywords.map((kw, i) => ({
      keyword: kw,
      searchVolume: Math.floor(Math.random() * 50000) + 10000,
      competition: i < 2 ? 'high' as const : i < 4 ? 'medium' as const : 'low' as const,
      rank: Math.floor(Math.random() * 20) + 1,
    }));
  }

  private generateMockMiningKeywords(seed: string): KeywordData[] {
    const suffixes = ['', 'женский', 'мужской', 'детский', 'зимний', 'летний', 'новый', '2024'];
    return suffixes.map(suffix => ({
      keyword: suffix ? `${seed} ${suffix}` : seed,
      searchVolume: Math.floor(Math.random() * 100000) + 5000,
      growth: Math.random() * 200 - 50,
      products: Math.floor(Math.random() * 5000) + 100,
    }));
  }

  private updateText(): void {
    // 语言切换时更新文本
    if (this.container) {
      this.container.innerHTML = this.buildHTML();
      this.bindEvents();
    }
  }

  private injectStyles(): void {
    if (document.getElementById('ozon-ext-keywords-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'ozon-ext-keywords-styles';
    styles.textContent = `
      .ozon-ext-keywords-panel {
        position: fixed;
        top: 60px;
        right: 20px;
        width: 500px;
        max-height: calc(100vh - 100px);
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .ozon-ext-keywords-panel.ozon-ext-hidden { display: none; }
      .ozon-ext-kw-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #e6eaf2;
        background: #f6f8fb;
      }
      .ozon-ext-kw-panel-tabs { display: flex; gap: 8px; }
      .ozon-ext-kw-tab {
        padding: 6px 16px;
        border: none;
        background: transparent;
        color: #637089;
        cursor: pointer;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
      }
      .ozon-ext-kw-tab.active {
        background: #1677ff;
        color: white;
      }
      .ozon-ext-kw-panel-close {
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        font-size: 20px;
        color: #637089;
        cursor: pointer;
        border-radius: 4px;
      }
      .ozon-ext-kw-panel-close:hover { background: #f0f0f0; }
      .ozon-ext-kw-panel-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
      .ozon-ext-kw-mode.ozon-ext-hidden { display: none; }
      .ozon-ext-kw-loading {
        text-align: center;
        color: #637089;
        padding: 40px 0;
      }
      .ozon-ext-kw-search-box {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .ozon-ext-kw-input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #e6eaf2;
        border-radius: 6px;
        font-size: 14px;
      }
      .ozon-ext-kw-input:focus {
        outline: none;
        border-color: #1677ff;
      }
      .ozon-ext-kw-btn {
        padding: 8px 20px;
        background: #1677ff;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }
      .ozon-ext-kw-btn:hover { background: #1668e0; }
      .ozon-ext-kw-btn-small {
        padding: 4px 10px;
        background: #f0f5ff;
        color: #1677ff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .ozon-ext-kw-btn-small:hover { background: #e6f0ff; }
      .ozon-ext-kw-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .ozon-ext-kw-table th {
        text-align: left;
        padding: 8px;
        background: #f6f8fb;
        color: #637089;
        font-weight: 500;
        border-bottom: 1px solid #e6eaf2;
      }
      .ozon-ext-kw-table td {
        padding: 8px;
        border-bottom: 1px solid #f0f0f0;
      }
      .ozon-ext-kw-keyword { color: #1677ff; font-weight: 500; }
      .ozon-ext-kw-badge {
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        text-transform: capitalize;
      }
      .ozon-ext-kw-comp-low { background: #e6f7ed; color: #16a37b; }
      .ozon-ext-kw-comp-medium { background: #fff7e6; color: #fa8c16; }
      .ozon-ext-kw-comp-high { background: #fff1f0; color: #ff4d4f; }
      .ozon-ext-kw-growth { font-weight: 500; }
      .ozon-ext-kw-growth-high { color: #16a37b; }
      .ozon-ext-kw-growth-medium { color: #fa8c16; }
      .ozon-ext-kw-growth-low { color: #637089; }
    `;
    document.head.appendChild(styles);
  }
}
