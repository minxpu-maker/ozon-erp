'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageViewerProps {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageViewer({ images, initialIndex = 0, isOpen, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 重置状态
  const resetState = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 切换图片时重置
  useEffect(() => {
    resetState();
  }, [currentIndex, resetState]);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
          break;
        case 'ArrowRight':
          if (currentIndex < images.length - 1) setCurrentIndex(currentIndex + 1);
          break;
        case '+':
        case '=':
          setZoom(Math.min(zoom + 0.25, 4));
          break;
        case '-':
          setZoom(Math.max(zoom - 0.25, 0.5));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length, zoom, onClose]);

  // 鼠标拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(Math.max(0.5, Math.min(4, zoom + delta)));
  };

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* 工具栏 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
        <button
          onClick={() => setZoom(Math.max(zoom - 0.25, 0.5))}
          className="p-1 hover:bg-white/20 rounded text-white transition-colors"
          title="缩小"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-white text-sm min-w-[60px] text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(Math.min(zoom + 0.25, 4))}
          className="p-1 hover:bg-white/20 rounded text-white transition-colors"
          title="放大"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <div className="w-px h-4 bg-white/30 mx-1" />
        <button
          onClick={() => setRotation((rotation + 90) % 360)}
          className="p-1 hover:bg-white/20 rounded text-white transition-colors"
          title="旋转"
        >
          <RotateCw className="w-5 h-5" />
        </button>
        <button
          onClick={resetState}
          className="p-1 hover:bg-white/20 rounded text-white transition-colors text-xs"
          title="重置"
        >
          重置
        </button>
      </div>

      {/* 图片计数 */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-white/10 rounded px-3 py-1">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* 左右切换 */}
      {images.length > 1 && currentIndex > 0 && (
        <button
          onClick={() => setCurrentIndex(currentIndex - 1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      {images.length > 1 && currentIndex < images.length - 1 && (
        <button
          onClick={() => setCurrentIndex(currentIndex + 1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* 图片 */}
      <div
        className={cn(
          "relative max-w-[90vw] max-h-[90vh] overflow-hidden",
          zoom > 1 ? "cursor-move" : "cursor-default"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <img
          src={currentImage}
          alt={`图片 ${currentIndex + 1}`}
          className="max-w-full max-h-[90vh] object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
          }}
          draggable={false}
        />
      </div>

      {/* 缩略图列表 */}
      {images.length > 1 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 max-w-[80vw] overflow-x-auto px-4 py-2 bg-black/50 rounded-lg">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all",
                idx === currentIndex
                  ? "border-white ring-2 ring-white/50"
                  : "border-transparent hover:border-white/50"
              )}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 商品图片组件（带点击放大功能）
interface ProductImageProps {
  src: string | null | undefined;
  allImages?: string[];
  alt?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ProductImage({ src, allImages, alt = '商品图片', className, size = 'md' }: ProductImageProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };
  
  const images = allImages || (src ? [src] : []);
  
  if (!src) {
    return (
      <div className={cn(sizeClasses[size], "bg-muted rounded flex items-center justify-center text-muted-foreground text-xs", className)}>
        无图
      </div>
    );
  }
  
  return (
    <>
      <button
        onClick={() => setViewerOpen(true)}
        className={cn(
          sizeClasses[size],
          "rounded overflow-hidden border hover:ring-2 hover:ring-primary/50 transition-all bg-white",
          className
        )}
      >
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-full object-cover"
        />
      </button>
      
      <ImageViewer
        images={images}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}

export default ImageViewer;
