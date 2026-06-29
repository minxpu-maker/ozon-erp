import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // 性能优化配置
  reactStrictMode: false,
  
  // 禁用不必要的功能减少内存占用
  compress: true,
  
  // 生产环境优化
  productionBrowserSourceMaps: false,
  
  // 减少日志输出
  poweredByHeader: false,
  
  // 服务端外部包配置（不再放在 experimental 中）
  serverExternalPackages: ['pg', 'drizzle-orm', 'node-postgres'],
  
  // 图片优化
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
    // 图片加载优化
    minimumCacheTTL: 60 * 60 * 24, // 24小时缓存
    formats: ['image/avif', 'image/webp'],
    // 禁用 Sharp 图像处理（节省内存）
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  
  // Turbopack 配置（开发环境加速）
  experimental: {
    optimizeCss: true,
    // 减少编译内存占用
    memoryBasedWorkersCount: true,
  },
  
  // 允许的开发环境来源
  allowedDevOrigins: ['*.dev.coze.site'],
};

export default nextConfig;
