/**
 * Wildberries 内容脚本入口
 * 在 Wildberries 商品详情页注入
 * 
 * 此文件是 manifest.json 中配置的内容脚本入口
 * 实际提取逻辑在 ../wb.ts 中
 */

import { extractWbSignal, collectWbData } from '../wb';

console.log('[Ozon Extension] Wildberries content script loaded');

// 检测页面类型
const isProductPage = (): boolean => {
  return window.location.pathname.includes('/catalog/') && window.location.pathname.includes('/detail.aspx');
};

if (isProductPage()) {
  console.log('[Ozon Extension] Wildberries product page detected');
  
  // 监听来自 background 或 popup 的消息
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'COLLECT_WB' || message.type === 'COLLECT_SINGLE') {
      const result = collectWbData();
      sendResponse(result);
      return true; // 保持消息通道开放
    }
    return false;
  });
  
  // 页面加载时自动提取一次（可选，用于调试）
  // const signal = extractWbSignal();
  // if (signal) {
  //   console.log('[Ozon Extension] WB signal extracted:', signal);
  // }
}

// 导出供外部使用
export { extractWbSignal, collectWbData };
