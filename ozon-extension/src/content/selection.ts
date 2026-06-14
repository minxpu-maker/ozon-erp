/**
 * Ozon/WB 选品模式组件
 * 搜索/类目页批量勾选和采集
 */

import { MessageBus } from '../shared/message-bus';
import { OzonExtConfig, ProductInfo } from '../shared/types';

export interface SelectionTranslations {
  selectedCount: string;
  selectAll: string;
  collectSelected: string;
  collectAll: string;
  collecting: string;
  collected: string;
}

const ZH_TRANSLATIONS: SelectionTranslations = {
  selectedCount: '已选',
  selectAll: '全选本页',
  collectSelected: '采集选中',
  collectAll: '采集全页',
  collecting: '采集中...',
  collected: '已采集',
};

const RU_TRANSLATIONS: SelectionTranslations = {
  selectedCount: 'Выбрано',
  selectAll: 'Выбрать все',
  collectSelected: 'Собрать выбранные',
  collectAll: 'Собрать все',
  collecting: 'Сбор...',
  collected: 'Собрано',
};

export class SelectionManager {
  private container: HTMLElement | null = null;
  private selectedIds: Set<string> = new Set();
  private products: ProductInfo[] = [];
  private translations: SelectionTranslations = ZH_TRANSLATIONS;
  private language: 'zh' | 'ru' = 'zh';
  private messageBus: MessageBus;
  private config: OzonExtConfig | null = null;
  private isSelectionMode: boolean = false;

  constructor(messageBus: MessageBus) {
    this.messageBus = messageBus;
  }

  /**
   * 设置配置
   */
  setConfig(config: OzonExtConfig | null): void {
    this.config = config;
    this.language = config?.language === 'ru' ? 'ru' : 'zh';
    this.translations = this.language === 'ru' ? RU_TRANSLATIONS : ZH_TRANSLATIONS;
  }

  /**
   * 启用/禁用选品模式
   */
  enable(enabled: boolean): void {
    this.isSelectionMode = enabled;
    if (enabled) {
      this.init();
    } else {
      this.destroy();
    }
  }

  /**
   * 更新产品列表
   */
  updateProducts(products: ProductInfo[]): void {
    this.products = products;
    this.injectCheckboxes();
    this.updateBar();
  }

  /**
   * 更新语言
   */
  setLanguage(lang: 'zh' | 'ru'): void {
    this.language = lang;
    this.translations = lang === 'ru' ? RU_TRANSLATIONS : ZH_TRANSLATIONS;
    this.updateBar();
  }

  /**
   * 初始化
   */
  private init(): void {
    if (!this.isSelectionMode) return;

    // 注入样式
    this.injectStyles();

    // 创建顶部操作栏
    this.createActionBar();

    // 注入勾选框
    this.injectCheckboxes();

    // 监听页面变化
    this.observeMutations();
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.removeAllCheckboxes();
    this.selectedIds.clear();
    this.isSelectionMode = false;
  }

  /**
   * 创建顶部操作栏
   */
  private createActionBar(): void {
    // 移除已存在的
    const existing = document.getElementById('ozon-ext-selection-bar');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'ozon-ext-selection-bar';
    this.container.className = 'ozon-ext-selection-bar';

    this.container.innerHTML = this.buildBarHTML();

    // 插入到页面顶部
    const target = document.querySelector('main') || document.body;
    target.insertBefore(this.container, target.firstChild);

    // 绑定事件
    this.bindBarEvents();
  }

