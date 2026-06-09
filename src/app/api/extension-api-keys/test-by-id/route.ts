import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { extensionApiKeys } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/extension-api-keys/test-by-id
 * 通过 Key ID 测试鉴权（用于前端测试按钮）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyId } = body;

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: 'keyId is required' },
        { status: 400 }
      );
    }

    // 查询 Key 记录
    const keyRecord = await db
      .select()
      .from(extensionApiKeys)
      .where(eq(extensionApiKeys.id, Number(keyId)))
      .limit(1);

    if (keyRecord.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Key not found' },
        { status: 404 }
      );
    }

    const key = keyRecord[0];

    // 检查是否启用
    if (!key.isActive) {
      return NextResponse.json({
        success: false,
        error: 'Key is disabled',
        data: {
          keyId: key.id,
          status: 'disabled',
        },
      });
    }

    // 检查是否过期
    const now = new Date();
    const expiresAt = key.expiresAt ? new Date(key.expiresAt) : null;
    if (expiresAt && expiresAt < now) {
      return NextResponse.json({
        success: false,
        error: 'Key has expired',
        data: {
          keyId: key.id,
          status: 'expired',
          expiredAt: expiresAt.toISOString(),
        },
      });
    }

    // 更新最后使用时间
    await db
      .update(extensionApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(extensionApiKeys.id, key.id));

    // 返回成功
    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      data: {
        keyId: key.id,
        shopId: key.shopId,
        userId: key.userId,
        permissions: key.permissions || [],
        status: 'active',
        lastUsedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Test auth error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
