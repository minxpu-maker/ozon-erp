/**
 * Ozon 配置管理
 */

export interface OzonShopConfig {
  name: string;
  clientId: string;
  apiKey: string;
  baseUrl?: string;
  isDefault?: boolean;
}

/**
 * 获取 Ozon 配置
 * 优先从环境变量读取，支持多店铺配置
 */
export function getOzonConfig(): {
  clientId: string | null;
  apiKey: string | null;
  baseUrl: string;
} {
  return {
    clientId: process.env.OZON_CLIENT_ID || null,
    apiKey: process.env.OZON_API_KEY || null,
    baseUrl: process.env.OZON_BASE_URL || 'https://api-seller.ozon.ru',
  };
}

/**
 * 获取所有配置的店铺
 * TODO: 从数据库读取多店铺配置
 */
export function getOzonShops(): OzonShopConfig[] {
  const config = getOzonConfig();

  // 如果环境变量有配置，返回默认店铺
  if (config.clientId && config.apiKey) {
    return [
      {
        name: '默认店铺',
        clientId: config.clientId,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        isDefault: true,
      },
    ];
  }

  return [];
}

/**
 * 验证 API 配置是否有效
 */
export async function validateOzonConfig(
  clientId: string,
  apiKey: string,
  baseUrl: string = 'https://api-seller.ozon.ru'
): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/v2/posting/fbs/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify({
        filter: { status: 'awaiting_packaging' },
        limit: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'API 验证失败';

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        // 忽略
      }

      return { valid: false, error: errorMessage };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : '网络错误',
    };
  }
}
