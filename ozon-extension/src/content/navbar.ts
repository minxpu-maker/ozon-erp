/**
 * Ozon/WB 插件导航栏组件
 * 注入到页面顶部的固定定位导航栏
 */

import { MessageBus } from '../shared/message-bus';
import { OzonExtConfig } from '../shared/types';

export interface NavbarTranslations {
  brandName: string;
  productQuery: string;
  keywordReverse: string;
  keywordMining: string;
  selectionMode: string;
  comingSoon: string;
  fullscreen: string;
  close: string;
  minimize: string;
}

const DEFAULT_TRANSLATIONS: NavbarTranslations = {
  brandName: '选品助手',
  productQuery: '产品查询',
  keywordReverse: '关键词反查',
  keywordMining: '关键词挖掘',
  selectionMode: '选品模式',
  comingSoon: '即将上线',
  fullscreen: '全屏',
  close: '关闭',
  minimize: '最小化',
};

export class NavbarManager {
  private container: HTMLElement | null = null;
  private activeTab: string = 'product-query';
  private config: OzonExtConfig | null = null;
  private translations: NavbarTranslations = DEFAULT_TRANSLATIONS;
  private messageBus: MessageBus;
  private onToggleSelectionMode: (enabled: boolean) => void = () => {};
  private onToggleFullscreen: () => void = () => {};
  private onClose: () => void = () => {};

  constructor(messageBus: MessageBus) {
    this.messageBus = messageBus;
  }

  /**
   * 设置配置
   */
  setConfig(config: OzonExtConfig | null): void {
    this.config = config;
    if (config?.language === 'ru') {
      this.translations = {
        brandName: 'Помощник подбора',
        productQuery: 'Поиск товара',
        keywordReverse: 'Обратный поиск',
        keywordMining: 'Поиск ключевых слов',
        selectionMode: 'Режим подбора',
        comingSoon: 'Скоро',
        fullscreen: 'Полный экран',
        close: 'Закрыть',
        minimize: 'Свернуть',
      };
    } else {
      this.translations = DEFAULT_TRANSLATIONS;
    }
  }

  /**
   * 设置回调
   */
  setCallbacks(callbacks: {
    onToggleSelectionMode?: (enabled: boolean) => void;
    onToggleFullscreen?: () => void;
    onClose?: () => void;
  }): void {
    if (callbacks.onToggleSelectionMode) this.onToggleSelectionMode = callbacks.onToggleSelectionMode;
    if (callbacks.onToggleFullscreen) this.onToggleFullscreen = callbacks.onToggleFullscreen;
    if (callbacks.onClose) this.onClose = callbacks.onClose;
  }

  /**
   * 初始化导航栏
   */
  init(): void {
    // 移除已存在的导航栏
    this.destroy();

    // 创建导航栏容器
    this.container = document.createElement('div');
    this.container.id = 'ozon-ext-navbar';
    this.container.className = 'ozon-ext-navbar';

    // 注入样式
    this.injectStyles();

    // 构建HTML
    this.container.innerHTML = this.buildHTML();

    // 添加到页面
    document.body.appendChild(this.container);

    // 绑定事件
    this.bindEvents();

    // 通知页面内容偏移
    this.updatePageOffset(true);
  }