  /**
   * 构建操作栏HTML
   */
  private buildBarHTML(): string {
    const t = this.translations;
    return `
      <div class="ozon-ext-selection-bar-inner">
        <div class="ozon-ext-selection-bar-left">
          <span class="ozon-ext-selection-count">
            ${t.selectedCount}: <strong class="ozon-ext-selection-count-num">${this.selectedIds.size}</strong>
          </span>
        </div>
        <div class="ozon-ext-selection-bar-right">
          <button class="ozon-ext-selection-btn" data-action="select-all">
            ${t.selectAll}
          </button>
          <button class="ozon-ext-selection-btn ozon-ext-selection-btn-primary" data-action="collect-selected" ${this.selectedIds.size === 0 ? 'disabled' : ''}>
            ${t.collectSelected}
          </button>
          <button class="ozon-ext-selection-btn ozon-ext-selection-btn-primary" data-action="collect-all">
            ${t.collectAll}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 注入勾选框到商品卡片
   */
  private injectCheckboxes(): void {
    if (!this.isSelectionMode) return;

    // Ozon商品卡片
    const ozonCards = document.querySelectorAll('.js-catalogue-tile, [data-widget="searchResultsV2"] .tile, .catalog-tile');

    // WB商品卡片
    const wbCards = document.querySelectorAll('.product-card, .c-card');

    const allCards = [...ozonCards, ...wbCards];

    allCards.forEach((card) => {
      // 检查是否已注入勾选框
      if (card.querySelector('.ozon-ext-checkbox')) return;

      // 创建勾选框
      const checkbox = document.createElement('div');
      checkbox.className = 'ozon-ext-checkbox';
      checkbox.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;

      // 获取商品ID
      const productId = this.extractProductId(card);

      if (productId && this.selectedIds.has(productId)) {
        checkbox.classList.add('checked');
        card.classList.add('ozon-ext-selected');
      }

      // 插入到卡片左上角
      const imgContainer = card.querySelector('.tile-image, .product-card__image, img')?.parentElement;
      if (imgContainer) {
        imgContainer.style.position = 'relative';
        imgContainer.appendChild(checkbox);
      } else {
        card.insertBefore(checkbox, card.firstChild);
      }

      // 绑定点击事件
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSelection(productId, card as HTMLElement);
      });
    });
  }

  /**
   * 移除所有勾选框
   */
  private removeAllCheckboxes(): void {
    document.querySelectorAll('.ozon-ext-checkbox').forEach((el) => el.remove());
    document.querySelectorAll('.ozon-ext-selected').forEach((el) => el.classList.remove('ozon-ext-selected'));
    const bar = document.getElementById('ozon-ext-selection-bar');
    if (bar) bar.remove();
  }

  /**
   * 提取商品ID
   */
  private extractProductId(card: Element): string | null {
    // Ozon
    const ozonId = card.getAttribute('data-id') || card.getAttribute('data-product-id');

    // WB
    const wbId = card.getAttribute('data-card-id') || card.querySelector('[data-nm-id]')?.getAttribute('data-nm-id');

    return ozonId || wbId || null;
  }

  /**
   * 切换选中状态
   */
  private toggleSelection(productId: string | null, card: HTMLElement): void {
    if (!productId) return;

    if (this.selectedIds.has(productId)) {
      this.selectedIds.delete(productId);
      card.classList.remove('ozon-ext-selected');
      card.querySelector('.ozon-ext-checkbox')?.classList.remove('checked');
    } else {
      this.selectedIds.add(productId);
      card.classList.add('ozon-ext-selected');
      card.querySelector('.ozon-ext-checkbox')?.classList.add('checked');
    }

    this.updateBar();
  }

  /**
   * 更新操作栏
   */
  private updateBar(): void {
    const bar = document.getElementById('ozon-ext-selection-bar');
    if (!bar) return;

    const countEl = bar.querySelector('.ozon-ext-selection-count-num');
    if (countEl) countEl.textContent = String(this.selectedIds.size);

    const collectBtn = bar.querySelector('[data-action="collect-selected"]') as HTMLButtonElement;
    if (collectBtn) {
      collectBtn.disabled = this.selectedIds.size === 0;
    }
  }

  /**
   * 绑定操作栏事件
   */
  private bindBarEvents(): void {
    const bar = document.getElementById('ozon-ext-selection-bar');
    if (!bar) return;

    bar.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        switch (action) {
          case 'select-all':
            this.selectAll();
            break;
          case 'collect-selected':
            this.collectSelected();
            break;
          case 'collect-all':
            this.collectAll();
            break;
        }
      });
    });
  }

  /**
   * 全选本页
   */
  private selectAll(): void {
    const cards = document.querySelectorAll('.js-catalogue-tile, [data-widget="searchResultsV2"] .tile, .catalog-tile, .product-card, .c-card');

    cards.forEach((card) => {
      const productId = this.extractProductId(card);
      if (productId) {
        this.selectedIds.add(productId);
        card.classList.add('ozon-ext-selected');
        card.querySelector('.ozon-ext-checkbox')?.classList.add('checked');
      }
    });

    this.updateBar();
  }

  /**
   * 采集选中的商品
   */
  private collectSelected(): void {
    if (this.selectedIds.size === 0) return;

    this.setButtonLoading(true);

    // 发送采集请求
    const promises: Promise<void>[] = [];

    this.selectedIds.forEach((productId) => {
      const product = this.products.find((p) => p.productId === productId);
      if (product) {
        promises.push(this.pushSignal(product));
      }
    });

    Promise.all(promises)
      .then(() => {
        this.setButtonSuccess();
      })
      .catch(() => {
        this.setButtonLoading(false);
      });
  }

  /**
   * 采集全部商品
   */
  private collectAll(): void {
    this.setButtonLoading(true);

    const promises: Promise<void>[] = [];

    this.products.forEach((product) => {
      promises.push(this.pushSignal(product));
    });

    Promise.all(promises)
      .then(() => {
        this.setButtonSuccess();
      })
      .catch(() => {
        this.setButtonLoading(false);
      });
  }

  /**
   * 推送信号到后端
   */
  private async pushSignal(product: ProductInfo): Promise<void> {
    return new Promise((resolve, reject) => {
      this.messageBus.send('PUSH_SIGNAL', {
        platform: product.platform || 'ozon',
        productId: product.productId,
        title: product.title,
        imageUrl: product.imageUrl,
        price: product.price,
        originalPrice: product.originalPrice,
        rating: product.rating,
        reviewsCount: product.reviewsCount,
        salesVolume: product.salesVolume,
        salesRank: product.salesRank,
        salesVolumeRank: product.salesVolumeRank,
        sellerName: product.sellerName,
        sellerType: product.sellerType,
        followerCount: product.followerCount,
        variantCount: product.variantCount,
        deliveryType: product.deliveryType,
        weight: product.weight,
        dimensions: product.dimensions,
        volume: product.volume,
        listedDate: product.listedDate,
        stock: product.stock,
        revenue: product.revenue,
        profitRate: product.profitRate,
        category: product.category,
        brand: product.brand,
      });
      // 模拟成功（实际由messageBus回调处理）
      setTimeout(resolve, 100);
    });
  }

  /**
   * 设置按钮加载状态
   */
  private setButtonLoading(loading: boolean): void {
    const bar = document.getElementById('ozon-ext-selection-bar');
    if (!bar) return;

    bar.querySelectorAll('.ozon-ext-selection-btn').forEach((btn) => {
      (btn as HTMLButtonElement).disabled = loading;
    });

    const collectSelectedBtn = bar.querySelector('[data-action="collect-selected"]');
    const collectAllBtn = bar.querySelector('[data-action="collect-all"]');

    if (loading) {
      collectSelectedBtn && (collectSelectedBtn.textContent = this.translations.collecting);
      collectAllBtn && (collectAllBtn.textContent = this.translations.collecting);
    }
  }

  /**
   * 设置按钮成功状态
   */
  private setButtonSuccess(): void {
    const bar = document.getElementById('ozon-ext-selection-bar');
    if (!bar) return;

    bar.querySelectorAll('.ozon-ext-selection-btn').forEach((btn) => {
      (btn as HTMLButtonElement).disabled = false;
    });

    const collectSelectedBtn = bar.querySelector('[data-action="collect-selected"]');
    const collectAllBtn = bar.querySelector('[data-action="collect-all"]');

    collectSelectedBtn && (collectSelectedBtn.textContent = this.translations.collected);
    collectAllBtn && (collectAllBtn.textContent = this.translations.collected);

    setTimeout(() => {
      const t = this.translations;
      collectSelectedBtn && (collectSelectedBtn.textContent = t.collectSelected);
      collectAllBtn && (collectAllBtn.textContent = t.collectAll);
    }, 2000);
  }

  /**
   * 监听页面变化（动态加载）
   */
  private observeMutations(): void {
    const observer = new MutationObserver((mutations) => {
      let shouldInject = false;

      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && (node as Element).matches?.('.js-catalogue-tile, .tile, .catalog-tile, .product-card, .c-card')) {
              shouldInject = true;
            }
          });
        }
      });

      if (shouldInject && this.isSelectionMode) {
        setTimeout(() => this.injectCheckboxes(), 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * 注入样式
   */
  private injectStyles(): void {
    if (document.getElementById('ozon-ext-selection-styles')) return;

    const style = document.createElement('style');
    style.id = 'ozon-ext-selection-styles';
    style.textContent = `
      .ozon-ext-selection-bar {
        position: sticky !important;
        top: 48px !important;
        left: 0 !important;
        right: 0 !important;
        background: #1677FF !important;
        padding: 12px 16px !important;
        z-index: 2147483645 !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      .ozon-ext-selection-bar-inner {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        max-width: 1200px !important;
        margin: 0 auto !important;
      }

      .ozon-ext-selection-count {
        color: white !important;
        font-size: 14px !important;
      }

      .ozon-ext-selection-count-num {
        font-weight: 600 !important;
        font-size: 16px !important;
      }

      .ozon-ext-selection-bar-right {
        display: flex !important;
        gap: 8px !important;
      }

      .ozon-ext-selection-btn {
        padding: 8px 16px !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        border: 1px solid rgba(255, 255, 255, 0.5) !important;
        border-radius: 4px !important;
        background: transparent !important;
        color: white !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
      }

      .ozon-ext-selection-btn:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        border-color: white !important;
      }

      .ozon-ext-selection-btn:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }

