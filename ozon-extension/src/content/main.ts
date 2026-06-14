/**
 * Ozon/WB 插件 Content Script 主入口
 * 协调所有UI组件：导航栏、面板、选品模式、辅助元素
 */

import { MessageBus } from '../shared/message-bus';
import { OzonExtConfig, ProductInfo } from '../shared/types';
import { NavbarManager } from './navbar';
import { PanelManager } from './overlay';
import { SelectionManager } from './selection';
import { HelperManager } from './helpers';

// 检测页面类型
type PageType = 'ozon-product' | 'ozon-search' | 'ozon-category' | 'wb-product' | 'wb-search' | 'unknown';

function detectPageType(): PageType {
  const url = window.location.href;

  // Ozon
  if (/ozon\.ru\/product\//.test(url)) return 'ozon-product';
  if (/ozon\.ru\/search/.test(url)) return 'ozon-search';
  if (/ozon\.ru\/category/.test(url)) return 'ozon-category';

  // Wildberries
  if (/wildberries\.ru\/catalog\/.*\/.*/.test(url)) return 'wb-product';
  if (/wildberries\.ru\/search/.test(url)) return 'wb-search';

  return 'unknown';
}

// 检测平台
function detectPlatform(): 'ozon' | 'wb' | null {
  const url = window.location.href;
  if (/ozon\.ru/.test(url)) return 'ozon';
  if (/wildberries\.ru/.test(url)) return 'wb';
  return null;
}

class ContentScriptMain {
  private messageBus: MessageBus;
  private navbar: NavbarManager;
  private panel: PanelManager;
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
      onClose: () => this.panel.hide(),
    });

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
      this.selection.setLanguage(lang);
    });
  }

  private initProductPage(): void {
    // 提取商品信息
    const productInfo = this.extractProductInfo();
    if (productInfo) {
      this.currentProduct = productInfo;
      this.panel.init(productInfo);
    }
  }

  private initSearchPage(): void {
    // 自动启用选品模式
    this.selection.enable(true);
    this.navbar.setActiveTab('selection-mode');

    // 提取搜索结果中的商品列表
    const products = this.extractProductList();
    this.selection.updateProducts(products);
  }

  private toggleSelectionMode(enabled: boolean): void {
    this.selection.enable(enabled);

    if (enabled) {
      this.panel.hide();
      const products = this.extractProductList();
      this.selection.updateProducts(products);
    } else {
      this.selection.enable(false);
    }
  }

  private extractProductInfo(): ProductInfo | null {
    const platform = this.platform;
    if (!platform) return null;

    // 尝试从页面提取
    const url = window.location.href;
    const productIdMatch = url.match(/\/product\/([^\/\?]+)/);
    const productId = productIdMatch?.[1] || '';

    // 从页面获取标题
    let title = '';
    const titleEl = document.querySelector('h1') || document.querySelector('[data-widget="webProductHeading"] span:first-child');
    if (titleEl) title = titleEl.textContent?.trim() || '';

    // 从页面获取价格
    let price = 0;
    const priceEl = document.querySelector('[data-widget="webPrice"] span:first-child') ||
                    document.querySelector('.price-block__final-price') ||
                    document.querySelector('[class*="price"] span');
    if (priceEl) {
      const priceText = priceEl.textContent?.replace(/[^\d.,]/g, '').replace(',', '.') || '0';
      price = parseFloat(priceText);
    }

    // 基础商品信息
    const info: ProductInfo = {
      platform: platform as 'ozon' | 'wb',
      productId,
      title,
      price,
      imageUrl: '',
      // 其他字段将从V4提取器获取
    };

    return info;
  }

  private extractProductList(): ProductInfo[] {
    const products: ProductInfo[] = [];
    const platform = this.platform;
    if (!platform) return products;

    // Ozon商品卡片
    const ozonCards = document.querySelectorAll('.js-catalogue-tile, [data-widget="searchResultsV2"] .tile, .catalog-tile');

    // WB商品卡片
    const wbCards = document.querySelectorAll('.product-card, .c-card');

    const allCards = [...ozonCards, ...wbCards];

    allCards.forEach((card) => {
      const productId = card.getAttribute('data-id') ||
                       card.getAttribute('data-product-id') ||
                       card.getAttribute('data-card-id') ||
                       card.querySelector('[data-nm-id]')?.getAttribute('data-nm-id') ||
                       '';

      const titleEl = card.querySelector('.goods-name, .product-card__name, h3, [class*="title"]');
      const title = titleEl?.textContent?.trim() || '';

      const priceEl = card.querySelector('[class*="price"] span, .price-block__final-price');
      let price = 0;
      if (priceEl) {
        const priceText = priceEl.textContent?.replace(/[^\d.,]/g, '').replace(',', '.') || '0';
        price = parseFloat(priceText);
      }

      const imgEl = card.querySelector('img');
      const imageUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';

      if (productId && title) {
        products.push({
          platform: platform as 'ozon' | 'wb',
          productId,
          title,
          price,
          imageUrl,
        });
      }
    });

    return products;
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
  }

  private async pushSignalToERP(payload: any): Promise<void> {
    try {
      const response = await fetch(`${this.config?.apiUrl}/api/market-signals/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config?.apiKey || '',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        this.panel.setCollected(true);
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
    this.selection.destroy();
    this.helpers.destroy();
    this.isInitialized = false;
  }
}

// 初始化
new ContentScriptMain();
