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
    
    // 提取V4扩展数据（双策略：JSON + DOM兜底）
    const v4Data = extractV4Data();
    
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
      categoryPath,
      // V4新增字段
      sellerName: v4Data.sellerName,
      sellerType: v4Data.sellerType,
      followerCount: v4Data.followerCount,
      variantCount: v4Data.variantCount,
      deliveryType: v4Data.deliveryType,
      weight: v4Data.weight,
      dimensions: v4Data.dimensions,
      volume: v4Data.volume,
      listedDate: v4Data.listedDate,
      stock: v4Data.stock,
      // 计算字段（需要后续通过利润计算器填充）
      revenue: price && reviewsCount ? price * reviewsCount * 0.01 : undefined
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
    
    // 提取配送类型（卡片级别）
    let deliveryType: 'FBO' | 'FBS' | 'RFBS' | 'FBP' | undefined;
    const fulfillmentEl = card.querySelector('[class*="fulfillment"], [class*="fbo"], [class*="fbs"], [class*="badge"]');
    if (fulfillmentEl?.textContent) {
      const text = fulfillmentEl.textContent.toLowerCase();
      if (text.includes('ozon') || text.includes('fbo')) deliveryType = 'FBO';
      else if (text.includes('seller') || text.includes('fbs')) deliveryType = 'FBS';
      else if (text.includes('rfbs')) deliveryType = 'RFBS';
    }
    
    // 组装结果
    const signal: MarketSignalPayload = {
      sourceType: 'ozon_market' as SourceType,
      signalType: 'competition' as SignalType,
      productId,
      productTitle,
      productUrl,
      price,
      imageUrl,
      // V4新增字段（卡片级简化数据）
      deliveryType
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

// ============================================================================
// V4 Schema 新增字段提取函数
// ============================================================================

/**
 * 策略1：尝试从页面内嵌JSON中提取数据（主策略）
 */
function extractFromEmbeddedJson(): {
  sellerName?: string;
  sellerType?: 'local' | 'cross_border';
  followerCount?: number;
  variantCount?: number;
  deliveryType?: 'FBO' | 'FBS' | 'RFBS' | 'FBP';
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  volume?: number;
  listedDate?: string;
  stock?: number;
} | null {
  try {
    // 查找 __NEXT_DATA__ 或 Redux/Redwood 状态
    const scripts = document.querySelectorAll('script[type="application/json"], script[id*="state"], script[id*="data"]');
    
    for (const script of scripts) {
      try {
        const content = script.textContent || '';
        // 尝试解析为 JSON
        if (content.includes('"seller"') || content.includes('"brand"') || content.includes('"weight"')) {
          const data = JSON.parse(content);
          // 递归搜索关键字段
          const result = searchJsonForProductData(data);
          if (result && (result.sellerName || result.weight)) {
            console.log('[Ozon] Extracted from embedded JSON:', result);
            return result;
          }
        }
      } catch {}
    }
  } catch (error) {
    console.log('[Ozon] Failed to extract from embedded JSON:', error);
  }
  return null;
}

/**
 * 递归搜索JSON中的商品数据
 */
function searchJsonForProductData(obj: any, depth = 0): any | null {
  if (depth > 10 || !obj) return null;
  
  // 检查是否是商品数据
  if (obj && typeof obj === 'object') {
    if (obj.sellerName || obj.seller_name || obj.brand || obj.brand_name) {
      return {
        sellerName: obj.sellerName || obj.seller_name || obj.brand || obj.brand_name,
        sellerType: obj.sellerType || obj.seller_type,
        followerCount: obj.followerCount || obj.follower_count || obj.followers,
        variantCount: obj.variantCount || obj.variants_count || obj.variants,
        weight: obj.weight || obj.weight_gram,
        listedDate: obj.listedDate || obj.first_online_date || obj.created_at
      };
    }
  }
  
  // 递归搜索
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'object' && value !== null) {
      const result = searchJsonForProductData(value, depth + 1);
      if (result) return result;
    }
  }
  
  return null;
}

/**
 * 策略2：DOM选择器兜底提取
 */
