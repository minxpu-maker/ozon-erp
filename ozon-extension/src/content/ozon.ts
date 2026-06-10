/**
 * Ozon 内容脚本
 * 支持商品详情页单条提取和搜索结果页批量提取
 * 
 * 匹配页面：
 * - 商品详情页：https://ozon.ru/product/* 或 https://www.ozon.ru/product/*
 * - 搜索结果页：https://ozon.ru/search* 或 https://ozon.ru/category/*
 */

import { 
  MarketSignalPayload, 
  SourceType, 
  SignalType 
} from '../shared/types';
import { 
  getMatchedPlatform, 
  MESSAGE_TYPES 
} from '../shared/constants';

// ============================================================================
// 类型定义
// ============================================================================

interface ExtractResult {
  success: boolean;
  data: MarketSignalPayload | MarketSignalPayload[] | null;
  isBatch: boolean;
  error?: string;
}

interface PageType {
  isSearchPage: boolean;
  isDetailPage: boolean;
  isCategoryPage: boolean;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 解析数字（去掉货币符号和空格）
 */
function parseNumber(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  
  try {
    // 去掉所有非数字非小数点字符
    const cleaned = text.replace(/[^\d.,]/g, '');
    if (!cleaned) return undefined;
    
    // 处理俄语数字格式（逗号作为小数点）
    const normalized = cleaned.replace(',', '.');
    const num = parseFloat(normalized);
    
    return isNaN(num) ? undefined : num;
  } catch {
    return undefined;
  }
}

/**
 * 安全获取元素文本
 */
function safeGetText(selector: string, parent: Element | Document = document): string | null {
  try {
    const el = parent instanceof Document 
      ? parent.querySelector(selector)
      : parent.querySelector(selector);
    return el?.textContent?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * 从 URL 提取 Ozon 商品 ID
 * Ozon URL 格式：/product/名称-ID/ 或 /名称-ID/
 * ID 在最后面，是纯数字
 */
function extractProductIdFromUrl(url: string): string | null {
  try {
    // 匹配 URL 末尾的数字 ID
    // 格式1: /product/名称-12345/
    // 格式2: /名称-12345/
    const match = url.match(/-(\d+)\/?$/);
    if (match) {
      return match[1];
    }
    
    // 备用：匹配 /product/ 后面包含 ID 的部分
    const productMatch = url.match(/\/product\/[^/]*-(\d+)/);
    if (productMatch) {
      return productMatch[1];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * 标准化图片 URL
 * - 补上 https: 前缀（//开头）
 * - 把尺寸部分替换为 /original/ 获取高清图
 */
function normalizeImageUrl(url: string): string | null {
  if (!url) return null;
  
  // 过滤占位图
  if (url.includes('placeholder') || url.startsWith('data:')) {
    return null;
  }
  
  let normalized = url;
  
  // 补上协议
  if (normalized.startsWith('//')) {
    normalized = 'https:' + normalized;
  }
  
  // 确保是 https
  if (!normalized.startsWith('http')) {
    return null;
  }
  
  // 替换尺寸为 original 获取高清图
  // Ozon 图片 URL 格式：/300x300/ 或 /wc100/ 等
  normalized = normalized.replace(/\/\d+x\d+\//g, '/original/');
  normalized = normalized.replace(/\/wc\d+\//g, '/original/');
  
  return normalized;
}

/**
 * 判断当前页面类型
 */
function getPageType(): PageType {
  const url = window.location.href;
  const pathname = window.location.pathname;
  
  return {
    isSearchPage: pathname.includes('/search') || url.includes('search='),
    isDetailPage: pathname.includes('/product/'),
    isCategoryPage: pathname.includes('/category/')
  };
}

// ============================================================================
// 商品详情页提取
// ============================================================================

/**
 * 从商品详情页提取图片数组
 */
function extractDetailImages(): string[] {
  const images: string[] = [];
  const selectors = [
    '[class*="gallery"] img',
    '[class*="slider"] img',
    '[data-widget="webGallery"] img',
    '[class*="product-image"] img',
    '.tile-image img',
    'img[class*="gallery"]'
  ];
  
  for (const selector of selectors) {
    try {
      const imgs = document.querySelectorAll(selector);
      imgs.forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        const normalized = normalizeImageUrl(src || '');
        if (normalized && !images.includes(normalized)) {
          images.push(normalized);
        }
      });
      if (images.length > 0) break;
    } catch {}
  }
  
  return images;
}

/**
 * 从商品详情页提取价格
 */
function extractDetailPrice(): { price?: number; originalPrice?: number } {
  const priceSelectors = [
    '[data-widget="webPrice"]',
    '.a9g3',
    '[class*="product-price"]',
    '[class*="price-block"]',
    '[class*="current-price"]'
  ];
  
  const originalPriceSelectors = [
    '[class*="old-price"]',
    '[class*="original-price"]',
    '[class*="was-price"]'
  ];
  
  let price: number | undefined;
  let originalPrice: number | undefined;
  
  // 提取当前价格
  for (const selector of priceSelectors) {
    const text = safeGetText(selector);
    if (text) {
      price = parseNumber(text);
      if (price !== undefined && price > 0) break;
    }
  }
  
  // 提取原价
  for (const selector of originalPriceSelectors) {
    const text = safeGetText(selector);
    if (text) {
      originalPrice = parseNumber(text);
      if (originalPrice !== undefined && originalPrice > 0) break;
    }
  }
  
  return { price, originalPrice };
}

/**
 * 提取卖家数量（Ozon 特有）
 */
function extractSellerCount(): number | undefined {
  try {
    // 尝试从 "所有卖家" 按钮提取
    const allSellersBtn = document.querySelector('[class*="all-sellers"], [class*="other-sellers"]');
    if (allSellersBtn) {
      const text = allSellersBtn.textContent || '';
      const match = text.match(/(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    
    // 数卖家卡片数量
    const sellerCards = document.querySelectorAll('[class*="seller-card"], [class*="seller-item"]');
    if (sellerCards.length > 0) {
      return sellerCards.length;
    }
    
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 提取评分
 */
function extractRating(): number | undefined {
  const selectors = [
    '[class*="rating-value"]',
    '[class*="stars"]',
    '[class*="product-rating"]',
    '[data-widget="webRating"]'
  ];
  
  for (const selector of selectors) {
    const text = safeGetText(selector);
    if (text) {
      const rating = parseNumber(text);
      if (rating !== undefined && rating >= 0 && rating <= 5) {
        return rating;
      }
    }
  }
  
  return undefined;
}

/**
 * 提取评价数量
 */
function extractReviewCount(): number | undefined {
  const selectors = [
    '[class*="review-count"]',
    '[class*="feedback-count"]',
    'a[href*="reviews"]',
    'a[href*="feedbacks"]'
  ];
  
  for (const selector of selectors) {
    const text = safeGetText(selector);
    if (text) {
      const count = parseNumber(text);
      if (count !== undefined && count > 0) {
        return count;
      }
    }
  }
  
  return undefined;
}

/**
 * 提取类目路径
 */
function extractCategoryPath(): string | undefined {
  try {
    const breadcrumbSelectors = [
      '[class*="breadcrumb"] a',
      'nav a[class*="link"]',
      '[data-widget="webBreadcrumbs"] a'
    ];
    
    for (const selector of breadcrumbSelectors) {
      const links = document.querySelectorAll(selector);
      if (links.length > 0) {
        const parts: string[] = [];
        links.forEach(link => {
          const text = link.textContent?.trim();
          if (text && text.length > 0 && text.length < 100) {
            parts.push(text);
          }
        });
        if (parts.length > 0) {
          return parts.join(' / ');
        }
      }
    }
    
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 提取品牌名称
 */
function extractBrandName(): string | undefined {
  const selectors = [
    '[class*="brand"]',
    '[data-widget="webBrand"]',
    'a[href*="brand"]'
  ];
  
  for (const selector of selectors) {
    const text = safeGetText(selector);
    if (text && text.length > 0 && text.length < 100) {
      return text;
    }
  }
  
  return undefined;
}

/**
 * 从商品详情页提取完整数据
 */
export function extractOzonProduct(): MarketSignalPayload | null {
  try {
    // 验证平台
    const platformInfo = getMatchedPlatform(window.location.href);
    if (!platformInfo || platformInfo.platform !== 'ozon_market') {
      console.log('[Ozon] Not an Ozon product page');
      return null;
    }
    
    // 提取商品 ID
    const productId = extractProductIdFromUrl(window.location.href);
    if (!productId) {
      console.warn('[Ozon] Failed to extract product ID from URL');
      return null;
    }
    
    // 提取标题
    const productTitle = safeGetText('h1') || safeGetText('[class*="product-title"]') || '未知商品';
    
    // 提取图片
    const images = extractDetailImages();
    const imageUrl = images[0] || undefined;
    
    // 提取价格
    const { price, originalPrice } = extractDetailPrice();
    
    // 提取卖家数量
    const sellerCount = extractSellerCount();
    
    // 提取评分
    const rating = extractRating();
    
    // 提取评价数
    const reviewsCount = extractReviewCount();
    
    // 提取类目
    const categoryPath = extractCategoryPath();
    
    // 提取品牌
    const brandName = extractBrandName();
    
    // 组装结果
    const signal: MarketSignalPayload = {
      sourceType: 'ozon_market' as SourceType,
      signalType: 'competition' as SignalType,
      productId,
      productTitle,
      productUrl: window.location.href,
      price,
      originalPrice,
      rating,
      reviewsCount,
      sellerCount,
      imageUrl,
      images,
      brandName,
      categoryPath
    };
    
    console.log('[Ozon] Extracted product:', signal);
    return signal;
    
  } catch (error) {
    console.error('[Ozon] Extract product failed:', error);
    return null;
  }
}

// ============================================================================
// 搜索结果页批量提取
// ============================================================================

/**
 * 从搜索结果页提取商品卡片列表
 */
function findProductCards(): Element[] {
  const selectors = [
    '[data-widget="searchResultsV2"] > div > div',
    '[data-widget="searchResultsV2"] [class*="product"]',
    '[class*="product-card"]',
    '[class*="tile-container"]',
    '[class*="item-card"]'
  ];
  
  for (const selector of selectors) {
    try {
      const cards = document.querySelectorAll(selector);
      if (cards.length > 0) {
        return Array.from(cards);
      }
    } catch {}
  }
  
  return [];
}

/**
 * 从单个商品卡片提取数据
 */
function extractFromCard(card: Element): MarketSignalPayload | null {
  try {
    // 找商品链接
    const linkSelectors = [
      'a[href*="/product/"]',
      'a[href*="-"]',
      'a[class*="link"]'
    ];
    
    let productLink: HTMLAnchorElement | null = null;
    let productUrl: string | undefined;
    let productId: string | null = null;
    
    for (const selector of linkSelectors) {
      const link = card.querySelector(selector) as HTMLAnchorElement;
      if (link) {
        const href = link.getAttribute('href') || link.href;
        if (href && href.includes('/product/')) {
          productLink = link;
          productUrl = href.startsWith('http') ? href : `https://ozon.ru${href}`;
          productId = extractProductIdFromUrl(href);
          if (productId) break;
        }
      }
    }
    
    // 没有 ID 的卡片跳过（可能是广告）
    if (!productId) {
      return null;
    }
    
    // 提取标题
    let productTitle: string | undefined;
    if (productLink) {
      productTitle = productLink.textContent?.trim() || productLink.getAttribute('title') || undefined;
    }
    if (!productTitle) {
      productTitle = safeGetText('[class*="title"]', card) || safeGetText('[class*="name"]', card) || undefined;
    }
    if (!productTitle) {
      productTitle = '未知商品';
    }
    
    // 提取价格
    let price: number | undefined;
    const priceSelectors = ['[class*="price"]', '[data-widget="webPrice"]', '.a9g3'];
    for (const selector of priceSelectors) {
      const text = safeGetText(selector, card);
      if (text) {
        price = parseNumber(text);
        if (price !== undefined && price > 0) break;
      }
    }
    
    // 提取图片
    let imageUrl: string | undefined;
    const img = card.querySelector('img');
    if (img) {
      const src = img.getAttribute('src') || img.getAttribute('data-src');
      imageUrl = normalizeImageUrl(src || '') || undefined;
    }
    
    // 组装结果
    const signal: MarketSignalPayload = {
      sourceType: 'ozon_market' as SourceType,
      signalType: 'competition' as SignalType,
      productId,
      productTitle,
      productUrl,
      price,
      imageUrl
    };
    
    return signal;
    
  } catch (error) {
    return null;
  }
}

/**
 * 从搜索结果页批量提取数据
 */
export function extractOzonSearchResults(): MarketSignalPayload[] {
  try {
    const cards = findProductCards();
    console.log(`[Ozon] Found ${cards.length} product cards`);
    
    const results: MarketSignalPayload[] = [];
    
    for (const card of cards) {
      const signal = extractFromCard(card);
      if (signal) {
        results.push(signal);
      }
    }
    
    console.log(`[Ozon] Extracted ${results.length} products from search results`);
    return results;
    
  } catch (error) {
    console.error('[Ozon] Extract search results failed:', error);
    return [];
  }
}

// ============================================================================
// 消息处理
// ============================================================================

/**
 * 处理采集请求
 */
function handleCollect(): ExtractResult {
  const pageType = getPageType();
  
  // 搜索页或分类页 - 批量提取
  if (pageType.isSearchPage || pageType.isCategoryPage) {
    const results = extractOzonSearchResults();
    return {
      success: true,
      data: results,
      isBatch: true
    };
  }
  
  // 详情页 - 单条提取
  if (pageType.isDetailPage) {
    const result = extractOzonProduct();
    if (result) {
      return {
        success: true,
        data: result,
        isBatch: false
      };
    }
    return {
      success: false,
      data: null,
      isBatch: false,
      error: 'Failed to extract product data'
    };
  }
  
  return {
    success: false,
    data: null,
    isBatch: false,
    error: 'Not a supported Ozon page'
  };
}

/**
 * 初始化消息监听器
 */
function initMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const msgType = message.type || message.action;
    
    // 一键采集
    if (msgType === MESSAGE_TYPES.COLLECT_SINGLE || msgType === 'collect') {
      console.log('[Ozon] Received collect message');
      const result = handleCollect();
      sendResponse(result);
      return true;
    }
    
    // 连续采集
    if (msgType === MESSAGE_TYPES.COLLECT_START || msgType === 'auto_collect') {
      console.log('[Ozon] Received auto_collect message');
      const result = handleCollect();
      
      if (result.success && result.data) {
        // 发送数据给 Background 推送
        const payload = result.isBatch 
          ? result.data 
          : [result.data as MarketSignalPayload];
        
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.PUSH_BATCH,
          data: payload
        }).catch(err => console.error('[Ozon] Push batch failed:', err));
      }
      
      sendResponse({
        success: result.success,
        count: result.isBatch 
          ? (result.data as MarketSignalPayload[]).length 
          : (result.success ? 1 : 0)
      });
      return true;
    }
    
    return false;
  });
}

// ============================================================================
// 初始化
// ============================================================================

/**
 * 初始化内容脚本
 */
function init(): void {
  console.log('[Ozon] Content script loaded');
  console.log('[Ozon] URL:', window.location.href);
  
  const pageType = getPageType();
  console.log('[Ozon] Page type:', pageType);
  
  // 发送页面就绪通知
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.PAGE_READY,
    platform: 'ozon_market',
    url: window.location.href,
    productId: pageType.isDetailPage ? extractProductIdFromUrl(window.location.href) : undefined,
    isSearchPage: pageType.isSearchPage || pageType.isCategoryPage
  }).catch(err => console.error('[Ozon] Page ready notification failed:', err));
  
  // 初始化消息监听器
  initMessageListener();
}

// 执行初始化
init();

// 导出供测试使用
export { getPageType, extractProductIdFromUrl, normalizeImageUrl };