      .ozon-ext-selection-btn-primary {
        background: white !important;
        color: #1677FF !important;
        border-color: white !important;
      }

      .ozon-ext-selection-btn-primary:hover {
        background: rgba(255, 255, 255, 0.9) !important;
      }

      /* 勾选框 */
      .ozon-ext-checkbox {
        position: absolute !important;
        top: 8px !important;
        left: 8px !important;
        width: 24px !important;
        height: 24px !important;
        border: 2px solid rgba(0, 0, 0, 0.2) !important;
        border-radius: 50% !important;
        background: white !important;
        cursor: pointer !important;
        z-index: 10 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.2s !important;
        opacity: 0 !important;
      }

      .ozon-ext-checkbox svg {
        width: 14px !important;
        height: 14px !important;
        color: transparent !important;
        transition: color 0.2s !important;
      }

      .ozon-ext-checkbox:hover {
        border-color: #1677FF !important;
        transform: scale(1.1) !important;
      }

      .ozon-ext-selected .ozon-ext-checkbox,
      .ozon-ext-checkbox.checked {
        background: #1677FF !important;
        border-color: #1677FF !important;
        opacity: 1 !important;
      }

      .ozon-ext-selected .ozon-ext-checkbox svg,
      .ozon-ext-checkbox.checked svg {
        color: white !important;
      }

      /* 卡片hover显示勾选框 */
      .ozon-ext-selected,
      [class*="product-card"]:hover,
      [class*="tile"]:hover,
      [class*="catalog"]:hover {
        position: relative !important;
      }

      .ozon-ext-selected .ozon-ext-checkbox {
        opacity: 1 !important;
      }

      [class*="product-card"]:hover .ozon-ext-checkbox,
      [class*="tile"]:hover .ozon-ext-checkbox,
      [class*="catalog"]:hover .ozon-ext-checkbox {
        opacity: 1 !important;
      }

      /* 响应式 */
      @media (max-width: 768px) {
        .ozon-ext-selection-bar-inner {
          flex-direction: column !important;
          gap: 12px !important;
        }

        .ozon-ext-selection-bar-right {
          width: 100% !important;
          justify-content: center !important;
          flex-wrap: wrap !important;
        }

        .ozon-ext-selection-btn {
          flex: 1 !important;
          min-width: 100px !important;
          text-align: center !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}
