'use client';

import { useState, useMemo, useRef } from 'react';
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

// 白名单域名（需要通过image-proxy代理的域名）
const NEEDS_PROXY_DOMAINS = [
  'ozonstatic.cn',
];

/**
 * 检查URL是否需要代理
 */
function needsProxy(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return NEEDS_PROXY_DOMAINS.some(domain => 
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
  const [loadState, setLoadState] = useState<'idle' | 'direct' | 'proxy' | 'error'>('idle');
  const retryCountRef = useRef(0);
  const maxRetries = 1;

  // 计算图片源策略
  const imageSource = useMemo(() => {
    if (!src) return { type: 'none' as const, url: null };
    
    // 相对路径或data URI，直接使用
    if (src.startsWith('/') || src.startsWith('data:')) {
      return { type: 'direct' as const, url: src };
    }
    
    // 需要代理的域名，使用image-proxy
    if (needsProxy(src)) {
      return { type: 'proxy' as const, url: buildProxyUrl(src) };
    }
    
    // 其他CDN（如WB、1688等），优先直连
    return { type: 'direct' as const, url: src };
  }, [src]);

  const handleError = () => {
    retryCountRef.current += 1;
    
    // 如果直连失败，且还有重试机会，尝试代理
    if (loadState === 'direct' && retryCountRef.current <= maxRetries && src) {
      setLoadState('proxy');
      return;
    }
    
    // 如果是代理也失败，或者已经是代理，设置为错误状态
    setLoadState('error');
    setTimeout(() => {
      onError?.();
    }, 0);
  };

  const handleLoad = () => {
    setLoadState('idle');
    retryCountRef.current = 0;
    onLoad?.();
  };

  const handleLoadStart = () => {
    if (loadState === 'idle') {
      // 初始状态，根据imageSource判断是直连还是代理
      if (imageSource.type === 'direct') {
        setLoadState('direct');
      } else if (imageSource.type === 'proxy') {
        setLoadState('proxy');
      }
    }
  };

  // 无图片或加载失败时显示占位符
  if (imageSource.type === 'none' || loadState === 'error') {
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

  // 确定当前要显示的图片URL
  const currentUrl = loadState === 'proxy' 
    ? buildProxyUrl(src!) 
    : imageSource.url;

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
      {showLoading && loadState !== 'idle' && (
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center rounded-lg">
          <ImageIcon className={cn(iconSizeMap[iconSize], 'text-muted-foreground/30')} />
        </div>
      )}
      
      {/* 实际图片 */}
      <img
        src={currentUrl || ''}
        alt={alt}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        className={cn(
          'rounded-lg',
          loadState !== 'idle' && 'opacity-0',
          className
        )}
        onLoadStart={handleLoadStart}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
    </div>
  );
}

/**
 * 简化版：获取最佳图片URL（用于需要URL字符串的地方）
 * 注意：这是同步的，不支持动态fallback
 */
export function getProxiedImageUrl(originalUrl: string | null | undefined): string | null {
  if (!originalUrl) return null;
  
  // 相对路径或data URI，直接使用
  if (originalUrl.startsWith('/') || originalUrl.startsWith('data:')) {
    return originalUrl;
  }
  
  // 需要代理的域名
  if (needsProxy(originalUrl)) {
    return buildProxyUrl(originalUrl);
  }
  
  // 其他CDN直连（不带referrer）
  return originalUrl;
}
