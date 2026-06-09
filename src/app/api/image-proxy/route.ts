/**
 * 图片代理接口
 * 
 * GET /api/image-proxy?url={编码后的图片URL}
 * 
 * 用于代理第三方平台图片，绕过防盗链限制
 * 支持内存缓存，减少重复请求
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// 配置常量
// ============================================================================

// 域名白名单（允许代理的图片域名）
const ALLOWED_DOMAINS = [
  'wildberries.ru',
  'wb.ru',
  'wbbasket.ru',
  'ozon.ru',
  'ozon-cdn.ru',
  '1688.com',
  'alicdn.com',
  'aliexpress.ru',
  'ae01.alicdn.com',
];

// 缓存配置
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24小时
const MAX_CACHE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// 请求配置
const FETCH_TIMEOUT_MS = 10000; // 10秒超时

// 模拟浏览器 User-Agent
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ============================================================================
// 内存缓存
// ============================================================================

interface CacheEntry {
  data: Buffer;
  contentType: string;
  cachedAt: number;
  size: number;
}

// 内存缓存 Map
const imageCache = new Map<string, CacheEntry>();

/**
 * 检查缓存是否过期
 */
function isCacheExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.cachedAt > CACHE_TTL_MS;
}

/**
 * 清理过期缓存（每次请求时调用，概率性清理）
 */
function cleanupExpiredCache(): void {
  // 10% 概率触发清理，避免每次请求都遍历
  if (Math.random() > 0.1) return;
  
  for (const [key, entry] of imageCache.entries()) {
    if (isCacheExpired(entry)) {
      imageCache.delete(key);
    }
  }
}

// ============================================================================
// 域名校验
// ============================================================================

/**
 * 检查域名是否在白名单中
 * 
 * 匹配规则：
 * - 精确匹配：hostname === domain
 * - 子域名匹配：hostname.endsWith('.' + domain)
 */
function isDomainAllowed(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase();
  
  for (const domain of ALLOWED_DOMAINS) {
    const lowerDomain = domain.toLowerCase();
    
    // 精确匹配
    if (lowerHostname === lowerDomain) {
      return true;
    }
    
    // 子域名匹配（如 basket-01.wbbasket.ru 匹配 wbbasket.ru）
    if (lowerHostname.endsWith('.' + lowerDomain)) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// 图片拉取
// ============================================================================

/**
 * 拉取第三方图片
 */
async function fetchImage(imageUrl: string): Promise<{
  success: boolean;
  data?: Buffer;
  contentType?: string;
  error?: string;
}> {
  try {
    // 解析 URL 获取 origin（用于 Referer）
    const urlObj = new URL(imageUrl);
    const referer = `${urlObj.origin}/`;
    
    // 创建超时信号
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Referer': referer,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return {
        success: false,
        error: `Upstream returned ${response.status}`,
      };
    }
    
    // 获取 Content-Type
    const contentType = response.headers.get('Content-Type') || 'image/jpeg';
    
    // 读取图片数据
    const arrayBuffer = await response.arrayBuffer();
    const data = Buffer.from(arrayBuffer);
    
    return {
      success: true,
      data,
      contentType,
    };
    
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request timeout' };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Unknown error' };
  }
}

// ============================================================================
// API Handler
// ============================================================================

/**
 * GET /api/image-proxy?url={编码后的图片URL}
 * 图片代理接口
 */
export async function GET(request: NextRequest) {
  try {
    // 清理过期缓存
    cleanupExpiredCache();
    
    // 1. 获取 url 参数
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'url parameter required' },
        { status: 400 }
      );
    }
    
    // 2. 解析 URL 并校验域名
    let hostname: string;
    try {
      const urlObj = new URL(imageUrl);
      hostname = urlObj.hostname;
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }
    
    if (!isDomainAllowed(hostname)) {
      return NextResponse.json(
        { error: 'Domain not allowed' },
        { status: 403 }
      );
    }
    
    // 3. 检查内存缓存
    const cachedEntry = imageCache.get(imageUrl);
    
    if (cachedEntry && !isCacheExpired(cachedEntry)) {
      // 缓存命中
      return new NextResponse(new Uint8Array(cachedEntry.data), {
        status: 200,
        headers: {
          'Content-Type': cachedEntry.contentType,
          'Cache-Control': 'public, max-age=86400',
          'X-Cache': 'HIT',
          'X-Cache-Size': String(cachedEntry.size),
        },
      });
    }
    
    // 4. 拉取第三方图片
    const result = await fetchImage(imageUrl);
    
    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch image' },
        { status: 502 }
      );
    }
    
    const { data, contentType } = result;
    const imageSize = data.length;
    
    // 5. 写入缓存（如果小于 5MB）
    if (imageSize <= MAX_CACHE_SIZE_BYTES) {
      imageCache.set(imageUrl, {
        data,
        contentType: contentType!,
        cachedAt: Date.now(),
        size: imageSize,
      });
    }
    
    // 6. 返回图片
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': contentType!,
        'Cache-Control': 'public, max-age=86400',
        'X-Cache': 'MISS',
        'X-Image-Size': String(imageSize),
        ...(imageSize > MAX_CACHE_SIZE_BYTES && {
          'X-Cache-Skipped': 'Image too large',
        }),
      },
    });
    
  } catch (error) {
    console.error('[ImageProxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
