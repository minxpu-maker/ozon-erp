"use client";

import { useState } from "react";
import Image from "next/image";

interface MarketSignalImageProps {
  signal: {
    imageS3Url?: string | null;
    imageUrl?: string | null;
  };
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

/**
 * 市场信号图片组件
 * 优先级：S3 URL > 原始CDN URL (直连) > image-proxy兜底 > 占位图
 */
export function MarketSignalImage({
  signal,
  className = "",
  alt = "商品图片",
  width,
  height,
  priority = false,
}: MarketSignalImageProps) {
  // 优先级：S3 > 原始CDN
  const [currentSrc, setCurrentSrc] = useState(
    signal.imageS3Url || signal.imageUrl || ""
  );

  const handleError = () => {
    const current = currentSrc;

    // 如果当前是直连URL，尝试image-proxy
    if (!current.includes("/api/image-proxy")) {
      const originalUrl = signal.imageUrl || "";
      if (originalUrl) {
        setCurrentSrc(`/api/image-proxy?url=${encodeURIComponent(originalUrl)}`);
        return;
      }
    }

    // 代理也失败，显示占位图
    setCurrentSrc("/placeholder-image.png");
  };

  // 如果没有图片URL，直接显示占位图
  if (!signal.imageS3Url && !signal.imageUrl) {
    return (
      <div className={`bg-muted flex items-center justify-center ${className}`}>
        <Image
          src="/placeholder-image.png"
          alt={alt}
          width={width || 80}
          height={height || 80}
          className="object-contain"
        />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      className={className}
      onError={handleError}
      loading={priority ? "eager" : "lazy"}
    />
  );
}

/**
 * 市场信号缩略图组件（用于列表模式）
 */
export function MarketSignalThumbnail({
  signal,
  className = "",
}: {
  signal: {
    imageS3Url?: string | null;
    imageUrl?: string | null;
  };
  className?: string;
}) {
  return (
    <MarketSignalImage
      signal={signal}
      className={`w-12 h-12 rounded object-cover ${className}`}
      alt="缩略图"
      width={48}
      height={48}
    />
  );
}
