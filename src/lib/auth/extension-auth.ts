/**
 * Chrome插件API鉴权中间件
 * 
 * 用于验证Chrome插件调用API时的身份认证
 * API Key格式: ozon_ext_xxxxx（前缀 + 随机hex）
 * 数据库存储: SHA256哈希值（不存明文）
 */

import { db } from '@/storage/database/client';
import { extensionApiKeys } from '@/storage/database/shared/schema';
import { eq, and } from 'drizzle-orm';
import { createHash } from 'crypto';

// API Key 前缀
export const EXTENSION_KEY_PREFIX = 'ozon_ext_';

// 鉴权结果类型
export interface ExtensionAuthResult {
  success: true;
  shopId: string;
  userId: string;
  permissions: string[];
  keyId: number;
}

export interface ExtensionAuthError {
  success: false;
  error: string;
  status: number;
}

export type AuthResult = ExtensionAuthResult | ExtensionAuthError;

/**
 * 验证插件API Key
 * 
 * 处理流程:
 * 1. 从请求头提取 Authorization: Bearer ozon_ext_xxxxx
 * 2. 对Key做SHA256哈希
 * 3. 查询数据库验证
 * 4. 检查过期时间
 * 5. 更新最后使用时间
 * 
 * @param request - Next.js Request对象
 * @returns 鉴权结果
 */
export async function authenticateExtension(
  request: Request
): Promise<AuthResult> {
  try {
    // 1. 从请求头提取 API Key
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return {
        success: false,
        error: 'Missing API key',
        status: 401,
      };
    }

    // 检查 Bearer 格式
    if (!authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Invalid authorization format. Expected: Bearer ozon_ext_xxx',
        status: 401,
      };
    }

    const apiKey = authHeader.slice(7).trim(); // 去掉 "Bearer "

    // 验证前缀
    if (!apiKey.startsWith(EXTENSION_KEY_PREFIX)) {
      return {
        success: false,
        error: 'Invalid API key format. Key must start with ozon_ext_',
        status: 401,
      };
    }

    // 验证 Key 长度：前缀(9) + 随机hex(64) = 73字符
    if (apiKey.length < 70) {
      return {
        success: false,
        error: 'Invalid API key: key too short',
        status: 401,
      };
    }

    // 2. 计算 SHA256 哈希
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    // keyPrefix 取前8位：ozon_ext（不包含最后的下划线）
    const keyPrefix = apiKey.slice(0, 8);

    // 3. 查询数据库
    const records = await db
      .select()
      .from(extensionApiKeys)
      .where(
        and(
          eq(extensionApiKeys.keyHash, keyHash),
          eq(extensionApiKeys.keyPrefix, keyPrefix),
          eq(extensionApiKeys.isActive, true)
        )
      )
      .limit(1);

    if (records.length === 0) {
      return {
        success: false,
        error: 'Invalid API key',
        status: 401,
      };
    }

    const keyRecord = records[0];

    // 4. 检查过期时间
    if (keyRecord.expiresAt) {
      const now = new Date();
      if (new Date(keyRecord.expiresAt) < now) {
        return {
          success: false,
          error: 'API key expired',
          status: 401,
        };
      }
    }

    // 5. 更新最后使用时间
    await db
      .update(extensionApiKeys)
      .set({
        lastUsedAt: new Date(),
      })
      .where(eq(extensionApiKeys.id, keyRecord.id));

    // 返回成功结果
    // 确保 permissions 是有效数组
    const permissions = Array.isArray(keyRecord.permissions) 
      ? keyRecord.permissions as string[] 
      : [];

    return {
      success: true,
      shopId: keyRecord.shopId,
      userId: keyRecord.userId,
      permissions,
      keyId: keyRecord.id,
    };
  } catch (error) {
    console.error('[Extension Auth] Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      status: 500,
    };
  }
}

/**
 * 检查是否拥有指定权限
 * 
 * @param permissions - 用户权限列表
 * @param required - 需要的权限
 * @returns 是否有权限
 */
export function hasPermission(
  permissions: string[],
  required: string
): boolean {
  // 通配符拥有所有权限
  if (permissions.includes('*')) {
    return true;
  }
  
  // 检查具体权限
  return permissions.includes(required);
}

/**
 * 从请求中提取 API Key（不验证）
 * 用于日志记录等场景
 */
export function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

/**
 * 创建鉴权失败的 Response
 */
export function createAuthErrorResponse(authError: ExtensionAuthError): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: authError.error,
    }),
    {
      status: authError.status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
