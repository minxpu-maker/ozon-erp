/**
 * 店铺凭证 API（解密返回，仅供 Chrome 插件 relay 使用）
 * GET /api/shops/[id]/credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1);

    if (!shop) {
      return NextResponse.json({ success: false, error: '店铺不存在' }, { status: 404 });
    }

    const ozonClientId = (shop as Record<string, unknown>).clientId as string || null;
    let ozonApiKey: string | null = null;

    // 解密 API Key（兼容新旧字段名）
    const rawApiKey = (shop as Record<string, unknown>).apiKey as string | null;
    const rawOzonApiKey = (shop as Record<string, unknown>).ozonApiKey as string | null;
    if (rawApiKey) {
      try { ozonApiKey = decrypt(rawApiKey); } catch { ozonApiKey = null; }
    }
    if (!ozonApiKey && rawOzonApiKey) {
      try { ozonApiKey = decrypt(rawOzonApiKey); } catch { ozonApiKey = null; }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: shop.id,
        shopName: shop.name,
        ozonClientId: ozonClientId,
        ozonApiKey,
      },
    });
  } catch (error) {
    console.error('[Credentials] Error:', error);
    return NextResponse.json({ success: false, error: '获取凭证失败' }, { status: 500 });
  }
}
