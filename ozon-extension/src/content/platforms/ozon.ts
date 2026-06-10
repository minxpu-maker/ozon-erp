/**
 * Ozon 内容脚本
 * 在 Ozon 商品详情页注入
 */

console.log('[Ozon Extension] Ozon content script loaded');

// 检测页面类型
const isProductPage = () => {
  return window.location.pathname.includes('/product/');
};

if (isProductPage()) {
  console.log('[Ozon Extension] Ozon product page detected');
  
  // TODO: 实现商品数据采集逻辑
}

export {};
