/**
 * Wildberries 内容脚本
 * 从 WB 商品详情页提取商品数据
 * 
 * 匹配页面：https://www.wildberries.ru/catalog/{商品ID}/detail.aspx
 * 
 * 提取策略：
 * 1. 优先从 #__NEXT_DATA__ 提取JSON数据（准确）
 * 2. Fallback到DOM元素提取（兜底）
 */

import { MarketSignalPayload, SourceType, SignalType } from '../shared/types';
import { getMatchedPlatform, MESSAGE_TYPES } from '../shared/constants';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 解析数字字符串
 * 去掉所有非数字非小数点字符后 parseFloat，NaN则返回0
 */
function parseNumber(text: string | null | undefined): number {
  if (!text) return 0;
  // 去掉所有非数字非小数点字符
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * 安全获取元素的文本内容
 */
function safeGetText(selector: string, context: Document | Element = document): string {
  try {
    const element = context.querySelector(selector);
    return element?.textContent?.trim() || '';
  } catch {
    return '';
  }
}

/**
 * 安全获取多个元素
 */
function safeQueryAll(selector: string): Element[] {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch {
    return [];
  }
}

/**
 * 标准化图片URL
 * - 补上 https: 前缀（如果以 // 开头）
 * - 补上 WB CDN 前缀（如果是相对路径）
 * - 过滤掉 data: 占位图
 */
function normalizeImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  
  // 过滤 data: 占位图
  if (url.startsWith('data:')) return undefined;
  
  // 过滤 placeholder 图片
  if (url.includes('placeholder') || url.includes('no-photo')) return undefined;
  
  // 补上 https: 前缀
  if (url.startsWith('//')) {
    return 'https:' + url;
  }
  
  // 补上 WB CDN 前缀（相对路径）
  if (!url.startsWith('http')) {
    // WB 图片CDN前缀
    return 'https://basket-01.wbbasket.ru/' + url.replace(/^\//, '');
  }
  
  return url;
}

// ============================================================================
// __NEXT_DATA__ 提取（优先方案）
// ============================================================================

interface WbNextData {
  props?: {
    pageProps?: {
      product?: WbProductData;
      goods?: WbProductData;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface WbProductData {
  id?: number | string;
  name?: string;
  title?: string;
  priceU?: number; // 价格（戈比，需要除以100）
  salePriceU?: number;
  originalPriceU?: number;
  sale?: number; // 折扣价
  price?: number;
  imt_id?: number;
  root_parent_id?: number;
  pics?: string[];
  photo?: string[];
  images?: string[];
  media?: { photos?: string[] };
  rating?: number;
  feedbacks?: number;
  review_count?: number;
  brand?: string;
  brandName?: string;
  seller?: { name?: string } | string;
  categoryName?: string;
  category?: string;
  [key: string]: unknown;
}

/**
 * 从 #__NEXT_DATA__ 提取商品数据
 */
function extractFromNextData(): { 
  productData: WbProductData | null; 
  rawData: WbNextData | null;
} {
  try {
    const scriptEl = document.getElementById('__NEXT_DATA__');
    if (!scriptEl?.textContent) {
      return { productData: null, rawData: null };
    }
    
    const json: WbNextData = JSON.parse(scriptEl.textContent);
    const pageProps = json?.props?.pageProps;
    
    // 尝试多个可能的字段
    const productData = pageProps?.product || pageProps?.goods || null;
    
    return { productData, rawData: json };
  } catch (error) {
    console.warn('[WB] Failed to parse __NEXT_DATA__:', error);
    return { productData: null, rawData: null };
  }
}

/**
 * 从 NextData 中提取图片数组
 */
function extractImagesFromNextData(productData: WbProductData | null): string[] {
  if (!productData) return [];
  
  const images: string[] = [];
  
  // 尝试多个可能的图片字段
  const possibleFields = [
    productData.pics,
    productData.photo,
    productData.images,
    productData.media?.photos,
  ];
  
  for (const field of possibleFields) {
    if (Array.isArray(field)) {
      for (const img of field) {
        if (typeof img === 'string') {
          const normalized = normalizeImageUrl(img);
          if (normalized && !images.includes(normalized)) {
            images.push(normalized);
          }
        }
      }
    }
  }
  
  return images;
}

// ============================================================================
// DOM 提取（Fallback方案）
// ============================================================================

/**
 * 从DOM提取商品名称
 */
function extractProductNameFromDOM(): string {
  const selectors = [
    'h1[data-link]',
    '.product-page__header',
    'h1.name',
    '.product-name',
    'h1[class*="product"]',
    'h1',
  ];
  
  for (const selector of selectors) {
    const text = safeGetText(selector);
    if (text && text.length > 2) return text;
  }
  
  return '未知商品';
}

/**
 * 从DOM提取当前价格
 */
function extractCurrentPriceFromDOM(): number {
  const selectors = [
    '.product-page__price .price-block__final-price',
    '.price-block__final-price',
    '.product-price__price',
    '[class*="final-price"]',
    '.price-current',
    '[class*="price"]',
  ];
  
  for (const selector of selectors) {
    const elements = safeQueryAll(selector);
    if (elements.length > 0) {
      const text = elements[0].textContent?.trim() || '';
      const price = parseNumber(text);
      if (price > 0) return price;
    }
  }
  
  return 0;
}

/**
 * 从DOM提取原价
 */
function extractOriginalPriceFromDOM(): number | undefined {
  const selectors = [
    '.price-block__old-price',
    '.product-price__old-price',
    '[class*="old-price"]',
    '.price-original',
  ];
  
  for (const selector of selectors) {
    const text = safeGetText(selector);
    if (text) {
      const price = parseNumber(text);
      if (price > 0) return price;
    }
  }
  
  return undefined;
}

/**
 * 从DOM提取评分
 */
function extractRatingFromDOM(): number {
  const selectors = [
    '.product-page__rating .address-rate-mini',
    '.address-rate-mini',
    '.rating-value',
    '[class*="rating"]',
  ];
  
  for (const selector of selectors) {
    const text = safeGetText(selector);
    if (text) {
      const rating = parseFloat(text.replace(',', '.'));
      if (!isNaN(rating) && rating >= 0 && rating <= 5) {
        return rating;
      }
    }
  }
  
  return 0;
}

/**
 * 从DOM提取评论数
 */
function extractReviewCountFromDOM(): number {
  // 查找包含"отзыв"的链接
  const links = safeQueryAll('a');
  for (const link of links) {
    const text = link.textContent?.trim() || '';
    if (text.toLowerCase().includes('отзыв')) {
      const match = text.match(/(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  }
  
  // 备用选择器
  const selectors = [
    '.product-page__rating-count',
    '.reviews-count',
    '[class*="review-count"]',
  ];
  
  for (const selector of selectors) {
    const text = safeGetText(selector);
    if (text) {
      const count = parseNumber(text);
      if (count > 0) return count;
    }
  }
  
  return 0;
}

/**
 * 从DOM提取卖家名称
 */
function extractSellerNameFromDOM(): string {
  const selectors = [
    '.seller-info__name',
    '.product-page__seller-name',
    '[class*="seller-name"]',
    '.brand-name',
  ];
  
  for (const selector of selectors) {
    const text = safeGetText(selector);
    if (text) return text;
  }
  
  return '未知卖家';
}

/**
 * 从DOM提取分类路径
 */
function extractCategoryFromDOM(): string {
  // 面包屑导航
  const breadcrumbLinks = safeQueryAll('.product-page__nav a, nav.breadcrumbs a, [class*="breadcrumb"] a');
  if (breadcrumbLinks.length > 0) {
    const parts = breadcrumbLinks
      .map(el => el.textContent?.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' / ');
    }
  }
  
  // 取最后一个面包屑
  const last = safeGetText('.breadcrumb-item:last-child, [itemprop="name"]:last-child');
  if (last) return last;
  
  return '未分类';
}

/**
 * 从DOM提取图片数组
 */
function extractImagesFromDOM(): string[] {
  const images: string[] = [];
  
  const selectors = [
    '.product-page__carousel img',
    '.product-image img',
    '[class*="swiper-slide"] img',
    '.gallery img',
    'img[class*="product"]',
  ];
  
  for (const selector of selectors) {
    const imgs = document.querySelectorAll(selector);
    for (const img of imgs) {
      const src = (img as HTMLImageElement).src;
      const normalized = normalizeImageUrl(src);
      if (normalized && !images.includes(normalized)) {
        images.push(normalized);
      }
    }
    if (images.length > 0) break;
  }
  
  return images;
}

/**
 * 从DOM提取销量
 */
function extractSalesVolumeFromDOM(): number {
  try {
    const allText = document.body.innerText;
    
    const patterns = [
      /купили\s*(\d+)/i,
      /(\d+)\s*продаж/i,
      /продано\s*(\d+)/i,
      /bought\s*(\d+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = allText.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    
    return 0;
  } catch {
    return 0;
  }
}

// ============================================================================
// 主提取函数
// ============================================================================

/**
 * 从URL提取商品ID
 * WB商品详情页URL格式：/catalog/{productId}/detail.aspx
 */
function extractProductIdFromUrl(): string | null {
  try {
    const pathname = window.location.pathname;
    const match = pathname.match(/catalog\/(\d+)\/detail/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * 主提取函数：从 Wildberries 商品详情页提取商品数据
 * 
 * 提取策略：
 * 1. 优先从 #__NEXT_DATA__ 提取（准确）
 * 2. Fallback到DOM元素提取（兜底）
 */
export function extractWbSignal(): MarketSignalPayload | null {
  // 1. 验证是否在WB页面
  const matched = getMatchedPlatform(window.location.href);
  if (!matched || matched.platform !== 'wb') {
    return null;
  }
  
  // 2. 从URL提取商品ID
  const productId = extractProductIdFromUrl();
  if (!productId) {
    console.warn('[WB] Failed to extract product ID from URL:', window.location.href);
    return null;
  }
  
  // 3. 尝试从 __NEXT_DATA__ 提取（优先方案）
  const { productData, rawData } = extractFromNextData();
  
  let productName: string;
  let currentPrice: number;
  let originalPrice: number | undefined;
  let rating: number;
  let reviewCount: number;
  let sellerName: string;
  let category: string;
  let images: string[];
  let salesVolume: number;
  
  if (productData) {
    // 从 JSON 数据提取
    productName = productData.name || productData.title || extractProductNameFromDOM();
    
    // WB 价格可能是戈比（需要除以100）
    if (productData.priceU) {
      currentPrice = Math.round(productData.priceU / 100);
    } else if (productData.salePriceU) {
      currentPrice = Math.round(productData.salePriceU / 100);
    } else if (productData.sale) {
      currentPrice = productData.sale;
    } else if (productData.price) {
      currentPrice = productData.price;
    } else {
      currentPrice = extractCurrentPriceFromDOM();
    }
    
    if (productData.originalPriceU) {
      originalPrice = Math.round(productData.originalPriceU / 100);
    } else {
      originalPrice = extractOriginalPriceFromDOM();
    }
    
    rating = productData.rating ?? extractRatingFromDOM();
    reviewCount = productData.feedbacks ?? productData.review_count ?? extractReviewCountFromDOM();
    
    // 卖家名称
    if (typeof productData.seller === 'string') {
      sellerName = productData.seller;
    } else if (productData.seller?.name) {
      sellerName = productData.seller.name;
    } else {
      sellerName = productData.brand || productData.brandName || extractSellerNameFromDOM();
    }
    
    category = productData.categoryName || productData.category || extractCategoryFromDOM();
    
    // 图片
    images = extractImagesFromNextData(productData);
    if (images.length === 0) {
      images = extractImagesFromDOM();
    }
    
    salesVolume = extractSalesVolumeFromDOM();
    
  } else {
    // Fallback到 DOM 提取
    console.log('[WB] __NEXT_DATA__ not found, falling back to DOM extraction');
    productName = extractProductNameFromDOM();
    currentPrice = extractCurrentPriceFromDOM();
    originalPrice = extractOriginalPriceFromDOM();
    rating = extractRatingFromDOM();
    reviewCount = extractReviewCountFromDOM();
    sellerName = extractSellerNameFromDOM();
    category = extractCategoryFromDOM();
    images = extractImagesFromDOM();
    salesVolume = extractSalesVolumeFromDOM();
  }
  
  // 4. 组装返回对象
  const signal: MarketSignalPayload = {
    sourceType: 'wb' as SourceType,
    signalType: 'demand' as SignalType, // WB热销商品 = 需求信号
    productId,
    productTitle: productName,
    productUrl: window.location.href,
    categoryPath: category,
    price: currentPrice > 0 ? currentPrice : undefined,
    originalPrice,
    salesVolume,
    rating,
    reviewsCount: reviewCount,
    imageUrl: images[0] || undefined,
    images,
    brandName: sellerName,
    // ========== V4 新增字段 ==========
    // 商家与配送
    sellerName,
    sellerType: (productData?.sellerType as string || extractSellerTypeFromDOM()) as 'local' | 'cross_border' | undefined,
    followerCount: (productData?.supplierVolume as number || productData?.volume as number || 0) || undefined,
    variantCount: (productData?.variantsCount as number || 0) || undefined,
    deliveryType: extractDeliveryType() as 'FBO' | 'FBS' | 'RFBS' | 'FBP' | undefined,
    // 商品规格
    weight: extractWeightFromDOM(),
    dimensions: extractDimensionsFromDOM(),
    volume: extractVolumeFromDOM(),
    listedDate: productData?.addDate as string || extractListedDateFromDOM(),
    stock: (productData?.stocks as number) || extractStockFromDOM(),
    // 计算字段
    revenue: currentPrice > 0 && salesVolume > 0 ? currentPrice * salesVolume : undefined,
    // API占位字段（一期为空）
    returnRate: undefined,
    impressions: undefined,
    cardViews: undefined,
    cartRate: undefined,
    adShare: undefined,
    // ========== V4 新增字段结束 ==========
    rawData: rawData ? { 
      nextData: true,
      sellerName,
      extractedAt: new Date().toISOString(),
    } : {
      nextData: false,
      sellerName,
      extractedAt: new Date().toISOString(),
    },
  };
  
  console.log('[WB] Extracted signal:', {
    productId,
    productName,
    price: currentPrice,
    images: images.length,
  });
  
  return signal;
}

// ============================================================================
// V4 扩展字段提取函数
// ============================================================================

/**
 * 提取卖家类型（本土/跨境）
 * WB通常展示在商品详情页的卖家信息区
 */
function extractSellerTypeFromDOM(): 'local' | 'cross_border' | undefined {
  try {
    // 尝试从__NEXT_DATA__中获取
    const nextDataScript = document.getElementById('__NEXT_DATA__');
    if (nextDataScript) {
      const data = JSON.parse(nextDataScript.textContent || '{}');
      const isCountry = data?.props?.pageProps?.product?.isCountry;
      if (isCountry === true) return 'local';
      if (isCountry === false) return 'cross_border';
    }
    
    // DOM兜底：查找"Страна"或国家标识
    const countryText = document.body.textContent || '';
    if (countryText.includes('российский') || countryText.includes('Россия')) {
      return 'local';
    }
    if (countryText.includes('Китай') || countryText.includes('Турция')) {
      return 'cross_border';
    }
    
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 提取配送类型
 * WB展示FBS/FBO等标签
 */
function extractDeliveryType(): 'FBO' | 'FBS' | 'RFBS' | undefined {
  try {
    // 查找配送类型标识
    const deliveryElements = document.querySelectorAll('[class*="delivery"], [class*="shipping"]');
    for (const el of deliveryElements) {
      const text = el.textContent || '';
      if (text.includes('Wildberries') && text.includes('FBS')) return 'FBS';
      if (text.includes('со склада')) return 'FBO';
    }
    return 'FBS'; // WB默认FBS
  } catch {
    return 'FBS';
  }
}

/**
 * 提取商品重量（克）
 */
function extractWeightFromDOM(): number | undefined {
  try {
    const text = document.body.textContent || '';
    // 匹配 "Вес: 500 г" 或 "500 г"
    const weightMatch = text.match(/(?:Вес|вес)[^0-9]*(\d+)\s*г/i) || 
                       text.match(/(\d+)\s*г\s*$/);
    if (weightMatch) {
      return parseInt(weightMatch[1], 10);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 提取商品尺寸（长宽高，mm）
 */
function extractDimensionsFromDOM(): { length: number; width: number; height: number } | undefined {
  try {
    const text = document.body.textContent || '';
    // 匹配 "Размер: 20x30x10 см"
    const dimMatch = text.match(/(\d+)\s*[xх×]\s*(\d+)\s*[xх×]\s*(\d+)/i);
    if (dimMatch) {
      const [, length, width, height] = dimMatch;
      // 转换为mm（假设是cm单位）
      return {
        length: parseInt(length, 10) * 10,
        width: parseInt(width, 10) * 10,
        height: parseInt(height, 10) * 10,
      };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 计算体积（升）
 */
function extractVolumeFromDOM(): number | undefined {
  const dims = extractDimensionsFromDOM();
  if (dims) {
    // 长×宽×高 / 1,000,000 = 体积(升)
    return (dims.length * dims.width * dims.height) / 1000000;
  }
  return undefined;
}

/**
 * 提取上架日期
 */
function extractListedDateFromDOM(): string | undefined {
  try {
    const text = document.body.textContent || '';
    // 匹配日期格式 "01.01.2024" 或 "2024-01-01"
    const dateMatch = text.match(/(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})/) ||
                      text.match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/);
    if (dateMatch) {
      const [, a, b, c] = dateMatch;
      // 转换为ISO格式
      if (c.length === 4) {
        // YYYY-MM-DD格式
        return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      } else {
        // DD-MM-YYYY格式
        return `${a}-${b}-${c}`;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 提取库存数量
 */
function extractStockFromDOM(): number | undefined {
  try {
    const nextDataScript = document.getElementById('__NEXT_DATA__');
    if (nextDataScript) {
      const data = JSON.parse(nextDataScript.textContent || '{}');
      const stocks = data?.props?.pageProps?.product?.stocks;
      if (typeof stocks === 'number') return stocks;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 导出便捷函数（用于消息通信）
 */
export function collectWbData(): { success: boolean; data?: MarketSignalPayload; error?: string } {
  try {
    const signal = extractWbSignal();
    if (signal) {
      return { success: true, data: signal };
    }
    return { success: false, error: 'Not on a valid WB product page' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ============================================================================
// 消息监听器
// ============================================================================

/**
 * 初始化消息监听
 */
function initMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('[WB] Received message:', message.type);
    
    const msgType = message.type;
    
    // 一键采集
    if (msgType === MESSAGE_TYPES.COLLECT_SINGLE || 
        msgType === 'collect' || 
        msgType === 'COLLECT_WB') {
      const result = collectWbData();
      sendResponse(result);
      return true; // 保持消息通道开放
    }
    
    // 连续采集 - 直接发送给 Background
    if (msgType === MESSAGE_TYPES.COLLECT_START || msgType === 'auto_collect') {
      const signal = extractWbSignal();
      if (signal) {
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.PUSH_SIGNAL,
          data: signal,
          source: 'wb',
        }).catch(err => {
          console.error('[WB] Failed to send PUSH_SIGNAL:', err);
        });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Extraction failed' });
      }
      return true;
    }
    
    return false;
  });
}

// ============================================================================
// 初始化
// ============================================================================

/**
 * 页面就绪通知
 */
function notifyPageReady(): void {
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.PAGE_READY,
    platform: 'wb',
    url: window.location.href,
    productId: extractProductIdFromUrl(),
  }).catch(err => {
    // Background 可能未准备好，忽略错误
    console.debug('[WB] Failed to notify PAGE_READY:', err);
  });
}

// 初始化
initMessageListener();
notifyPageReady();

console.log('[WB] Content script loaded on:', window.location.href);

// 默认导出
export default {
  extractWbSignal,
  collectWbData,
};