  /**
   * 销毁导航栏
   */
  destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.updatePageOffset(false);
    }
  }

  /**
   * 切换Tab
   */
  setActiveTab(tab: string): void {
    this.activeTab = tab;
    const tabs = this.container?.querySelectorAll('.ozon-ext-nav-tab');
    tabs?.forEach((el) => {
      const tabName = (el as HTMLElement).dataset.tab;
      el.classList.toggle('active', tabName === tab);
    });
  }

  /**
   * 更新语言
   */
  setLanguage(lang: 'zh' | 'ru'): void {
    if (lang === 'ru') {
      this.translations = {
        brandName: 'Помощник подбора',
        productQuery: 'Поиск товара',
        keywordReverse: 'Обратный поиск',
        keywordMining: 'Поиск ключевых слов',
        selectionMode: 'Режим подбора',
        comingSoon: 'Скоро',
        fullscreen: 'Полный экран',
        close: 'Закрыть',
        minimize: 'Свернуть',
      };
    } else {
      this.translations = DEFAULT_TRANSLATIONS;
    }
    this.updateText();
  }

  /**
   * 显示/隐藏导航栏
   */
  show(): void {
    this.container?.classList.remove('ozon-ext-hidden');
  }

  hide(): void {
    this.container?.classList.add('ozon-ext-hidden');
  }

  /**
   * 构建HTML
   */
  private buildHTML(): string {
    const t = this.translations;
    return `
      <div class="ozon-ext-navbar-inner">
        <!-- Logo区域 -->
        <div class="ozon-ext-nav-logo">
          <svg class="ozon-ext-nav-logo-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <span class="ozon-ext-nav-logo-text">${t.brandName}</span>
        </div>

        <!-- Tab区域 -->
        <div class="ozon-ext-nav-tabs">
          <button class="ozon-ext-nav-tab active" data-tab="product-query">
            ${t.productQuery}
          </button>
          <button class="ozon-ext-nav-tab" data-tab="keyword-reverse">
            ${t.keywordReverse}
          </button>
          <button class="ozon-ext-nav-tab" data-tab="keyword-mining">
            ${t.keywordMining}
          </button>
          <button class="ozon-ext-nav-tab" data-tab="selection-mode">
            ${t.selectionMode}
          </button>
        </div>

        <!-- 控制按钮 -->
        <div class="ozon-ext-nav-actions">
          <button class="ozon-ext-nav-btn ozon-ext-nav-btn-icon" data-action="minimize" title="${t.minimize}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button class="ozon-ext-nav-btn ozon-ext-nav-btn-icon" data-action="fullscreen" title="${t.fullscreen}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
          <button class="ozon-ext-nav-btn ozon-ext-nav-btn-icon" data-action="close" title="${t.close}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    if (!this.container) return;

    // Tab点击
    this.container.querySelectorAll('.ozon-ext-nav-tab').forEach((el) => {
      el.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab;
        if (!tab) return;

        this.setActiveTab(tab);

        // 通知选品模式切换
        if (tab === 'selection-mode') {
          this.onToggleSelectionMode(true);
        } else {
          this.onToggleSelectionMode(false);
        }

        // 发送Tab切换事件
        this.messageBus.send('tab-changed', { tab });
      });
    });

    // 控制按钮
    this.container.querySelectorAll('.ozon-ext-nav-btn').forEach((el) => {
      el.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        switch (action) {
          case 'minimize':
            this.hide();
            break;
          case 'fullscreen':
            this.onToggleFullscreen();
            break;
          case 'close':
            this.onClose();
            break;
        }
      });
    });
  }

  /**
   * 显示"即将上线"提示
   */
  private showComingSoonTooltip(el: HTMLElement): void {
    // 移除已存在的tooltip
    const existing = document.querySelector('.ozon-ext-tooltip-coming-soon');
    if (existing) existing.remove();

    const tooltip = document.createElement('div');
    tooltip.className = 'ozon-ext-tooltip-coming-soon';
    tooltip.textContent = this.translations.comingSoon;
    el.appendChild(tooltip);

    setTimeout(() => tooltip.remove(), 2000);
  }

  /**
   * 更新文本
   */
  private updateText(): void {
    if (!this.container) return;
    const t = this.translations;

    // 更新Logo
    const logoText = this.container.querySelector('.ozon-ext-nav-logo-text');
    if (logoText) logoText.textContent = t.brandName;

    // 更新Tabs
    const tabs = this.container.querySelectorAll('.ozon-ext-nav-tab');
    const tabNames = ['product-query', 'keyword-reverse', 'keyword-mining', 'selection-mode'];
    const tabTexts = [t.productQuery, t.keywordReverse, t.keywordMining, t.selectionMode];
    tabs.forEach((el, i) => {
      if (i < tabTexts.length) {
        el.textContent = tabTexts[i];
      }
    });

    // 更新按钮title
    const minimizeBtn = this.container.querySelector('[data-action="minimize"]');
    const fullscreenBtn = this.container.querySelector('[data-action="fullscreen"]');
    const closeBtn = this.container.querySelector('[data-action="close"]');
    if (minimizeBtn) minimizeBtn.setAttribute('title', t.minimize);
    if (fullscreenBtn) fullscreenBtn.setAttribute('title', t.fullscreen);
    if (closeBtn) closeBtn.setAttribute('title', t.close);
  }

  /**
   * 更新页面偏移
   */
  private updatePageOffset(add: boolean): void {
    if (add) {
      document.body.style.marginTop = '48px';
    } else {
      document.body.style.marginTop = '';
    }
  }

  /**
   * 注入样式
   */
  private injectStyles(): void {
    if (document.getElementById('ozon-ext-navbar-styles')) return;

    const style = document.createElement('style');
    style.id = 'ozon-ext-navbar-styles';
    style.textContent = `
      .ozon-ext-navbar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 48px !important;
        background: #1677FF !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
      }

      .ozon-ext-navbar.ozon-ext-hidden {
        display: none !important;
      }

      .ozon-ext-navbar-inner {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        height: 100% !important;
        padding: 0 16px !important;
        max-width: 100% !important;
      }

      .ozon-ext-nav-logo {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        color: white !important;
        font-weight: 600 !important;
        font-size: 16px !important;
        flex-shrink: 0 !important;
      }

      .ozon-ext-nav-logo-icon {
        width: 24px !important;
        height: 24px !important;
      }

      .ozon-ext-nav-tabs {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        flex: 1 !important;
        justify-content: center !important;
      }

      .ozon-ext-nav-tab {
        padding: 8px 16px !important;
        background: transparent !important;
        border: none !important;
        color: rgba(255, 255, 255, 0.7) !important;
        font-size: 14px !important;
        cursor: pointer !important;
        border-radius: 4px !important;
        transition: all 0.2s !important;
        position: relative !important;
        white-space: nowrap !important;
      }

      .ozon-ext-nav-tab:hover {
        color: white !important;
        background: rgba(255, 255, 255, 0.1) !important;
      }

      .ozon-ext-nav-tab.active {
        color: white !important;
        background: rgba(255, 255, 255, 0.15) !important;
      }

      .ozon-ext-nav-tab.active::after {
        content: '' !important;
        position: absolute !important;
        bottom: -1px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        width: 24px !important;
        height: 2px !important;
        background: white !important;
        border-radius: 1px !important;
      }

      .ozon-ext-nav-tab-disabled {
        color: rgba(255, 255, 255, 0.4) !important;
        cursor: not-allowed !important;
      }

      .ozon-ext-nav-tab-disabled:hover {
        color: rgba(255, 255, 255, 0.5) !important;
        background: transparent !important;
      }

      .ozon-ext-nav-actions {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        flex-shrink: 0 !important;
      }

      .ozon-ext-nav-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 32px !important;
        height: 32px !important;
        padding: 0 !important;
        background: transparent !important;
        border: none !important;
        color: rgba(255, 255, 255, 0.7) !important;
        cursor: pointer !important;
        border-radius: 4px !important;
        transition: all 0.2s !important;
      }

      .ozon-ext-nav-btn:hover {
        color: white !important;
        background: rgba(255, 255, 255, 0.1) !important;
      }

      .ozon-ext-nav-btn svg {
        width: 18px !important;
        height: 18px !important;
      }

      .ozon-ext-tooltip-coming-soon {
        position: absolute !important;
        top: 100% !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        margin-top: 8px !important;
        padding: 6px 12px !important;
        background: rgba(0, 0, 0, 0.85) !important;
        color: white !important;
        font-size: 12px !important;
        border-radius: 4px !important;
        white-space: nowrap !important;
        z-index: 2147483647 !important;
        animation: ozon-ext-fade-in 0.2s ease !important;
      }

      @keyframes ozon-ext-fade-in {
        from { opacity: 0; transform: translateX(-50%) translateY(-4px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      /* 响应式 */
      @media (max-width: 768px) {
        .ozon-ext-nav-tab {
          padding: 8px 12px !important;
          font-size: 13px !important;
        }

        .ozon-ext-nav-logo-text {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}
