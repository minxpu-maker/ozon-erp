/**
 * ERP API 客户端
 * 封装所有与后端通信的逻辑
 */

import {
  BatchPushRequest,
  BatchPushResponse,
  ExtensionConfig,
} from './types';

/**
 * ERP API 客户端类
 */
export class ErpApiClient {
  private config: ExtensionConfig;

  /**
   * 构造函数
   * @param config 插件配置
   */
  constructor(config: ExtensionConfig) {
    this.config = config;
  }

  /**
   * 更新配置
   * @param config 新的插件配置
   */
  updateConfig(config: ExtensionConfig): void {
    this.config = config;
  }

  /**
   * 获取当前配置
   */
  getConfig(): ExtensionConfig {
    return this.config;
  }

  /**
   * 推送市场信号数据
   * @param request 批量推送请求
   * @returns 批量推送响应
   * @throws Error 当请求失败时抛出异常
   */
  async pushSignals(request: BatchPushRequest): Promise<BatchPushResponse> {
    const url = `${this.config.erpBaseUrl}/api/market-signals/batch`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(request),
      });

      // 检查响应状态码
      if (!response.ok) {
        throw new Error(`Push failed: ${response.status}`);
      }

      // 解析响应
      let data: BatchPushResponse;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(`Push failed: invalid response format`);
      }
      return data;
    } catch (error) {
      // 如果是我们抛出的错误，直接传递
      if (error instanceof Error && error.message.startsWith('Push failed:')) {
        throw error;
      }
      // 网络错误等其他异常
      throw new Error(`Push failed: network error`);
    }
  }

  /**
   * 验证 API Key 是否有效
   * 使用专门的认证测试接口
   * @returns true 表示有效，false 表示无效或网络错误
   */
  async validateApiKey(): Promise<boolean> {
    const url = `${this.config.erpBaseUrl}/api/extension-api-keys/test-auth`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      // 响应200表示有效
      if (response.ok) {
        const data = await response.json();
        // 检查是否有必要的权限
        return data?.success === true && data?.data?.permissions?.includes('write:signals');
      }
      return false;
    } catch (error) {
      // 任何异常都返回false，不抛出
      console.error('[ErpApiClient] validateApiKey error:', error);
      return false;
    }
  }

  /**
   * 检查后端服务是否可用（不带认证）
   * @returns true 表示可用，false 表示不可用
   */
  async checkHealth(): Promise<boolean> {
    // 使用市场信号查询接口作为健康检查（该接口不需要认证）
    const url = `${this.config.erpBaseUrl}/api/market-signals?limit=1`;

    try {
      const response = await fetch(url, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error('[ErpApiClient] checkHealth error:', error);
      return false;
    }
  }

  /**
   * 获取详细的认证信息（用于调试）
   * @returns 认证结果或null
   */
  async getAuthInfo(): Promise<{
    valid: boolean;
    shopId?: string;
    userId?: string;
    permissions?: string[];
    error?: string;
  }> {
    const url = `${this.config.erpBaseUrl}/api/extension-api-keys/test-auth`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          valid: true,
          shopId: data?.data?.shopId,
          userId: data?.data?.userId,
          permissions: data?.data?.permissions,
        };
      }

      const errorData = await response.json();
      return {
        valid: false,
        error: errorData?.error || `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'network error',
      };
    }
  }
}

/**
 * 创建 API 客户端实例的工厂函数
 * @param config 插件配置
 * @returns ErpApiClient 实例
 */
export function createApiClient(config: ExtensionConfig): ErpApiClient {
  return new ErpApiClient(config);
}
