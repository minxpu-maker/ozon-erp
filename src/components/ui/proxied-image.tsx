'use client';

import { useState, useMemo } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProxiedImageProps {
  /** 原始图片URL（第三方CDN地址） */
  src: string | null | undefined;
  /** 图片描述 */
  alt: string;
  /** 自定义类名 */
  className?: string;
  /** 容器类名 */
  containerClassName?: string;
  /** 图片加载失败时的回调 */
  onError?: () => void;
  /** 图片加载成功时的回调 */
  onLoad?: () => void;
  /** 是否显示加载状态 */
  showLoading?: boolean;
  /** 占位图标大小 */
  iconSize?: 'sm' | 'md' | 'lg';
  /** 点击回调 */
  onClick?: () => void;
}

// 白名单域名（与后端 image-proxy 保持一致）
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

/**
 * 检查URL是否在白名单中
 */
function isAllowedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * 构建代理URL
 */
function buildProxyUrl(originalUrl: string): string {
  const encodedUrl = encodeURIComponent(originalUrl);
  return `/api/image-proxy?url=${encodedUrl}`;
}

const iconSizeMap = {
  sm: 'w-6 h-6',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export function ProxiedImage({
  src,
  alt,
  className,
  containerClassName,
  onError,
  onLoad,
  showLoading = true,
  iconSize = 'md',
  onClick,
}: ProxiedImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 判断是否需要使用代理
  const imageSrc = useMemo(() => {
    if (!src) return null;
    
    // 如果是相对路径或本站路径，直接使用
    if (src.startsWith('/') || src.startsWith('data:')) {
      return src;
    }
    
    // 检查是否在白名单中
    if (isAllowedDomain(src)) {
      return buildProxyUrl(src);
    }
    
    // 不在白名单，直接使用原始URL（可能会被防盗链拒绝）
    console.warn(`Image domain not in whitelist: ${src}`);
    return src;
  }, [src]);

  const handleError = () => {
    setError(true);
    setLoading(false);
    onError?.();
  };

  const handleLoad = () => {
    setLoading(false);
    onLoad?.();
  };

  // 无图片或加载失败时显示占位符
  if (!imageSrc || error) {
    return (
      <div 
        className={cn(
          'bg-muted rounded-lg flex items-center justify-center',
          containerClassName,
          onClick && 'cursor-pointer'
        )}
        onClick={onClick}
      >
        <ImageIcon className={cn(iconSizeMap[iconSize], 'text-muted-foreground/30')} />
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'relative overflow-hidden',
        containerClassName,
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* 加载占位符 */}
      {loading && showLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center rounded-lg">
          <ImageIcon className={cn(iconSizeMap[iconSize], 'text-muted-foreground/30')} />
        </div>
      )}
      
      {/* 实际图片 */}
      <img
        src={imageSrc}
        alt={alt}
        className={cn(
          'rounded-lg',
          loading && 'opacity-0',
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
    </div>
  );
}

/**
 * 简化版：仅返回代理后的URL
 */
export function getProxiedImageUrl(originalUrl: string | null | undefined): string | null {
  if (!originalUrl) return null;
  
  // 如果是相对路径或本站路径，直接使用
  if (originalUrl.startsWith('/') || originalUrl.startsWith('data:')) {
    return originalUrl;
  }
  
  // 检查是否在白名单中
  if (isAllowedDomain(originalUrl)) {
    return buildProxyUrl(originalUrl);
  }
  
  // 不在白名单，直接使用原始URL
  return originalUrl;
}

export default ProxiedImage;