function extractFromDOM(): {
  sellerName?: string;
  sellerType?: 'local' | 'cross_border';
  followerCount?: number;
  variantCount?: number;
  deliveryType?: 'FBO' | 'FBS' | 'RFBS' | 'FBP';
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  volume?: number;
  listedDate?: string;
  stock?: number;
} {
  const result = {
    sellerName: undefined as string | undefined,
    sellerType: undefined as 'local' | 'cross_border' | undefined,
    followerCount: undefined as number | undefined,
    variantCount: undefined as number | undefined,
    deliveryType: undefined as 'FBO' | 'FBS' | 'RFBS' | 'FBP' | undefined,
    weight: undefined as number | undefined,
    dimensions: undefined as { length: number; width: number; height: number } | undefined,
    volume: undefined as number | undefined,
    listedDate: undefined as string | undefined,
    stock: undefined as number | undefined
  };
  
  // 卖家名称 - 多选择器尝试
  const sellerSelectors = [
    '[class*="seller-name"]',
    '[class*="brand-link"] a',
    '[class*="seller"] a',
    '[data-widget="sellerInfo"] [class*="name"]',
    'a[href*="/seller/"]'
  ];
  for (const selector of sellerSelectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) {
      result.sellerName = el.textContent.trim();
      break;
    }
  }
  
  // 卖家类型 - 本土/跨境标签
  const sellerTypeSelectors = [
    '[class*="type-badge"]',
    '[class*="local"]',
    '[class*="cross-border"]',
    '[class*="international"]'
  ];
  for (const selector of sellerTypeSelectors) {
    const el = document.querySelector(selector);
    if (el?.textContent) {
      const text = el.textContent.toLowerCase();
      if (text.includes('本土') || text.includes('российский') || text.includes('local')) {
        result.sellerType = 'local';
      } else if (text.includes('跨境') || text.includes('international') || text.includes('cross')) {
        result.sellerType = 'cross_border';
      }
      break;
    }
  }
  
  // 卖家关注者数量
  const followerSelectors = [
    '[class*="follower"]',
    '[class*="subscriber"]',
    '[data-widget="sellerInfo"] [class*="count"]'
  ];
  for (const selector of followerSelectors) {
    const el = document.querySelector(selector);
    if (el?.textContent) {
      const match = el.textContent.match(/[\d\s]+/);
      if (match) {
        result.followerCount = parseInt(match[0].replace(/\s/g, ''));
        break;
      }
    }
  }
  
  // 变体数量
  const variantSelectors = [
    '[class*="variant"] [class*="count"]',
    '[class*="color-count"]',
    '[data-widget="variants"] [class*="count"]'
  ];
  for (const selector of variantSelectors) {
    const el = document.querySelector(selector);
    if (el?.textContent) {
      const match = el.textContent.match(/\d+/);
      if (match) {
        result.variantCount = parseInt(match[0]);
        break;
      }
    }
  }
  
  // 配送类型
  const deliverySelectors = [
    '[class*="delivery-type"]',
    '[class*=" fulfilment"]',
    '[data-widget="fulfillmentBadge"]',
    '[class*="ozon-fulfillment"]',
    '[class*="fbs"]',
    '[class*="fbo"]'
  ];
  for (const selector of deliverySelectors) {
    const el = document.querySelector((selector));
    if (el?.textContent || el) {
      const text = (el.textContent || '').toLowerCase();
      if (text.includes('ozon') || text.includes('fbo')) {
        result.deliveryType = 'FBO';
      } else if (text.includes('seller') || text.includes('fbs')) {
        result.deliveryType = 'FBS';
      } else if (text.includes('rfbs')) {
        result.deliveryType = 'RFBS';
      } else if (text.includes('野生')) {
        result.deliveryType = 'RFBS';
      }
      break;
    }
  }
  
  // 商品重量
  const weightSelectors = [
    '[class*="weight"]',
    '[class*="mass"]',
    '[data-widget="characteristics"] [class*="Вес"]',
    '[data-widget="product-Charasteristics"] span'
  ];
  for (const selector of weightSelectors) {
    const el = document.querySelector(selector);
    if (el?.textContent) {
      const match = el.textContent.match(/(\d+(?:\.\d+)?)\s*(г|кг|g|kg)?/i);
      if (match) {
        let weight = parseFloat(match[1]);
        const unit = (match[2] || 'г').toLowerCase();
        if (unit === 'кг' || unit === 'kg') {
          weight *= 1000; // 转换为克
        }
        result.weight = weight;
        break;
      }
    }
  }
  
  // 尺寸
  const dimensionSelectors = [
    '[class*="dimensions"]',
    '[class*="size"]',
    '[data-widget="characteristics"]'
  ];
  for (const selector of dimensionSelectors) {
    const el = document.querySelector(selector);
    if (el?.textContent) {
      const text = el.textContent;
      // 匹配格式如: 30 × 20 × 10 см
      const dimMatch = text.match(/(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)/);
      if (dimMatch) {
        result.dimensions = {
          length: parseFloat(dimMatch[1]),
          width: parseFloat(dimMatch[2]),
          height: parseFloat(dimMatch[3])
        };
        // 计算体积（升）：长×宽×高/1000000
        if (result.dimensions) {
          result.volume = 
            (result.dimensions.length * result.dimensions.width * result.dimensions.height) / 1000000;
        }
        break;
      }
    }
  }
  
  // 上架日期
  const dateSelectors = [
    '[class*="first-on-line"]',
    '[class*="created"]',
    '[data-widget="characteristics"] [class*="Дата"]',
    '[class*="date-added"]'
  ];
  for (const selector of dateSelectors) {
    const el = document.querySelector(selector);
    if (el?.textContent) {
      // 尝试解析日期
      const dateStr = el.textContent.trim();
      const parsed = parseRussianDate(dateStr);
      if (parsed) {
        result.listedDate = parsed;
        break;
      }
    }
  }
  
  // 库存数量
  const stockSelectors = [
    '[class*="stock"] [class*="count"]',
    '[class*="quantity"]',
    '[data-widget="addToCart"] [class*="count"]'
  ];
  for (const selector of stockSelectors) {
    const el = document.querySelector(selector);
    if (el?.textContent) {
      const match = el.textContent.match(/\d+/);
      if (match) {
        result.stock = parseInt(match[0]);
        break;
      }
    }
  }
  
  return result;
}

