/**
 * Wildberries 内容脚本
 * 在 Wildberries 商品详情页注入
 */

console.log('[Ozon Extension] Wildberries content script loaded');

// 检测页面类型
const isProductPage = () => {
  return window.location.pathname.includes('/catalog/') && window.location.pathname.includes('/detail.aspx');
};

if (isProductPage()) {
  console.log('[Ozon Extension] Wildberries product page detected');
  
  // TODO: 实现商品数据采集逻辑
}

export {};
