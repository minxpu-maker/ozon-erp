/**
 * Ozon/WB 插件 Content Script 主入口
 * 协调所有UI组件：导航栏、面板、选品模式、辅助元素
 */

import { MessageBus } from '../shared/message-bus';
import { collectedStore } from '../shared/collected-store';
import { OzonExtConfig, ProductInfo, MarketSignalPayload } from '../shared/types';
import { NavbarManager } from './navbar';
import { PanelManager } from './overlay';
import { KeywordsPanelManager } from './keywords-panel';
import { SelectionManager } from './selection';
import { HelperManager } from './helpers';
import { extractOzonProduct, extractOzonSearchResults } from './ozon';
import { extractWbSignal } from './wb';

// 检测页面类型
type PageType = 'ozon-product' | 'ozon-search' | 'ozon-category' | 'wb-product' | 'wb-search' | 'unknown';

function detectPageType(): PageType {
  const url = window.location.href;

  // Ozon（支持 ozon.ru, ozon.by 等）
  if (/ozon\.(ru|by|kg|kz|uz)\/product\//.test(url)) return 'ozon-product';
  if (/ozon\.(ru|by|kg|kz|uz)\/search/.test(url)) return 'ozon-search';
  if (/ozon\.(ru|by|kg|kz|uz)\/category/.test(url)) return 'ozon-category';

  // Wildberries（支持 wildberries.ru, wildberries.by 等）
  if (/wildberries\.(ru|by|cn|ua|kz|kg|uz)\/catalog\//.test(url)) return 'wb-product';
  if (/wildberries\.(ru|by|cn|ua|kz|kg|uz)\/search/.test(url)) return 'wb-search';

  return 'unknown';
}

// 检测平台
function detectPlatform(): 'ozon' | 'wb' | null {
  const url = window.location.href;
  if (/ozon\.(ru|by|kg|kz|uz)/.test(url)) return 'ozon';
  if (/wildberries\.(ru|by|cn|ua|kz|kg|uz)/.test(url)) return 'wb';
  return null;
}

class ContentScriptMain {
  private messageBus: MessageBus;
  private navbar: NavbarManager;
  private panel: PanelManager;
  private keywordsPanel: KeywordsPanelManager;
  private selection: SelectionManager;
  private helpers: HelperManager;
  private config: OzonExtConfig | null = null;
  private pageType: PageType = 'unknown';
  private platform: 'ozon' | 'wb' | null = null;
  private currentProduct: ProductInfo | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.messageBus = new MessageBus();
    this.navbar = new NavbarManager(this.messageBus);
    this.panel = new PanelManager(this.messageBus);
    this.keywordsPanel = new KeywordsPanelManager(this.messageBus);
    this.selection = new SelectionManager(this.messageBus);
    this.helpers = new HelperManager(this.messageBus);

    this.init();
  }

  private async init(): Promise<void> {
    // 检测页面
    this.pageType = detectPageType();
    this.platform = detectPlatform();

    if (!this.platform) {
      console.log('[OzonExt] Unknown platform, skipping...');
      return;
    }

    // 加载配置
    await this.loadConfig();

    // 初始化已采集状态存储
    await collectedStore.init();

    // 初始化组件
    this.initComponents();

    // 监听来自service-worker的消息
    this.setupMessageListener();

    // 监听页面变化
    this.observePageChanges();

    this.isInitialized = true;
    console.log('[OzonExt] Content script initialized', { pageType: this.pageType, platform: this.platform });
  }

  private async loadConfig(): Promise<void> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (response) => {
        if (response) {
          this.config = response;
          this.applyConfig();
        }
        resolve();
      });
    });
  }

  private applyConfig(): void {
    if (!this.config?.enabled) {
      this.destroy();
      return;
    }

    this.navbar.setConfig(this.config);
    this.panel.setConfig(this.config);
    this.keywordsPanel.setConfig(this.config);
    this.selection.setConfig(this.config);
    this.helpers.setConfig(this.config);
  }

  private initComponents(): void {
    if (!this.config?.enabled) return;

    // 初始化导航栏（所有页面）
    this.navbar.init();
    this.navbar.setCallbacks({
      onToggleSelectionMode: (enabled) => this.toggleSelectionMode(enabled),
      onToggleFullscreen: () => this.panel.toggleFullscreen(),
      onClose: () => {
        this.panel.hide();
        this.keywordsPanel.hide();
      },
    });

    // 初始化关键词面板
    this.keywordsPanel.init();

    // 根据页面类型初始化对应组件
    if (this.pageType.includes('product')) {
      this.initProductPage();
    } else if (this.pageType.includes('search') || this.pageType.includes('category')) {
      this.initSearchPage();
    }

    // 初始化辅助元素
    this.helpers.init();
    this.helpers.setOnLanguageChange((lang) => {
      this.navbar.setLanguage(lang);
      this.panel.setLanguage(lang);
      this.keywordsPanel.setConfig({ language: lang });
    });
  }

  private initProductPage(): void {
    // 使用V4提取器提取商品信息
    let payload: MarketSignalPayload | null = null;

    if (this.platform === 'ozon') {
      payload = extractOzonProduct();
    } else if (this.platform === 'wb') {
      payload = extractWbSignal();
    }

    if (payload) {
      // 检查是否已采集
      const isCollected = collectedStore.isCollected(payload.productId);

      // 转换为ProductInfo格式
      const productInfo: ProductInfo = {
        platform: this.platform as 'ozon' | 'wb',
        productId: payload.productId,
        title: payload.productTitle,
        imageUrl: payload.imageUrl || '',
        images: payload.images,
        price: payload.price,
        originalPrice: payload.originalPrice,
        rating: payload.rating,
        reviewsCount: payload.reviewsCount,
        salesVolume: payload.salesVolume,
        revenue: payload.revenue,
        profitRate: payload.profitRate,
        sellerName: payload.sellerName,
        sellerType: payload.sellerType,
        followerCount: payload.followerCount,
        variantCount: payload.variantCount,
        deliveryType: payload.deliveryType,
        weight: payload.weight,
        dimensions: payload.dimensions,
        volume: payload.volume,
        listedDate: payload.listedDate,
        stock: payload.stock,
        brand: payload.brandName,
        category: payload.categoryPath,
      };

      this.currentProduct = productInfo;
      // 传递已采集状态
      this.panel.init(productInfo, isCollected);
    }
  }

  private initSearchPage(): void {
    // 自动启用选品模式
    this.selection.enable(true);
    this.navbar.setActiveTab('selection-mode');

    // 使用V4提取器提取搜索结果
    let payloads: MarketSignalPayload[] = [];

    if (this.platform === 'ozon') {
      payloads = extractOzonSearchResults();
    } else if (this.platform === 'wb') {
      // WB暂未实现批量提取，使用简单提取
      payloads = this.extractWbSearchResultsSimple();
    }

    // 转换为ProductInfo格式
    const products: ProductInfo[] = payloads.map((p) => ({
      platform: this.platform as 'ozon' | 'wb',
      productId: p.productId,
      title: p.productTitle,
      imageUrl: p.imageUrl || '',
      price: p.price,
      rating: p.rating,
      reviewsCount: p.reviewsCount,
      sellerName: p.sellerName,
      sellerType: p.sellerType,
      weight: p.weight,
      volume: p.volume,
      brand: p.brandName,
      category: p.categoryPath,
    }));

    this.selection.updateProducts(products);
  }

  /**
   * 简单的WB搜索结果提取（待V4实现）
   */
  private extractWbSearchResultsSimple(): MarketSignalPayload[] {
    const payloads: MarketSignalPayload[] = [];
    const cards = document.querySelectorAll('.product-card, .c-card');

    cards.forEach((card) => {
      const productId = card.getAttribute('data-card-id') ||
                       card.querySelector('[data-nm-id]')?.getAttribute('data-nm-id') || '';
      const titleEl = card.querySelector('.product-card__name, h3');
      const title = titleEl?.textContent?.trim() || '';
      const priceEl = card.querySelector('[class*="price"] span');
      const price = priceEl ? parseFloat(priceEl.textContent?.replace(/[^\d.,]/g, '').replace(',', '.') || '0') : undefined;

      if (productId && title) {
        payloads.push({
          sourceType: 'wb',
          signalType: 'demand',
          productId,
          productTitle: title,
          price,
          imageUrl: card.querySelector('img')?.getAttribute('src') || undefined,
        });
      }
    });

    return payloads;
  }

  private toggleSelectionMode(enabled: boolean): void {
    this.selection.enable(enabled);

    if (enabled) {
      this.panel.hide();
      // initSearchPage会调用updateProducts，无需重复
    } else {
      this.selection.enable(false);
    }
  }

  private setupMessageListener(): void {
    this.messageBus.on('CONFIG_UPDATED', (config: OzonExtConfig) => {
      this.config = config;
      this.applyConfig();
    });

    this.messageBus.on('PUSH_SIGNAL', (payload) => {
      this.pushSignalToERP(payload);
    });

    this.messageBus.on('OPEN_DETAILS', (data: unknown) => {
      const details = data as { product: ProductInfo };
      this.openDetails(details.product);
    });

    this.messageBus.on('OPEN_FEEDBACK', () => {
      this.openFeedback();
    });

    this.messageBus.on('SAVE_CONFIG', (config) => {
      chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', config });
    });

    // 监听关键词挖掘请求（从商品面板点击关键词标签）
    this.messageBus.on('OPEN_KEYWORD_MINING', (data: { keyword: string }) => {
      this.navbar.setActiveTab('keyword-mining');
      this.keywordsPanel.show('mining', undefined, data.keyword);
    });

    // 监听Tab切换事件
    this.messageBus.on('tab-changed', (data: { tab: string }) => {
      this.handleTabChange(data.tab);
    });
  }

  private handleTabChange(tab: string): void {
    // 关闭其他面板
    this.panel.hide();
    this.selection.enable(false);

    switch (tab) {
      case 'keyword-reverse':
        // 关键词反查 - 需要在商品详情页
        if (this.pageType.includes('product') && this.currentProduct) {
          this.keywordsPanel.show('reverse', this.currentProduct.productId);
        } else {
          // 不在商品详情页，提示用户
          alert('关键词反查需要在商品详情页使用');
        }
        break;
      case 'keyword-mining':
        // 关键词挖掘
        this.keywordsPanel.show('mining');
        break;
    }
  }

  private async pushSignalToERP(payload: any): Promise<void> {
    try {
      // 使用批量推送API
      const response = await fetch(`${this.config?.apiUrl}/api/market-signals/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config?.apiKey || '',
        },
        body: JSON.stringify({
          shopId: this.config?.shopId,
          signals: [payload],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.ok) {
          this.panel.setCollected(true);
          // 更新本地已采集状态
          collectedStore.markCollected(payload.productId);
          // 通知选品模式该商品已采集
          this.messageBus.send('SIGNAL_COLLECTED', { productId: payload.productId });
        }
      } else {
        console.error('[OzonExt] Push failed:', response.status);
      }
    } catch (error) {
      console.error('[OzonExt] Failed to push signal:', error);
    }
  }

  private openDetails(product: ProductInfo): void {
    // 可以打开详情页或高亮显示
    console.log('[OzonExt] Open details:', product);
  }

  private openFeedback(): void {
    // 可以打开反馈表单
    console.log('[OzonExt] Open feedback');
  }

  private observePageChanges(): void {
    let lastUrl = window.location.href;

    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        this.handlePageChange();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  private handlePageChange(): void {
    // 重新检测页面类型
    const newPageType = detectPageType();
    if (newPageType !== this.pageType) {
      this.pageType = newPageType;
      this.destroy();
      this.initComponents();
    }
  }

  private destroy(): void {
    this.navbar.destroy();
    this.panel.destroy();
    this.keywordsPanel.destroy();
    this.selection.destroy();
    this.helpers.destroy();
    this.isInitialized = false;
  }
}

// 初始化
new ContentScriptMain();
