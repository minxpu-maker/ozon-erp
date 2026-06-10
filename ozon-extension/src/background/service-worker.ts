/**
 * Chrome Extension Service Worker
 * 后台服务工作线程
 */

console.log('[Ozon Extension] Service worker loaded');

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Ozon Extension] Installed:', details.reason);
  
  if (details.reason === 'install') {
    // 首次安装时打开欢迎页或设置页
    console.log('[Ozon Extension] First time install');
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Ozon Extension] Message received:', message, 'from:', sender.tab?.url);
  
  // 返回响应
  sendResponse({ received: true });
  
  // 保持消息通道开放（用于异步响应）
  return true;
});

export {};
