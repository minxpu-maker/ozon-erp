/**
 * Ozon/WB 插件数据面板组件
 * 商品详情页显示数据面板，包含利润计算器
 */

import { MessageBus } from '../shared/message-bus';
import { OzonExtConfig, MarketSignalPayload, ProductInfo } from '../shared/types';
import { showCollectPreview, addDetailCollectedBadge } from './preview';

export interface PanelTranslations {
  // 标题区
  productTitle: string;
  reviews: string;
  listedDate: string;
  // SKU行
  sku: string;
  profitCalculator: string;
  viewDetails: string;
  collectToERP: string;
  // 监控
  addMonitor: string;
  monitoring: string;
  priceChanged: string;
  salesChanged: string;
  // 核心数据
  price: string;
  originalPrice: string;
  estimatedSales: string;
  estimatedRevenue: string;
  rating: string;
  reviewsCount: string;
  estimatedProfitRate: string;
  returnRate: string;
  // 商家信息
  sellerName: string;
  sellerType: string;
  followers: string;
  deliveryType: string;
  // 商品规格
  weight: string;
  volume: string;
  variants: string;
  listed: string;
  // API占位
  impressions: string;
  cardViews: string;
  cartRate: string;
  adShare: string;
  qaCount: string;
  // 监控相关
  // 底部按钮
  salesTrend: string;
  reviewAnalysis: string;
  // 状态
  collected: string;
  collecting: string;
  apiRequired: string;
  // 利润计算器
  profitCalculatorTitle: string;
  purchaseCost: string;
  shippingCost: string;
  exchangeRate: string;
  calculate: string;
  profitAmount: string;
  roi: string;
  grossProfit: string;
  costPrice: string;
  profitRate: string;
  close: string;
  // 利润计算器增强
  category: string;
  commissionRate: string;
  logisticsCost: string;
  suggestedPrice: string;
  targetProfitRate: string;
  recentHistory: string;
  noHistory: string;
  confirm: string;
  profitRateHigh: string;
  profitRateMedium: string;
  profitRateLow: string;
  profitRateWarning: string;
  applyProfitRate: string;
  // 其他
  comingSoon: string;
  local: string;
  crossBorder: string;
  fbo: string;
  fbs: string;
  kg: string;
  liter: string;
  pieces: string;
  // 关键词
  relatedKeywords: string;
  clickToSearch: string;
}

const ZH_TRANSLATIONS: PanelTranslations = {
  productTitle: '商品标题',
  reviews: '评价',
  listedDate: '上架日期',
  sku: 'SKU',
  profitCalculator: '利润计算',
  viewDetails: '查看详情',
  collectToERP: '采集到ERP',
  price: '售价',
  originalPrice: '原价',
  estimatedSales: '销量(估)',
  estimatedRevenue: '销售额(估)',
  rating: '评分',
  reviewsCount: '评价数',
  estimatedProfitRate: '利润率(估)',
  returnRate: '退货率',
  sellerName: '卖家',
  sellerType: '类型',
  followers: '粉丝',
  deliveryType: '配送',
  weight: '重量',
  volume: '体积',
  variants: '变体',
  listed: '上架',
  impressions: '曝光量',
  cardViews: '卡片浏览',
  cartRate: '加购率',
  adShare: '广告占比',
  qaCount: '问答',
  salesTrend: '销售趋势',
  reviewAnalysis: '评论分析',
  collected: '已采集',
  // Monitor
  addMonitor: '加入监控',
  monitoring: '监控中',
  priceChanged: '价格变化',
  salesChanged: '销量变化',
  collecting: '采集中...',
  apiRequired: '需对接API',
  profitCalculatorTitle: '利润计算器',
  purchaseCost: '采购成本(¥)',
  shippingCost: '国际运费(¥)',
  exchangeRate: '汇率',
  calculate: '计算',
  profitAmount: '利润金额',
  roi: 'ROI',
  grossProfit: '毛利率',
  costPrice: '成本价',
  close: '关闭',
  category: '类目',
  commissionRate: '佣金率',
  suggestedPrice: '建议售价',
  applyProfitRate: '应用利润率',
  profitRate: '利润率',
  profitRateLow: '利润率过低',
  profitRateMedium: '利润率一般',
  profitRateHigh: '利润率良好',
  profitRateWarning: '请输入成本计算利润率',
  logisticsCost: '物流费(¥)',
  targetProfitRate: '目标利润率',
  recentHistory: '最近计算记录',
  noHistory: '暂无历史记录',
  confirm: '确认',
  comingSoon: '即将上线',
  local: '本土',
  crossBorder: '跨境',
  fbo: 'FBO',
  fbs: 'FBS',
  kg: 'kg',
  liter: 'L',
  pieces: '件',
  relatedKeywords: '关键词',
  clickToSearch: '点击搜索',
};

const RU_TRANSLATIONS: PanelTranslations = {
  productTitle: 'Название товара',
  reviews: 'Отзывы',
  listedDate: 'Дата размещения',
  sku: 'SKU',
  profitCalculator: 'Калькулятор',
  viewDetails: 'Подробнее',
  collectToERP: 'Собрать в ERP',
  price: 'Цена',
  originalPrice: 'Цена без скидки',
  estimatedSales: 'Продажи( estim.)',
  estimatedRevenue: 'Выручка( estim.)',
  rating: 'Рейтинг',
  reviewsCount: 'Отзывы',
  estimatedProfitRate: 'Маржа( estim.)',
  returnRate: 'Возврат',
  sellerName: 'Продавец',
  sellerType: 'Тип',
  followers: 'Подписчики',
  deliveryType: 'Доставка',
  weight: 'Вес',
  volume: 'Объем',
  variants: 'Варианты',
  listed: 'Размещен',
  impressions: 'Показы',
  cardViews: 'Просмотры карточек',
  cartRate: 'Добавление в корзину',
  adShare: 'Доля рекламы',
  qaCount: 'Вопросы',
  salesTrend: 'Тренд продаж',
  reviewAnalysis: 'Анализ отзывов',
  collected: 'Собрано',
  // Monitor
  addMonitor: 'Добавить в мониторинг',
  monitoring: 'На мониторинге',
  priceChanged: 'Изменение цены',
  salesChanged: 'Изменение продаж',
  collecting: 'Сбор...',
  apiRequired: 'Требуется API',
  profitCalculatorTitle: 'Калькулятор прибыли',
  purchaseCost: 'Закупочная цена(¥)',
  shippingCost: 'Международная доставка(¥)',
  exchangeRate: 'Курс валют',
  calculate: 'Рассчитать',
  profitAmount: 'Прибыль',
  roi: 'ROI',
  grossProfit: 'Маржа',
  costPrice: 'Себестоимость',
  category: 'Категория',
  commissionRate: 'Комиссия',
  suggestedPrice: 'Рек. цена',
  applyProfitRate: 'Применить',
  profitRate: 'Маржа (%)',
  profitRateLow: 'Низкая',
  profitRateMedium: 'Средняя',
  profitRateHigh: 'Хорошая',
  profitRateWarning: 'Введите стоимость',
  logisticsCost: 'Логистика(¥)',
  targetProfitRate: 'Целевая маржа',
  recentHistory: 'История',
  noHistory: 'Нет записей',
  confirm: 'Подтвердить',
  close: 'Закрыть',
  comingSoon: 'Скоро',
  local: 'Местный',
  crossBorder: 'Зарубежный',
  fbo: 'FBO',
  fbs: 'FBS',
  kg: 'кг',
  liter: 'л',
  pieces: 'шт',
  relatedKeywords: 'Ключевые слова',
  clickToSearch: 'Клик для поиска',
};

