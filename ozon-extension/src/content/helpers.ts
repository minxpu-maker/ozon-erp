/**
 * Ozon/WB 辅助元素组件
 * 包含：回到顶部、语言切换、反馈按钮等
 */

import { MessageBus } from '../shared/message-bus';
import { OzonExtConfig } from '../shared/types';

export interface HelperTranslations {
  backToTop: string;
  feedback: string;
  language: string;
}

const ZH_TRANSLATIONS: HelperTranslations = {
  backToTop: '回到顶部',
  feedback: '反馈',
  language: '语言',
};

const RU_TRANSLATIONS: HelperTranslations = {
  backToTop: 'Вверх',
  feedback: 'Обратная связь',
  language: 'Язык',
};

export class HelperManager {
  private container: HTMLElement | null = null;
  private language: 'zh' | 'ru' = 'zh';
  private translations: HelperTranslations = ZH_TRANSLATIONS;
  private messageBus: MessageBus;
  private config: OzonExtConfig | null = null;
  private onLanguageChange: (lang: 'zh' | 'ru') => void = () => {};
  private showBackToTop: boolean = true;

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
   * 设置语言切换回调
   */
  setOnLanguageChange(callback: (lang: 'zh' | 'ru') => void): void {
    this.onLanguageChange = callback;
  }

  /**
   * 显示/隐藏回到顶部
   */
  setShowBackToTop(show: boolean): void {
    this.showBackToTop = show;
    const btn = this.container?.querySelector('.ozon-ext-back-to-top');
    if (btn) {
      btn.classList.toggle('ozon-ext-hidden', !show);
    }
  }

  /**
   * 初始化
   */
  init(): void {
    this.destroy();

    // 创建容器
    this.container = document.createElement('div');
    this.container.id = 'ozon-ext-helpers';
    this.container.className = 'ozon-ext-helpers';

    // 注入样式
    this.injectStyles();

    // 构建HTML
    this.container.innerHTML = this.buildHTML();

    // 添加到页面
    document.body.appendChild(this.container);

    // 绑定事件
    this.bindEvents();

    // 监听滚动
    this.setupScrollListener();
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.removeScrollListener();
  }

  /**
   * 更新语言
   */
  setLanguage(lang: 'zh' | 'ru'): void {
    this.language = lang;
    this.translations = lang === 'ru' ? RU_TRANSLATIONS : ZH_TRANSLATIONS;
    if (this.container) {
      this.container.innerHTML = this.buildHTML();
      this.bindEvents();
    }
  }

