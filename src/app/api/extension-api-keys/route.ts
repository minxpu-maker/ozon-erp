/**
 * Chrome插件API Key生成接口
 * 
 * POST /api/extension-api-keys
 * 生成新的API Key供插件使用
 * 
 * 注意：这是唯一能看到明文Key的机会，后续无法找回
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { extensionApiKeys, shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

// API Key 前缀
const EXTENSION_KEY_PREFIX = 'ozon_ext_';

// 默认权限
const DEFAULT_PERMISSIONS = [
  'read:signals',
  'write:signals',
  'read:opportunities',
];

// Key 有效期（1年）
const KEY_VALIDITY_DAYS = 365;

interface CreateKeyRequest {
  shopId: string;
  userId?: string;
  deviceInfo?: string;
  permissions?: string[];
  expiresInDays?: number;
}

/**
 * POST /api/extension-api-keys
 * 生成新的插件API Key
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateKeyRequest = await request.json();
    const { shopId, userId, deviceInfo, permissions, expiresInDays } = body;

    // 验证必填参数
    if (!shopId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: shopId',
        },
        { status: 400 }
      );
    }

    // 验证店铺是否存在
    const shopRecords = await db
      .select({ id: shops.id, name: shops.name })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1);

    if (shopRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Shop not found',
        },
        { status: 404 }
      );
    }

    // 生成随机Key
    const randomHex = randomBytes(32).toString('hex'); // 64位hex
    const apiKey = EXTENSION_KEY_PREFIX + randomHex; // 总长约74字符

    // 计算哈希
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.slice(0, 8); // "ozon_ext_"

    // 计算过期时间
    const validityDays = expiresInDays || KEY_VALIDITY_DAYS;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    // 插入数据库（使用 camelCase 字段名）
    const result = await db
      .insert(extensionApiKeys)
      .values({
        keyHash: keyHash,
        keyPrefix: keyPrefix,
        shopId: shopId,
        userId: userId || 'system',
        permissions: permissions || DEFAULT_PERMISSIONS,
        deviceInfo: deviceInfo || null,
        expiresAt: expiresAt,
        isActive: true,
      })
      .returning({ id: extensionApiKeys.id });

    const keyId = result[0].id;

    // 返回明文Key（唯一机会）
    return NextResponse.json({
      success: true,
      data: {
        id: keyId,
        apiKey: apiKey, // 明文Key，仅此一次
        keyPrefix: keyPrefix,
        shopId: shopId,
        shopName: shopRecords[0].name,
        permissions: permissions || DEFAULT_PERMISSIONS,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
      },
      warning: '请妥善保管此API Key，系统不会再次显示明文Key',
    });
  } catch (error) {
    console.error('[Extension API Keys] Generate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate API key',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/extension-api-keys?shopId=xxx
 * 查询店铺的API Key列表（不返回明文）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: shopId',
        },
        { status: 400 }
      );
    }

    // 查询该店铺的所有Key（不返回keyHash）
    const keys = await db
      .select({
        id: extensionApiKeys.id,
        keyPrefix: extensionApiKeys.keyPrefix,
        shopId: extensionApiKeys.shopId,
        userId: extensionApiKeys.userId,
        permissions: extensionApiKeys.permissions,
        deviceInfo: extensionApiKeys.deviceInfo,
        lastUsedAt: extensionApiKeys.lastUsedAt,
        expiresAt: extensionApiKeys.expiresAt,
        isActive: extensionApiKeys.isActive,
        createdAt: extensionApiKeys.createdAt,
      })
      .from(extensionApiKeys)
      .where(eq(extensionApiKeys.shopId, shopId));

    // 添加状态判断
    const now = new Date();
    const keysWithStatus = keys.map((key: typeof keys[number]) => ({
      ...key,
      isExpired: key.expiresAt ? new Date(key.expiresAt) < now : false,
      status: key.isActive
        ? key.expiresAt && new Date(key.expiresAt) < now
          ? 'expired'
          : 'active'
        : 'disabled',
    }));

    return NextResponse.json({
      success: true,
      data: keysWithStatus,
      total: keysWithStatus.length,
    });
  } catch (error) {
    console.error('[Extension API Keys] List error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list API keys',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/extension-api-keys?id=xxx
 * 禁用（软删除）API Key
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: id',
        },
        { status: 400 }
      );
    }

    // 软删除（设置 isActive = false）
    await db
      .update(extensionApiKeys)
      .set({ isActive: false })
      .where(eq(extensionApiKeys.id, parseInt(keyId)));

    return NextResponse.json({
      success: true,
      message: 'API key has been disabled',
    });
  } catch (error) {
    console.error('[Extension API Keys] Delete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to disable API key',
      },
      { status: 500 }
    );
  }
}