export class PanelManager {
  private container: HTMLElement | null = null;
  private productInfo: ProductInfo | null = null;
  private collected: boolean = false;
  private isFullscreen: boolean = false;
  private language: 'zh' | 'ru' = 'zh';
  private translations: PanelTranslations = ZH_TRANSLATIONS;
  private messageBus: MessageBus;
  private config: OzonExtConfig | null = null;
  private profitCalculatorEl: HTMLElement | null = null;
  private batchCollectionCount: number = 0;
  private isMonitored: boolean = false;
  private hasPriceChange: boolean = false;
  private hasSalesChange: boolean = false;
  private priceChangePercent: number = 0;
  private salesChangeValue: number = 0;
  private previousPrice: number = 0;
  private previousSales: number = 0;
  private alertBannerEl: HTMLElement | null = null;
	  private hasChanges: boolean = false;
	  private changeAlert: string = '';

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
   * 初始化面板
   */
  async init(productInfo: ProductInfo, isCollected: boolean = false): Promise<void> {
    this.productInfo = productInfo;
    this.collected = isCollected;

    // 移除已存在的面板
    this.destroy();

    // 检查监控状态
    await this.checkMonitorStatus();

    // 创建面板容器
    this.container = document.createElement('div');
    this.container.id = 'ozon-ext-panel';
    this.container.className = 'ozon-ext-panel';

    // 注入样式
    this.injectStyles();

    // 构建HTML
    this.container.innerHTML = this.buildHTML();

    // 插入到页面（商品信息下方）
    this.insertIntoPage();

    // 绑定事件
    this.bindEvents();

    // 更新监控按钮状态
    this.updateMonitorButton();
  }

  /**
   * 获取API基础地址
   */
  private getApiBase(): string {
    // 从config读取ERP后端地址，默认为localhost:5000
    return this.config?.apiUrl?.replace(/\/$/, '') || 'http://localhost:5000';
  }

  /**
   * 检查监控状态
   */
  private async checkMonitorStatus(): Promise<void> {
    if (!this.productInfo?.productId) return;
    
    try {
      const apiBase = this.getApiBase();
      const res = await fetch(`${apiBase}/api/monitor?platform=ozon&limit=50`);
      const data = await res.json();
      
      // 从列表中找到当前商品
      const monitorItem = data.data?.find((m: any) => m.productId === this.productInfo?.productId);
      this.isMonitored = !!monitorItem;
      
      if (this.isMonitored && monitorItem) {
        const currentPrice = parseFloat(String(this.productInfo.price || 0));
        const currentSales = parseInt(String((this.productInfo as any).sales || (this.productInfo as any).salesVolume || 0));
        
        this.previousPrice = monitorItem.currentPrice || currentPrice;
        this.previousSales = monitorItem.currentSales || currentSales;
        
        // 检测价格变化
        if (this.previousPrice > 0 && currentPrice !== this.previousPrice) {
          this.hasPriceChange = true;
          this.priceChangePercent = ((currentPrice - this.previousPrice) / this.previousPrice) * 100;
        }
        
        // 检测销量变化
        if (this.previousSales > 0 && currentSales !== this.previousSales) {
          this.hasSalesChange = true;
          this.salesChangeValue = currentSales - this.previousSales;
        }
        
        // 更新变化提示
        this.hasChanges = this.hasPriceChange || this.hasSalesChange;
        if (this.hasPriceChange) {
          const direction = this.priceChangePercent > 0 ? '↑' : '↓';
          this.changeAlert = `价格${direction}${Math.abs(this.priceChangePercent).toFixed(1)}%`;
        } else if (this.hasSalesChange) {
          const direction = this.salesChangeValue > 0 ? '↑' : '↓';
          this.changeAlert = `销量${direction}${Math.abs(this.salesChangeValue)}`;
        }
      }
    } catch (e) {
      console.error('[OzonExt] 检查监控状态失败:', e);
    }
  }