  /**
   * 构建HTML
   */
  private buildHTML(): string {
    const t = this.translations;
    const langIcon = this.language === 'zh' ? '🇨🇳' : '🇷🇺';
    const nextLang = this.language === 'zh' ? '🇷🇺' : '🇨🇳';

    return `
      <!-- 左侧 -->
      <div class="ozon-ext-helpers-left">
        <button class="ozon-ext-helper-btn ozon-ext-back-to-top ${this.showBackToTop ? '' : 'ozon-ext-hidden'}" data-action="back-to-top" title="${t.backToTop}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
        <button class="ozon-ext-helper-btn" data-action="feedback" title="${t.feedback}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>

      <!-- 右侧 -->
      <div class="ozon-ext-helpers-right">
        <button class="ozon-ext-helper-btn ozon-ext-lang-btn" data-action="toggle-language" title="${t.language}">
          <span class="ozon-ext-lang-current">${langIcon}</span>
          <span class="ozon-ext-lang-next">${nextLang}</span>
        </button>
      </div>
    `;
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    if (!this.container) return;

    this.container.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        this.handleAction(action!);
      });
    });
  }

  /**
   * 处理动作
   */
  private handleAction(action: string): void {
    switch (action) {
      case 'back-to-top':
        this.scrollToTop();
        break;
      case 'feedback':
        this.openFeedback();
        break;
      case 'toggle-language':
        this.toggleLanguage();
        break;
    }
  }

  /**
   * 滚动到顶部
   */
  private scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  /**
   * 打开反馈
   */
  private openFeedback(): void {
    // 发送消息打开反馈
    this.messageBus.send('OPEN_FEEDBACK', {});
  }

  /**
   * 切换语言
   */
  private toggleLanguage(): void {
    const newLang = this.language === 'zh' ? 'ru' : 'zh';
    this.setLanguage(newLang);
    this.onLanguageChange(newLang);

    // 保存到配置
    if (this.config) {
      this.messageBus.send('SAVE_CONFIG', { ...this.config, language: newLang });
    }
  }

  /**
   * 设置滚动监听
   */
  private setupScrollListener(): void {
    window.addEventListener('scroll', this.handleScroll);
    this.handleScroll(); // 初始化
  }

  /**
   * 移除滚动监听
   */
  private removeScrollListener(): void {
    window.removeEventListener('scroll', this.handleScroll);
  }

  /**
   * 处理滚动
   */
  private handleScroll = (): void => {
    if (!this.container) return;

    const btn = this.container.querySelector('.ozon-ext-back-to-top');
    if (!btn) return;

    // 显示/隐藏回到顶部
    if (window.scrollY > 300) {
      btn.classList.remove('ozon-ext-hidden');
      btn.classList.add('ozon-ext-visible');
    } else {
      btn.classList.remove('ozon-ext-visible');
      if (!this.showBackToTop) {
        btn.classList.add('ozon-ext-hidden');
      }
    }
  };

  /**
   * 注入样式
   */
  private injectStyles(): void {
    if (document.getElementById('ozon-ext-helpers-styles')) return;

    const style = document.createElement('style');
    style.id = 'ozon-ext-helpers-styles';
    style.textContent = `
      .ozon-ext-helpers {
        position: fixed !important;
        bottom: 24px !important;
        left: 0 !important;
        right: 0 !important;
        pointer-events: none !important;
        z-index: 2147483640 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      .ozon-ext-helpers-left {
        position: fixed !important;
        left: 24px !important;
        bottom: 24px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        pointer-events: auto !important;
      }

      .ozon-ext-helpers-right {
        position: fixed !important;
        right: 24px !important;
        bottom: 24px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        pointer-events: auto !important;
      }

      .ozon-ext-helper-btn {
        width: 44px !important;
        height: 44px !important;
        border-radius: 50% !important;
        background: white !important;
        border: none !important;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15) !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.2s !important;
        color: #637089 !important;
      }

      .ozon-ext-helper-btn svg {
        width: 20px !important;
        height: 20px !important;
      }

      .ozon-ext-helper-btn:hover {
        background: #F6F8FB !important;
        transform: scale(1.05) !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2) !important;
      }

      .ozon-ext-back-to-top.ozon-ext-hidden {
        opacity: 0 !important;
        transform: scale(0.8) !important;
        pointer-events: none !important;
      }

      .ozon-ext-back-to-top.ozon-ext-visible {
        opacity: 1 !important;
        transform: scale(1) !important;
      }

      /* 语言切换按钮 */
      .ozon-ext-lang-btn {
        padding: 0 !important;
        overflow: hidden !important;
      }

      .ozon-ext-lang-current {
        font-size: 20px !important;
        line-height: 1 !important;
        transition: transform 0.3s !important;
      }

      .ozon-ext-lang-next {
        position: absolute !important;
        font-size: 20px !important;
        line-height: 1 !important;
        transform: translateX(100%) !important;
        transition: transform 0.3s !important;
      }

      .ozon-ext-lang-btn:hover .ozon-ext-lang-current {
        transform: translateX(-100%) !important;
      }

      .ozon-ext-lang-btn:hover .ozon-ext-lang-next {
        transform: translateX(0) !important;
      }

      /* 响应式 */
      @media (max-width: 768px) {
        .ozon-ext-helpers-left,
        .ozon-ext-helpers-right {
          left: 16px !important;
          right: 16px !important;
          bottom: 16px !important;
          flex-direction: row !important;
        }

        .ozon-ext-helper-btn {
          width: 40px !important;
          height: 40px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}
