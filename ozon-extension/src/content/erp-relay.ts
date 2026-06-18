/**
 * ERP 页面注入脚本 - Ozon API 代理桥接
 *
 * 注入到 Coze 开发环境页面（*.dev.coze.site），
 * 供 ERP 前端通过 window.__ozonExtensionRelay 调用插件后台，
 * 实现从用户浏览器直接访问 Ozon API（绕过沙箱服务器网络限制）。
 */

const EXTENSION_ID = 'pmeblkpcgpfgekgejngecihoccpjjlkc';

// 等待扩展安装状态检测
let extensionAvailable: boolean | null = null;

// 检测扩展是否已安装
function checkExtension(): Promise<boolean> {
  return new Promise((resolve) => {
    if (extensionAvailable !== null) {
      resolve(extensionAvailable);
      return;
    }
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      { type: '__PING__' },
      (response) => {
        extensionAvailable = chrome.runtime.lastError === undefined && response !== undefined;
        resolve(extensionAvailable);
      }
    );
    // 2秒超时
    setTimeout(() => {
      if (extensionAvailable === null) {
        extensionAvailable = false;
        resolve(false);
      }
    }, 2000);
  });
}

// 调用扩展后台代理
async function relayToExtension(payload: {
  shopId: string;
  ozonClientId: string;
  ozonApiKey: string;
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
}): Promise<{ connected: boolean; error?: string; data?: unknown }> {
  const isAvailable = await checkExtension();
  if (!isAvailable) {
    return { connected: false, error: '插件未安装，请在Chrome中安装Ozon智能选品助手插件' };
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      { type: '__OZON_API_CALL__', ...payload },
      (response: unknown) => {
        if (chrome.runtime.lastError) {
          resolve({ connected: false, error: `插件通信失败: ${chrome.runtime.lastError.message}` });
        } else if (response && typeof response === 'object' && 'connected' in response) {
          resolve(response as { connected: boolean; error?: string; data?: unknown });
        } else {
          resolve({ connected: false, error: '插件返回格式异常' });
        }
      }
    );
    // 10秒超时
    setTimeout(() => {
      resolve({ connected: false, error: '插件响应超时（10秒）' });
    }, 10000);
  });
}

// 暴露全局 API
(window as unknown as Record<string, unknown>).__ozonExtensionRelay = {
  ozonApiCall: relayToExtension,
  checkAvailable: checkExtension,
};

console.log('[ERP-Relay] Ozon API relay initialized. Available:', extensionAvailable);