/**
 * 解析俄语日期格式
 */
function parseRussianDate(dateStr: string): string | null {
  const months: Record<string, string> = {
    'янв': '01', 'фев': '02', 'мар': '03', 'апр': '04',
    'май': '05', 'июн': '06', 'июл': '07', 'авг': '08',
    'сен': '09', 'окт': '10', 'ноя': '11', 'дек': '12',
    'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
    'мая': '05', 'июня': '06', 'июля': '07', 'августа': '08',
    'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12'
  };
  
  // 格式: DD Month YYYY 或 DD.MM.YYYY
  const ruMatch = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (ruMatch) {
    const month = months[ruMatch[2].toLowerCase().substring(0, 3)];
    if (month) {
      return `${ruMatch[3]}-${month}-${ruMatch[1].padStart(2, '0')}`;
    }
  }
  
  // 格式: DD.MM.YYYY
  const dotMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dotMatch) {
    return `${dotMatch[3]}-${dotMatch[2].padStart(2, '0')}-${dotMatch[1].padStart(2, '0')}`;
  }
  
  return null;
}

/**
 * 提取完整的V4扩展数据（双策略）
 */
function extractV4Data(): {
  sellerName?: string;
  sellerType?: 'local' | 'cross_border';
  followerCount?: number;
  variantCount?: number;
  deliveryType?: 'FBO' | 'FBS' | 'RFBS' | 'FBP';
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  volume?: number;
  listedDate?: string;
  stock?: number;
} {
  // 策略1：优先从内嵌JSON提取
  const jsonData = extractFromEmbeddedJson();
  if (jsonData) {
    const result = { ...jsonData };
    // 计算体积
    if (jsonData.dimensions) {
      result.volume = (jsonData.dimensions.length * jsonData.dimensions.width * jsonData.dimensions.height) / 1000000;
    }
    return result;
  }
  
  // 策略2：DOM选择器兜底
  const domData = extractFromDOM();
  const result = { ...domData };
  // 计算体积
  if (domData.dimensions) {
    result.volume = (domData.dimensions.length * domData.dimensions.width * domData.dimensions.height) / 1000000;
  }
  return result;
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
