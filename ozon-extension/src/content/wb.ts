/**
 * Wildberries 内容脚本
 * 从 WB 商品详情页提取商品数据
 */

import { MarketSignalPayload, SourceType, SignalType } from '../shared/types';
import { getMatchedPlatform } from '../shared/constants';

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
 * 提取商品名称
 */
function extractProductName(): string {
  try {
    // 尝试多种选择器
    const selectors = [
      'h1[data-link]',
      '.product-page__header',
      'h1.name',
      '.product-name',
      'h1[class*="product"]',
    ];
    
    for (const selector of selectors) {
      const text = safeGetText(selector);
      if (text) return text;
    }
    
    return '未知商品';
  } catch {
    return '未知商品';
  }
}

/**
 * 提取当前价格
 */
function extractCurrentPrice(): number {
  try {
    const selectors = [
      '.product-page__price .price-block__final-price',
      '.price-block__final-price',
      '.product-price__price',
      '[class*="final-price"]',
      '.price-current',
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
  } catch {
    return 0;
  }
}

/**
 * 提取原价
 */
function extractOriginalPrice(): number | undefined {
  try {
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
  } catch {
    return undefined;
  }
}

/**
 * 提取评分
 */
function extractRating(): number {
  try {
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
  } catch {
    return 0;
  }
}

/**
 * 提取评论数
 */
function extractReviewCount(): number {
  try {
    // 查找包含"отзыв"的链接
    const links = safeQueryAll('a');
    for (const link of links) {
      const text = link.textContent?.trim() || '';
      if (text.toLowerCase().includes('отзыв') || text.includes('отзыв')) {
        // 提取数字
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
  } catch {
    return 0;
  }
}

/**
 * 提取卖家名称
 */
function extractSellerName(): string {
  try {
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
  } catch {
    return '未知卖家';
  }
}

/**
 * 提取分类
 */
function extractCategory(): string {
  try {
    // 面包屑导航
    const breadcrumbLinks = safeQueryAll('.product-page__nav a');
    if (breadcrumbLinks.length > 0) {
      // 取最后一个
      const last = breadcrumbLinks[breadcrumbLinks.length - 1];
      const text = last.textContent?.trim();
      if (text) return text;
    }
    
    // 备用选择器
    const selectors = [
      '.breadcrumb-item:last-child',
      '[itemprop="name"]:last-child',
    ];
    
    for (const selector of selectors) {
      const text = safeGetText(selector);
      if (text) return text;
    }
    
    return '未分类';
  } catch {
    return '未分类';
  }
}

/**
 * 提取商品图片URL
 */
function extractImageUrl(): string | undefined {
  try {
    const selectors = [
      '.product-page__main-image img',
      '.product-image img',
      'img[class*="product"]',
      '.gallery img',
    ];
    
    for (const selector of selectors) {
      const img = document.querySelector(selector) as HTMLImageElement;
      if (img?.src) {
        // 确保是完整URL
        return img.src.startsWith('http') ? img.src : undefined;
      }
    }
    
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 提取销量（WB页面可能没有直接显示，尝试从描述中提取）
 */
function extractSalesVolume(): number {
  try {
    // 查找包含"купили"或"продаж"的元素
    const allText = document.body.innerText;
    
    // 匹配 "Купили X раз" 或 "X продаж"
    const patterns = [
      /купили\s*(\d+)/i,
      /(\d+)\s*продаж/i,
      /продано\s*(\d+)/i,
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
  
  // 3. 提取各字段
  const productName = extractProductName();
  const currentPrice = extractCurrentPrice();
  const originalPrice = extractOriginalPrice();
  const rating = extractRating();
  const reviewCount = extractReviewCount();
  const sellerName = extractSellerName();
  const category = extractCategory();
  const imageUrl = extractImageUrl();
  const salesVolume = extractSalesVolume();
  
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
    imageUrl,
    images: imageUrl ? [imageUrl] : [],
    brandName: sellerName,
    rawData: {
      sellerName,
      extractedAt: new Date().toISOString(),
    },
  };
  
  return signal;
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

// 默认导出
export default {
  extractWbSignal,
  collectWbData,
};
