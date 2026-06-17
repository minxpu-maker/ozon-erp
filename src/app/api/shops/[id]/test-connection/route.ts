/**
 * 店铺连接测试 API
 * POST /api/shops/[id]/test-connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { testConnection } from '@/lib/ozon-client';

/**
 * POST /api/shops/[id]/test-connection
 * 测试店铺Ozon API连接
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 获取店铺信息
    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1);

    if (!shop) {
      return NextResponse.json(
        { success: false, error: '店铺不存在' },
        { status: 404 }
      );
    }

    // 检查是否有API密钥 - 优先使用主字段 client_id/api_key
    const apiKey = shop.apiKey || shop.ozonApiKey;
    const clientId = shop.clientId || shop.ozonClientId;

    if (!apiKey) {
      return NextResponse.json({
        connected: false,
        error: '该店铺未配置API密钥',
      });
    }

    if (!clientId) {
      return NextResponse.json({
        connected: false,
        error: '该店铺未配置Client-ID',
      });
    }

    // 解密API密钥
    let decryptedKey: string;
    try {
      decryptedKey = decrypt(apiKey);
    } catch (error) {
      console.error('[Test Connection] Decrypt error:', error);
      return NextResponse.json({
        connected: false,
        error: 'API密钥格式错误，解密失败',
      });
    }

    // 测试连接
    const result = await testConnection(clientId, decryptedKey);

    if (result.connected) {
      return NextResponse.json({
        connected: true,
        shopName: shop.name,
        clientId: clientId,
      });
    }

    return NextResponse.json({
      connected: false,
      error: result.error || '连接失败',
    });
  } catch (error) {
    console.error('[Test Connection] Error:', error);
    return NextResponse.json({
      connected: false,
      error: '网络连接失败',
    });
  }
}