  /**
   * 销毁面板
   */
  destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.closeProfitCalculator();
  }

  /**
   * 更新商品信息
   */
  updateProduct(productInfo: ProductInfo): void {
    this.productInfo = productInfo;
    if (this.container) {
      this.container.innerHTML = this.buildHTML();
      this.bindEvents();
    }
  }

  /**
   * 设置采集状态
   */
  setCollected(collected: boolean): void {
    this.collected = collected;
    if (this.container) {
      const btn = this.container.querySelector('.ozon-ext-panel-collect-btn');
      if (btn) {
        btn.textContent = this.translations.collected;
        btn.classList.add('ozon-ext-btn-success');
        (btn as HTMLButtonElement).disabled = true;
      }
      // 添加已采集标签
      if (collected) {
        const titleSection = this.container.querySelector('.ozon-ext-panel-title-section');
        if (titleSection) {
          addDetailCollectedBadge(titleSection);
        }
      }
    }
  }

  /**
   * 设置批量采集计数
   */
  setBatchCount(count: number): void {
    this.batchCollectionCount = count;
    const countEl = this.container?.querySelector('.ozon-ext-panel-batch-count');
    if (countEl) {
      countEl.textContent = String(count);
      countEl.parentElement?.classList.toggle('ozon-ext-hidden', count === 0);
    }
  }

  /**
   * 显示/隐藏面板
   */
  show(): void {
    this.container?.classList.remove('ozon-ext-panel-hidden');
  }

  hide(): void {
    this.container?.classList.add('ozon-ext-panel-hidden');
  }

  /**
   * 全屏模式
   */
  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    this.container?.classList.toggle('ozon-ext-panel-fullscreen', this.isFullscreen);
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
    const p = this.productInfo;

    if (!p) return '';

    // 格式化数据
    const price = p.price ? this.formatNumber(p.price) : '--';
    const originalPrice = p.originalPrice ? this.formatNumber(p.originalPrice) : '--';
    const salesVolume = p.salesVolume ? this.formatNumber(p.salesVolume) : '--';
    const revenue = p.revenue ? this.formatNumber(p.revenue) : '--';
    const rating = p.rating ? p.rating.toFixed(1) : '--';
    const reviewsCount = p.reviewsCount ? this.formatNumber(p.reviewsCount) : '--';
    const profitRate = p.profitRate ? `${p.profitRate.toFixed(1)}%` : '--';
    // 利润率颜色预警
    const profitRateColorClass = p.profitRate
      ? (p.profitRate > 20 ? 'ozon-ext-panel-field-positive' : p.profitRate >= 10 ? 'ozon-ext-panel-field-warning' : 'ozon-ext-panel-field-negative')
      : '';

    // 商家信息
    const sellerName = p.sellerName || '--';
    const sellerType = p.sellerType ? (p.sellerType === 'local' ? t.local : t.crossBorder) : '--';
    const followers = p.followerCount ? this.formatNumber(p.followerCount) : '--';
    const deliveryType = p.deliveryType || '--';

    // 商品规格
    const weight = p.weight ? `${p.weight}g` : '--';
    const volume = p.volume ? `${p.volume.toFixed(2)}${t.liter}` : '--';
    const variants = p.variantCount ? `${p.variantCount}${t.pieces}` : '--';
    const listed = p.listedDate || '--';

    // 提取关键词（从标题和类目）
    const extractKeywords = (text: string): string[] => {
      if (!text) return [];
      // 俄语分词：按空格和特殊字符分割
      const words = text.split(/[\s,.!?()\/\\]+/).filter(w => w.length > 3);
      // 去重并限制5个
      return [...new Set(words)].slice(0, 5);
    };
    const keywords = extractKeywords(p.title || '') || [];
    const relatedKeywordsHtml = keywords.map(kw => 
      `<span class="ozon-ext-panel-keyword-tag" data-keyword="${this.escapeHtml(kw)}">${this.escapeHtml(kw)}</span>`
    ).join('');

    // API占位字段
    const apiPlaceholder = (field: string) => `
      <div class="ozon-ext-panel-field">
        <span class="ozon-ext-panel-field-label">${field}</span>
        <span class="ozon-ext-panel-field-value ozon-ext-panel-field-placeholder">--</span>
        <span class="ozon-ext-panel-field-api-note">${t.apiRequired}</span>
      </div>
    `;

    return `
      <div class="ozon-ext-panel-inner">
        <!-- 标题区 -->
        <div class="ozon-ext-panel-section ozon-ext-panel-title-section">
          <h3 class="ozon-ext-panel-product-title">${this.escapeHtml(p.title || '')}</h3>
          <div class="ozon-ext-panel-meta">
            <span class="ozon-ext-panel-rating">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              ${rating}
            </span>
            <span class="ozon-ext-panel-divider">|</span>
            <span class="ozon-ext-panel-reviews">${reviewsCount} ${t.reviews}</span>
            <span class="ozon-ext-panel-divider">|</span>
            <span class="ozon-ext-panel-listed">${t.listed}: ${listed}</span>
          </div>
        </div>

        <!-- SKU行 -->
        <div class="ozon-ext-panel-section ozon-ext-panel-sku-section">
          <span class="ozon-ext-panel-sku-label">${t.sku}:</span>
          <span class="ozon-ext-panel-sku-value">${p.productId || '--'}</span>
          <div class="ozon-ext-panel-sku-actions">
            <button class="ozon-ext-panel-btn ozon-ext-panel-btn-icon ozon-ext-panel-profit-btn" data-action="profit-calculator">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
              ${t.profitCalculator}
            </button>
            <button class="ozon-ext-panel-btn ozon-ext-panel-btn-icon" data-action="view-details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              ${t.viewDetails}
            </button>
            <button class="ozon-ext-panel-btn ozon-ext-panel-btn-primary ozon-ext-panel-collect-btn" data-action="collect">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              ${t.collectToERP}
            </button>
          </div>
        </div>

        <!-- 核心数据 2x4网格 -->
        <div class="ozon-ext-panel-section ozon-ext-panel-data-grid">
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.price}</span>
            <span class="ozon-ext-panel-field-value ozon-ext-panel-field-highlight">${price}</span>
          </div>
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.originalPrice}</span>
            <span class="ozon-ext-panel-field-value">${originalPrice}</span>
          </div>
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.estimatedSales}</span>
            <span class="ozon-ext-panel-field-value">${salesVolume}</span>
          </div>
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.estimatedRevenue}</span>
            <span class="ozon-ext-panel-field-value">${revenue}</span>
          </div>
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.reviewsCount}</span>
            <span class="ozon-ext-panel-field-value">${reviewsCount}</span>
          </div>
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.rating}</span>
            <span class="ozon-ext-panel-field-value">${rating}</span>
          </div>
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.estimatedProfitRate}</span>
            <span class="ozon-ext-panel-field-value ozon-ext-panel-field-profit ${profitRateColorClass}">${profitRate}</span>
          </div>
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.returnRate}</span>
            <span class="ozon-ext-panel-field-value ozon-ext-panel-field-placeholder">--</span>
          </div>
        </div>

        <!-- 商家信息 -->
        <div class="ozon-ext-panel-section ozon-ext-panel-info-row">
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.sellerName}</span>
            <span class="ozon-ext-panel-field-value">${sellerName}</span>
          </div>
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.sellerType}</span>
            <span class="ozon-ext-panel-field-value">${sellerType}</span>
          </div>
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.followers}</span>
            <span class="ozon-ext-panel-field-value">${followers}</span>
          </div>
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.deliveryType}</span>
            <span class="ozon-ext-panel-field-value">${deliveryType}</span>
          </div>
        </div>

        <!-- 商品规格 -->
        <div class="ozon-ext-panel-section ozon-ext-panel-info-row">
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.weight}</span>
            <span class="ozon-ext-panel-field-value">${weight}</span>
          </div>
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.volume}</span>
            <span class="ozon-ext-panel-field-value">${volume}</span>
          </div>
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.variants}</span>
            <span class="ozon-ext-panel-field-value">${variants}</span>
          </div>
          <div class="ozon-ext-panel-field">
            <span class="ozon-ext-panel-field-label">${t.listed}</span>
            <span class="ozon-ext-panel-field-value">${listed}</span>
          </div>
        </div>

        <!-- 关键词行 -->
        ${keywords.length > 0 ? `
        <div class="ozon-ext-panel-section ozon-ext-panel-keywords-row">
          <span class="ozon-ext-panel-field-label">${t.relatedKeywords}</span>
          <div class="ozon-ext-panel-keyword-tags">
            ${relatedKeywordsHtml}
          </div>
          <span class="ozon-ext-panel-field-hint">${t.clickToSearch}</span>
        </div>
        ` : ''}

        <!-- API占位行 -->
        <div class="ozon-ext-panel-section ozon-ext-panel-api-row">
          ${apiPlaceholder(t.impressions)}
          ${apiPlaceholder(t.cardViews)}
          ${apiPlaceholder(t.cartRate)}
          ${apiPlaceholder(t.adShare)}
          ${apiPlaceholder(t.qaCount)}
        </div>

        <!-- 底部按钮 -->
        <div class="ozon-ext-panel-section ozon-ext-panel-bottom-actions">
          <button class="ozon-ext-panel-btn ozon-ext-panel-btn-disabled" data-action="sales-trend" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            ${t.salesTrend}
          </button>
          <button class="ozon-ext-panel-btn ozon-ext-panel-btn-disabled" data-action="review-analysis" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${t.reviewAnalysis}
          </button>
          <button class="ozon-ext-panel-btn ozon-ext-panel-btn-primary ozon-ext-panel-collect-btn" data-action="collect">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            ${t.collectToERP}
          </button>
          <button class="ozon-ext-panel-btn ozon-ext-panel-btn-icon ozon-ext-panel-monitor-btn" data-action="toggle-monitor">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span class="ozon-ext-monitor-text">${this.isMonitored ? t.monitoring : t.addMonitor}</span>
          </button>
          ${this.hasChanges ? `
          <div class="ozon-ext-panel-alert">
            <span class="ozon-ext-panel-alert-icon">⚠️</span>
            <span>${this.changeAlert || t.priceChanged}</span>
          </div>
          ` : ''}
          ${this.isMonitored ? `
          <div class="ozon-ext-panel-monitor-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ${t.monitoring}
          </div>
          ` : ''}
          <button class="ozon-ext-panel-btn ozon-ext-panel-btn-icon" data-action="view-details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            ${t.viewDetails}
          </button>
        </div>
      </div>

      <!-- 利润计算器弹窗 -->
      <div class="ozon-ext-profit-calculator ozon-ext-panel-hidden" id="ozon-ext-profit-calculator">
        <div class="ozon-ext-profit-calculator-inner">
          <div class="ozon-ext-profit-calculator-header">
            <h4>${t.profitCalculatorTitle}</h4>
            <button class="ozon-ext-panel-btn ozon-ext-panel-btn-icon ozon-ext-profit-calculator-close" data-action="close-calculator">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="ozon-ext-profit-calculator-body">
            <div class="ozon-ext-profit-field">
              <label>${t.category}</label>
              <input type="text" class="ozon-ext-profit-input" id="ozon-ext-category" placeholder="自动填充" value="${p.category || ''}" readonly>
            </div>
            <div class="ozon-ext-profit-field">
              <label>${t.costPrice} (₽)</label>
              <input type="number" class="ozon-ext-profit-input" id="ozon-ext-cost-price" placeholder="0.00" value="${p.price ? (p.price * 0.9).toFixed(2) : ''}">
            </div>
            <div class="ozon-ext-profit-field">
              <label>${t.purchaseCost}</label>
              <input type="number" class="ozon-ext-profit-input" id="ozon-ext-purchase-cost" placeholder="0.00" value="0">
            </div>
            <div class="ozon-ext-profit-field">
              <label>${t.shippingCost}</label>
              <input type="number" class="ozon-ext-profit-input" id="ozon-ext-shipping-cost" placeholder="0.00" value="0">
            </div>
            <div class="ozon-ext-profit-field">
              <label>${t.exchangeRate}</label>
              <input type="number" class="ozon-ext-profit-input" id="ozon-ext-exchange-rate" placeholder="12.5" value="12.5">
            </div>
            <button class="ozon-ext-panel-btn ozon-ext-panel-btn-primary ozon-ext-profit-calculate-btn" data-action="calculate-profit">
              ${t.calculate}
            </button>
          </div>
          <div class="ozon-ext-profit-calculator-result">
            <div class="ozon-ext-profit-result-item">
              <span class="ozon-ext-profit-result-label">${t.profitAmount}</span>
              <span class="ozon-ext-profit-result-value" id="ozon-ext-profit-amount">--</span>
            </div>
            <div class="ozon-ext-profit-result-item">
              <span class="ozon-ext-profit-result-label">${t.profitRate}</span>
              <span class="ozon-ext-profit-result-value" id="ozon-ext-profit-rate">--</span>
            </div>
            <div class="ozon-ext-profit-result-item">
              <span class="ozon-ext-profit-result-label">${t.roi}</span>
              <span class="ozon-ext-profit-result-value" id="ozon-ext-roi">--</span>
            </div>
            <div class="ozon-ext-profit-result-item">
              <span class="ozon-ext-profit-result-label">${t.suggestedPrice}</span>
              <span class="ozon-ext-profit-result-value" id="ozon-ext-suggested-price">--</span>
            </div>
          </div>
          <div class="ozon-ext-profit-history" id="ozon-ext-profit-history">
            <span class="ozon-ext-profit-history-title">${t.recentHistory}</span>
            <div class="ozon-ext-profit-history-list" id="ozon-ext-profit-history-list"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 插入到页面
   */
  private insertIntoPage(): void {
    if (!this.container || !this.productInfo) return;

    // Ozon商品页
    const ozonTarget = document.querySelector('[data-widget="webProductHeading"]')?.parentElement
      || document.querySelector('.widget-container')[0]
      || document.querySelector('h1')?.parentElement;

    // WB商品页
    const wbTarget = document.querySelector('.product-page__info')?.[0]
      || document.querySelector('.product-info')[0];

    const target = ozonTarget || wbTarget || document.querySelector('main') || document.body;

    // 插入到目标元素后面
    if (target.parentElement) {
      target.parentElement.insertBefore(this.container, target.nextSibling);
    } else {
      document.body.appendChild(this.container);
    }
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    if (!this.container) return;

    // 按钮事件
    this.container.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        this.handleAction(action!);
      });
    });

    // API占位字段hover提示
    this.container.querySelectorAll('.ozon-ext-panel-field-placeholder').forEach((el) => {
      el.addEventListener('mouseenter', (e) => {
        const note = (e.currentTarget as HTMLElement).nextElementSibling;
        if (note) note.classList.add('ozon-ext-visible');
      });
      el.addEventListener('mouseleave', (e) => {
        const note = (e.currentTarget as HTMLElement).nextElementSibling;
        if (note) note.classList.remove('ozon-ext-visible');
      });
    });

    // 关键词标签点击 → 跳转到关键词挖掘Tab
    this.container.querySelectorAll('.ozon-ext-panel-keyword-tag').forEach((el) => {
      el.addEventListener('click', (e) => {
        const keyword = (e.currentTarget as HTMLElement).dataset.keyword;
        if (keyword) {
          this.messageBus.send('OPEN_KEYWORD_MINING', { keyword });
        }
      });
    });

    // 监控按钮事件（使用data-action选择器）
    const toggleMonitorBtn = this.container.querySelector('[data-action="toggle-monitor"]');
    if (toggleMonitorBtn) {
      toggleMonitorBtn.addEventListener('click', () => this.handleMonitorToggle());
    }
  }

  /**
   * 处理监控开关
   */
  private async handleMonitorToggle(): Promise<void> {
    if (!this.productInfo?.productId) return;

    const productId = this.productInfo.productId;
    const isCurrentlyMonitored = this.isMonitored;
    const apiBase = this.getApiBase();

    if (isCurrentlyMonitored) {
      // 取消监控
      try {
        const res = await fetch(`${apiBase}/api/monitor/${productId}`, { method: 'DELETE' });
        if (res.ok) {
          this.isMonitored = false;
          this.updateMonitorButton();
          this.showAlert('已取消监控');
        }
      } catch (err) {
        console.error('取消监控失败:', err);
        this.showAlert('取消监控失败');
      }
    } else {
      // 加入监控
      try {
        const res = await fetch(`${apiBase}/api/monitor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: this.productInfo.productId,
            productTitle: this.productInfo.title || (this.productInfo as any).productTitle,
            imageUrl: this.productInfo.imageUrl,
            price: this.productInfo.price,
            salesVolume: (this.productInfo as any).sales || (this.productInfo as any).salesVolume,
            platform: this.productInfo.platform || 'ozon'
          })
        });
        if (res.ok) {
          this.isMonitored = true;
          this.updateMonitorButton();
          this.showAlert('已加入监控');
        }
      } catch (err) {
        console.error('加入监控失败:', err);
        this.showAlert('加入监控失败');
      }
    }
  }

  /**
   * 显示临时提示
   */
  private showAlert(message: string): void {
    // 创建临时提示
    const existingAlert = document.querySelector('.ozon-ext-temp-alert');
    if (existingAlert) existingAlert.remove();

    const alert = document.createElement('div');
    alert.className = 'ozon-ext-temp-alert';
    alert.textContent = message;
    alert.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 13px;
      z-index: 999999;
    `;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 2000);
  }

  /**
   * 更新监控按钮状态
   */
  private updateMonitorButton(): void {
    const monitorBtn = document.querySelector('.ozon-ext-panel-monitor-btn');
    const monitorText = document.querySelector('.ozon-ext-monitor-text');
    const monitorBadge = document.querySelector('.ozon-ext-panel-monitor-badge');
    
    if (monitorText) {
      monitorText.textContent = this.isMonitored ? this.translations.monitoring : this.translations.addMonitor;
    }
    
    if (monitorBtn) {
      if (this.isMonitored) {
        monitorBtn.classList.add('ozon-ext-btn-monitored');
      } else {
        monitorBtn.classList.remove('ozon-ext-btn-monitored');
      }
    }
    
    // 更新监控状态标签显示
    if (monitorBadge) {
      (monitorBadge as HTMLElement).style.display = this.isMonitored ? 'flex' : 'none';
    }
  }

  /**
   * 处理动作
   */
  private handleAction(action: string): void {
    switch (action) {
      case 'profit-calculator':
        this.toggleProfitCalculator();
        break;
      case 'close-calculator':
        this.closeProfitCalculator();
        break;
      case 'calculate-profit':
        this.calculateProfit();
        break;
      case 'view-details':
        this.viewDetails();
        break;
      case 'collect':
        this.collectToERP();
        break;
      case 'sales-trend':
        // 灰按钮，暂不支持
        break;
      case 'review-analysis':
        // 灰按钮，暂不支持
        break;
    }
  }

  /**
   * 切换利润计算器
   */
  private toggleProfitCalculator(): void {
    const calc = this.container?.querySelector('#ozon-ext-profit-calculator');
    if (calc) {
      calc.classList.toggle('ozon-ext-panel-hidden');
    }
  }

  /**
   * 关闭利润计算器
   */
  private closeProfitCalculator(): void {
    const calc = this.container?.querySelector('#ozon-ext-profit-calculator');
    if (calc) {
      calc.classList.add('ozon-ext-panel-hidden');
    }
  }

  /**
   * 计算利润
   */
  private calculateProfit(): void {
    const costPrice = parseFloat((document.getElementById('ozon-ext-cost-price') as HTMLInputElement)?.value || '0');
    const purchaseCost = parseFloat((document.getElementById('ozon-ext-purchase-cost') as HTMLInputElement)?.value || '0');
    const shippingCost = parseFloat((document.getElementById('ozon-ext-shipping-cost') as HTMLInputElement)?.value || '0');
    const exchangeRate = parseFloat((document.getElementById('ozon-ext-exchange-rate') as HTMLInputElement)?.value || '1');

    if (!this.productInfo?.price || costPrice <= 0) {
      return;
    }

    // 计算
    const salePrice = this.productInfo.price; // 售价（卢布）
    const costRub = purchaseCost * exchangeRate + shippingCost * exchangeRate; // 总成本（卢布）
    const profit = salePrice - costRub; // 利润
    const profitRate = (profit / salePrice) * 100; // 利润率
    const roi = costRub > 0 ? ((salePrice - costRub) / costRub) * 100 : 0; // ROI

    // 更新显示
    const amountEl = document.getElementById('ozon-ext-profit-amount');
    const rateEl = document.getElementById('ozon-ext-profit-rate');
    const roiEl = document.getElementById('ozon-ext-roi');

    if (amountEl) amountEl.textContent = `${profit.toFixed(2)} ₽`;
    if (rateEl) {
      rateEl.textContent = `${profitRate.toFixed(1)}%`;
      rateEl.className = `ozon-ext-profit-result-value ${profitRate > 20 ? 'positive' : profitRate > 0 ? 'neutral' : 'negative'}`;
    }
    if (roiEl) {
      roiEl.textContent = `${roi.toFixed(1)}%`;
      roiEl.className = `ozon-ext-profit-result-value ${roi > 0 ? 'positive' : 'negative'}`;
    }
  }

  /**
   * 查看详情
   */
  private viewDetails(): void {
    // 发送消息给popup或新窗口显示详情
    if (this.productInfo) {
      this.messageBus.send('OPEN_DETAILS', { product: this.productInfo });
    }
  }

  /**
   * 采集到ERP（带预览）
   */
  private collectToERP(): void {
    if (!this.productInfo || this.collected) return;

    // 构建payload
    const sourceType: 'wb' | 'ozon_market' = this.productInfo.platform === 'wb' ? 'wb' : 'ozon_market';
    const payload: MarketSignalPayload = {
      sourceType,
      signalType: 'competition',
      productId: this.productInfo.productId,
      productTitle: this.productInfo.title || '',
      productUrl: window.location.href,
      imageUrl: this.productInfo.imageUrl,
      images: this.productInfo.images,
      price: this.productInfo.price,
      originalPrice: this.productInfo.originalPrice,
      rating: this.productInfo.rating,
      reviewsCount: this.productInfo.reviewsCount,
      salesVolume: this.productInfo.salesVolume,
      // V4新增字段
      sellerName: this.productInfo.sellerName,
      sellerType: this.productInfo.sellerType,
      followerCount: this.productInfo.followerCount,
      variantCount: this.productInfo.variantCount,
      deliveryType: this.productInfo.deliveryType,
      weight: this.productInfo.weight,
      dimensions: this.productInfo.dimensions,
      volume: this.productInfo.volume,
      listedDate: this.productInfo.listedDate,
      stock: this.productInfo.stock,
      revenue: this.productInfo.revenue,
      brandName: this.productInfo.brand,
    };

    // 计算可采集字段数量
    let collectableCount = 0;
    const totalFields = 29;
    const fields = [
      payload.productId, payload.productTitle, payload.imageUrl,
      payload.price, payload.originalPrice, payload.rating,
      payload.reviewsCount, payload.salesVolume, payload.revenue,
      payload.sellerName, payload.sellerType, payload.followerCount,
      payload.variantCount, payload.deliveryType, payload.weight,
      payload.dimensions, payload.volume, payload.listedDate, payload.stock
    ];
    fields.forEach(f => {
      if (f !== undefined && f !== null && f !== '') collectableCount++;
    });

    // 显示预览面板
    showCollectPreview({
      productId: this.productInfo.productId,
      title: this.productInfo.title || '',
      imageUrl: this.productInfo.imageUrl || '',
      price: this.productInfo.price || 0,
      originalPrice: this.productInfo.originalPrice,
      salesVolume: this.productInfo.salesVolume,
      rating: this.productInfo.rating,
      reviewCount: this.productInfo.reviewsCount,
      sellerName: this.productInfo.sellerName,
      deliveryType: this.productInfo.deliveryType,
      collectableCount,
      totalFields
    }, this.collected, (confirmed, _overwrite) => {
      if (confirmed) {
        this.doCollect(payload);
      }
    });
  }

  /**
   * 执行采集
   */
  private doCollect(payload: MarketSignalPayload): void {
    const btn = this.container?.querySelector('.ozon-ext-panel-collect-btn');
    if (btn) {
      btn.textContent = this.translations.collecting;
      (btn as HTMLButtonElement).disabled = true;
    }

    // 发送采集请求
    this.messageBus.send('PUSH_SIGNAL', payload);
  }

  /**
   * 格式化数字
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * HTML转义
   */
  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * 注入样式
   */
  private injectStyles(): void {
    if (document.getElementById('ozon-ext-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'ozon-ext-panel-styles';
    style.textContent = `
      .ozon-ext-panel {
        position: relative !important;
        width: 100% !important;
        max-width: 800px !important;
        margin: 16px auto !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        background: white !important;
        border-radius: 8px !important;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1) !important;
        overflow: hidden !important;
      }

      .ozon-ext-panel.ozon-ext-panel-hidden {
        display: none !important;
      }

      .ozon-ext-panel.ozon-ext-panel-fullscreen {
        position: fixed !important;
        top: 48px !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        max-width: none !important;
        margin: 0 !important;
        z-index: 2147483646 !important;
        overflow: auto !important;
        border-radius: 0 !important;
      }

      .ozon-ext-panel-inner {
        padding: 20px !important;
      }

      /* 标题区 */
      .ozon-ext-panel-title-section {
        margin-bottom: 16px !important;
      }

      .ozon-ext-panel-product-title {
        font-size: 18px !important;
        font-weight: 600 !important;
        color: #152033 !important;
        margin: 0 0 8px 0 !important;
        line-height: 1.4 !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
      }

      .ozon-ext-panel-meta {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        font-size: 13px !important;
        color: #637089 !important;
      }

      .ozon-ext-panel-rating {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        color: #FFB800 !important;
      }

      .ozon-ext-panel-rating svg {
        width: 14px !important;
        height: 14px !important;
      }

      .ozon-ext-panel-divider {
        color: #E6EAF2 !important;
      }

      /* SKU行 */
      .ozon-ext-panel-sku-section {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 12px !important;
        background: #F6F8FB !important;
        border-radius: 6px !important;
        margin-bottom: 16px !important;
        flex-wrap: wrap !important;
      }

      .ozon-ext-panel-sku-label {
        font-size: 13px !important;
        color: #637089 !important;
      }

      .ozon-ext-panel-sku-value {
        font-size: 13px !important;
        font-family: monospace !important;
        color: #152033 !important;
        flex: 1 !important;
      }

      .ozon-ext-panel-sku-actions {
        display: flex !important;
        gap: 8px !important;
        flex-wrap: wrap !important;
      }

      /* 按钮样式 */
      .ozon-ext-panel-btn {
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        padding: 6px 12px !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        border: none !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        background: #F6F8FB !important;
        color: #152033 !important;
      }

      .ozon-ext-panel-btn svg {
        width: 14px !important;
        height: 14px !important;
      }

      .ozon-ext-panel-btn:hover {
        background: #E6EAF2 !important;
      }

      .ozon-ext-panel-btn-primary {
        background: #1677FF !important;
        color: white !important;
      }

      .ozon-ext-panel-btn-primary:hover {
        background: #4096FF !important;
      }

      .ozon-ext-panel-btn-icon {
        background: transparent !important;
        color: #637089 !important;
      }

      .ozon-ext-panel-btn-icon:hover {
        color: #152033 !important;
        background: rgba(0, 0, 0, 0.05) !important;
      }

      .ozon-ext-panel-btn-disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }

      .ozon-ext-panel-btn-disabled:hover {
        background: #F6F8FB !important;
      }

      .ozon-ext-btn-success {
        background: #16A37B !important;
        color: white !important;
      }

      /* 数据网格 */
      .ozon-ext-panel-data-grid {
        display: grid !important;
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 12px !important;
        margin-bottom: 16px !important;
      }

      .ozon-ext-panel-field {
        display: flex !important;
        flex-direction: column !important;
        gap: 4px !important;
        position: relative !important;
      }

      .ozon-ext-panel-field-label {
        font-size: 12px !important;
        color: #637089 !important;
      }

      .ozon-ext-panel-field-value {
        font-size: 15px !important;
        font-weight: 600 !important;
        color: #152033 !important;
      }

      .ozon-ext-panel-field-highlight {
        color: #1677FF !important;
        font-size: 18px !important;
      }

      .ozon-ext-panel-field-profit {
        color: #16A37B !important;
      }

      /* 利润率颜色预警 */
      .ozon-ext-profit-high { color: #16A37B !important; }  /* >20% 绿色 */
      .ozon-ext-profit-medium { color: #F59E0B !important; }  /* 10-20% 黄色 */
      .ozon-ext-profit-low { color: #EF4444 !important; }  /* <10% 红色 */
      .ozon-ext-profit-placeholder { color: #B4BAC6 !important; }
      
      .ozon-ext-panel-field-placeholder {
        color: #B4BAC6 !important;
      }

      .ozon-ext-panel-field-api-note {
        position: absolute !important;
        top: 100% !important;
        left: 0 !important;
        padding: 4px 8px !important;
        background: rgba(0, 0, 0, 0.85) !important;
        color: white !important;
        font-size: 11px !important;
        border-radius: 4px !important;
        white-space: nowrap !important;
        z-index: 10 !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.2s !important;
      }

      .ozon-ext-panel-field-api-note.ozon-ext-visible {
        opacity: 1 !important;
      }

      /* 信息行 */
      .ozon-ext-panel-info-row {
        display: grid !important;
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 12px !important;
        padding: 12px !important;
        background: #F6F8FB !important;
        border-radius: 6px !important;
        margin-bottom: 12px !important;
      }

      /* API占位行 */
      .ozon-ext-panel-api-row {
        display: grid !important;
        grid-template-columns: repeat(5, 1fr) !important;
        gap: 12px !important;
        padding: 12px !important;
        background: #FAFBFC !important;
        border-radius: 6px !important;
        margin-bottom: 16px !important;
        border: 1px dashed #E6EAF2 !important;
      }

      .ozon-ext-panel-api-row .ozon-ext-panel-field-value {
        font-weight: 500 !important;
      }

      /* 底部按钮 */
      .ozon-ext-panel-bottom-actions {
        display: flex !important;
        justify-content: center !important;
        gap: 12px !important;
        padding-top: 12px !important;
        border-top: 1px solid #E6EAF2 !important;
      }

      /* 利润计算器 */
      .ozon-ext-profit-calculator {
        position: absolute !important;
        top: 0 !important;
        right: -320px !important;
        width: 300px !important;
        background: white !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
        z-index: 100 !important;
      }

      .ozon-ext-panel.ozon-ext-panel-fullscreen .ozon-ext-profit-calculator {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        right: auto !important;
      }

      .ozon-ext-profit-calculator.ozon-ext-panel-hidden {
        display: none !important;
      }

      .ozon-ext-profit-calculator-inner {
        padding: 16px !important;
      }

      .ozon-ext-profit-calculator-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin-bottom: 16px !important;
      }

      .ozon-ext-profit-calculator-header h4 {
        margin: 0 !important;
        font-size: 15px !important;
        font-weight: 600 !important;
        color: #152033 !important;
      }

      .ozon-ext-profit-calculator-body {
        display: flex !important;
        flex-direction: column !important;
        gap: 12px !important;
      }

      .ozon-ext-profit-field {
        display: flex !important;
        flex-direction: column !important;
        gap: 4px !important;
      }

      .ozon-ext-profit-field label {
        font-size: 12px !important;
        color: #637089 !important;
      }

      .ozon-ext-profit-input {
        padding: 8px 12px !important;
        border: 1px solid #E6EAF2 !important;
        border-radius: 4px !important;
        font-size: 14px !important;
        outline: none !important;
        transition: border-color 0.2s !important;
      }

      .ozon-ext-profit-input:focus {
        border-color: #1677FF !important;
      }

      .ozon-ext-profit-calculate-btn {
        width: 100% !important;
        justify-content: center !important;
        margin-top: 8px !important;
      }

      .ozon-ext-profit-calculator-result {
        margin-top: 16px !important;
        padding-top: 16px !important;
        border-top: 1px solid #E6EAF2 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
      }

      .ozon-ext-profit-result-item {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
      }

      .ozon-ext-profit-result-label {
        font-size: 13px !important;
        color: #637089 !important;
      }

      .ozon-ext-profit-result-value {
        font-size: 15px !important;
        font-weight: 600 !important;
        color: #152033 !important;
      }

      .ozon-ext-profit-result-value.positive {
        color: #16A37B !important;
      }

      .ozon-ext-profit-result-value.neutral {
        color: #FFB800 !important;
      }

      .ozon-ext-profit-result-value.negative {
        color: #E34D4D !important;
      }

      /* 响应式 */
      @media (max-width: 768px) {
        .ozon-ext-panel-data-grid,
        .ozon-ext-panel-info-row {
          grid-template-columns: repeat(2, 1fr) !important;
        }

        .ozon-ext-panel-api-row {
          grid-template-columns: repeat(3, 1fr) !important;
        }

        .ozon-ext-panel-sku-section {
          flex-direction: column !important;
          align-items: flex-start !important;
        }

        .ozon-ext-panel-sku-value {
          width: 100% !important;
        }

        .ozon-ext-profit-calculator {
          position: fixed !important;
          top: auto !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          border-radius: 16px 16px 0 0 !important;
          max-height: 80vh !important;
          overflow: auto !important;
        }
      }

      /* 已采集标签 */
      .ozon-ext-collected-tag {
        display: inline-flex !important;
        align-items: center !important;
        padding: 4px 10px !important;
        background: #E6F7ED !important;
        color: #16A37B !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        border-radius: 4px !important;
        margin-left: 8px !important;
      }

      .ozon-ext-collected-badge {
        position: absolute !important;
        top: 8px !important;
        right: 8px !important;
        padding: 2px 6px !important;
        background: #16A37B !important;
        color: white !important;
        font-size: 10px !important;
        font-weight: 600 !important;
        border-radius: 3px !important;
        z-index: 10 !important;
      }

      .ozon-ext-collected-badge-top-left {
        right: auto !important;
        left: 8px !important;
      }

      /* 预览面板 */
      .ozon-ext-preview-modal {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: rgba(0, 0, 0, 0.5) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        animation: ozon-ext-fade-in 0.2s ease !important;
      }

      .ozon-ext-preview-modal.ozon-ext-preview-fade-out {
        animation: ozon-ext-fade-out 0.2s ease forwards !important;
      }

      @keyframes ozon-ext-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes ozon-ext-fade-out {
        from { opacity: 1; }
        to { opacity: 0; }
      }

      .ozon-ext-preview-content {
        background: white !important;
        border-radius: 12px !important;
        width: 90% !important;
        max-width: 480px !important;
        max-height: 90vh !important;
        overflow: hidden !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
      }

      .ozon-ext-preview-content.ozon-ext-preview-result {
        padding: 32px !important;
        text-align: center !important;
      }

      .ozon-ext-preview-result-icon {
        font-size: 48px !important;
        margin-bottom: 16px !important;
      }

      .ozon-ext-preview-result-title {
        font-size: 18px !important;
        font-weight: 600 !important;
        color: #152033 !important;
        margin-bottom: 8px !important;
      }

      .ozon-ext-preview-result-message {
        font-size: 14px !important;
        color: #637089 !important;
        margin-bottom: 24px !important;
      }

      .ozon-ext-preview-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 16px 20px !important;
        border-bottom: 1px solid #E6EAF2 !important;
      }

      .ozon-ext-preview-title {
        font-size: 16px !important;
        font-weight: 600 !important;
        color: #152033 !important;
      }

      .ozon-ext-preview-close {
        background: none !important;
        border: none !important;
        font-size: 24px !important;
        color: #637089 !important;
        cursor: pointer !important;
        padding: 0 !important;
        line-height: 1 !important;
      }

      .ozon-ext-preview-close:hover {
        color: #152033 !important;
      }

      .ozon-ext-preview-body {
        padding: 20px !important;
        max-height: 60vh !important;
        overflow-y: auto !important;
      }

      .ozon-ext-preview-product {
        display: flex !important;
        gap: 12px !important;
        margin-bottom: 16px !important;
      }

      .ozon-ext-preview-img {
        width: 80px !important;
        height: 80px !important;
        object-fit: cover !important;
        border-radius: 6px !important;
        background: #F6F8FB !important;
      }

      .ozon-ext-preview-info {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
      }

      .ozon-ext-preview-product-title {
        font-size: 14px !important;
        font-weight: 500 !important;
        color: #152033 !important;
        line-height: 1.4 !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
        margin-bottom: 4px !important;
      }

      .ozon-ext-preview-product-id {
        font-size: 12px !important;
        color: #637089 !important;
      }

      .ozon-ext-preview-stats {
        background: #F6F8FB !important;
        border-radius: 8px !important;
        padding: 12px !important;
        margin-bottom: 16px !important;
      }

      .ozon-ext-preview-stat-row {
        display: flex !important;
        justify-content: space-between !important;
        padding: 4px 0 !important;
      }

      .ozon-ext-preview-stat-label {
        font-size: 13px !important;
        color: #637089 !important;
      }

      .ozon-ext-preview-stat-value {
        font-size: 13px !important;
        font-weight: 500 !important;
        color: #152033 !important;
      }

      .ozon-ext-preview-progress {
        margin-top: 8px !important;
      }

      .ozon-ext-preview-progress-label {
        font-size: 12px !important;
        color: #637089 !important;
        margin-bottom: 6px !important;
      }

      .ozon-ext-preview-progress-percent {
        color: #16A37B !important;
      }

      .ozon-ext-preview-progress-bar {
        height: 6px !important;
        background: #E6EAF2 !important;
        border-radius: 3px !important;
        overflow: hidden !important;
      }

      .ozon-ext-preview-progress-fill {
        height: 100% !important;
        background: linear-gradient(90deg, #16A37B, #2ECC71) !important;
        border-radius: 3px !important;
        transition: width 0.3s ease !important;
      }

      .ozon-ext-preview-footer {
        display: flex !important;
        gap: 12px !important;
        padding: 16px 20px !important;
        border-top: 1px solid #E6EAF2 !important;
        justify-content: flex-end !important;
      }

      .ozon-ext-preview-btn {
        padding: 10px 20px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        border: none !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
      }

      .ozon-ext-preview-btn-primary {
        background: #1677FF !important;
        color: white !important;
      }

      .ozon-ext-preview-btn-primary:hover {
        background: #4096FF !important;
      }

      .ozon-ext-preview-btn-warning {
        background: #FFB800 !important;
        color: #152033 !important;
      }

      .ozon-ext-preview-btn-warning:hover {
        background: #FFC840 !important;
      }

      .ozon-ext-preview-btn-cancel {
        background: #F6F8FB !important;
        color: #637089 !important;
      }

      .ozon-ext-preview-btn-cancel:hover {
        background: #E6EAF2 !important;
      }

      /* 关键词行 */
      .ozon-ext-panel-keywords-row {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 12px 20px !important;
        background: #F6F8FB !important;
        border-top: 1px solid #E6EAF2 !important;
        border-bottom: 1px solid #E6EAF2 !important;
      }

      .ozon-ext-panel-keywords-row .ozon-ext-panel-field-label {
        font-size: 13px !important;
        color: #637089 !important;
        white-space: nowrap !important;
        margin: 0 !important;
      }

      .ozon-ext-panel-keyword-tags {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
        flex: 1 !important;
      }

      .ozon-ext-panel-keyword-tag {
        display: inline-flex !important;
        align-items: center !important;
        padding: 4px 10px !important;
        background: #E6EAF2 !important;
        color: #152033 !important;
        font-size: 12px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
      }

      .ozon-ext-panel-keyword-tag:hover {
        background: #2F6BFF !important;
        color: white !important;
      }

      .ozon-ext-panel-field-hint {
        font-size: 11px !important;
        color: #637089 !important;
        white-space: nowrap !important;
      }

      /* 监控按钮 */
      .ozon-ext-panel-monitor-btn {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        padding: 8px 16px !important;
        background: #E6EAF2 !important;
        color: #152033 !important;
        border: none !important;
        border-radius: 6px !important;
        font-size: 13px !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        margin-top: 12px !important;
      }

      .ozon-ext-panel-monitor-btn:hover {
        background: #2F6BFF !important;
        color: white !important;
      }

      .ozon-ext-panel-monitor-btn.monitoring {
        background: #2F6BFF !important;
        color: white !important;
      }

      .ozon-ext-panel-monitor-btn.monitoring:hover {
        background: #1E4FD9 !important;
      }

      /* 监控状态标签 */
      .ozon-ext-panel-monitor-badge {
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        padding: 4px 10px !important;
        background: #2F6BFF !important;
        color: white !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        margin-left: 8px !important;
      }

      /* 价格变化提醒 */
      .ozon-ext-panel-alert {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 10px 16px !important;
        background: #FEF3C7 !important;
        border: 1px solid #F59E0B !important;
        border-radius: 6px !important;
        font-size: 13px !important;
        color: #92400E !important;
        margin-bottom: 12px !important;
      }

      .ozon-ext-panel-alert-icon {
        font-size: 16px !important;
      }
    `;
    document.head.appendChild(style);
  }
}
