import { NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

interface KeyStatus {
  shopId: string;
  shopName: string;
  status: 'valid' | 'invalid' | 'error';
  message: string;
  checkedAt: string;
}

/**
 * 批量检测所有店铺的API密钥状态
 * GET /api/shops/key-status
 */
export async function GET() {
  const results: KeyStatus[] = [];
  const checkedAt = new Date().toISOString();

  try {
    // 获取所有活跃店铺的凭证
    const allShops = await db
      .select({
        id: shops.id,
        name: shops.name,
        ozonClientId: shops.ozonClientId,
        ozonApiKey: shops.ozonApiKey,
        clientId: shops.clientId,
        apiKey: shops.apiKey,
      })
      .from(shops)
      .where(eq(shops.isActive, true));

    // 只检测有API密钥的店铺（兼容两种字段命名）
    const shopsWithKeys = allShops.filter(s => 
      (s.ozonClientId && s.ozonApiKey) || (s.clientId && s.apiKey)
    );

    // 并行检测所有店铺的密钥状态
    const statusPromises = shopsWithKeys.map(async (shop) => {
      const result: KeyStatus = {
        shopId: shop.id,
        shopName: shop.name,
        status: 'valid',
        message: '密钥正常',
        checkedAt,
      };

      // 获取实际使用的凭证（优先使用 ozon* 字段，回退到 client/api 字段）
      // 注意：API Key 存储时是加密的，需要解密
      const rawClientId = shop.ozonClientId || shop.clientId;
      let rawApiKey = shop.ozonApiKey || shop.apiKey;
      
      // 解密 API Key（加密格式含冒号）
      if (rawApiKey && rawApiKey.includes(':')) {
        try {
          rawApiKey = decrypt(rawApiKey);
        } catch {
          // 解密失败，尝试作为明文使用
        }
      }

      const actualClientId = rawClientId;
      const actualApiKey = rawApiKey;

      if (!actualClientId || !actualApiKey) {
        result.status = 'error';
        result.message = '缺少API密钥配置';
        return result;
      }

      try {
        // 调用Ozon API检测密钥状态（使用确实存在的endpoint）
        const response = await fetch('https://api-seller.ozon.ru/v3/product/list', {
          method: 'POST',
          headers: {
            'Client-Id': actualClientId,
            'Api-Key': actualApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filter: { category_id: 0 }, limit: 1 }),
        });

        const responseText = await response.text();
        
        // 检查响应体中的业务错误（即使HTTP状态码是200）
        let businessError: string | null = null;
        if (responseText) {
          try {
            const data = JSON.parse(responseText);
            // code > 0 表示业务错误
            if (data.code && data.code > 0) {
              businessError = data.message || `API错误 (code: ${data.code})`;
            }
            // 检查message中的密钥相关错误
            if (data.message) {
              const msgLower = String(data.message).toLowerCase();
              if (msgLower.includes('deactivated') || 
                  (msgLower.includes('invalid') && msgLower.includes('key')) ||
                  msgLower.includes('expired')) {
                businessError = `API密钥无效: ${data.message}`;
              }
            }
          } catch { /* 非JSON */ }
        }
        
        if (response.ok && !businessError) {
          result.status = 'valid';
          result.message = '密钥正常';
        } else if (businessError) {
          // 密钥相关错误
          if (businessError.includes('deactivated') || 
              businessError.includes('invalid') || 
              businessError.includes('expired')) {
            result.status = 'invalid';
            result.message = businessError;
          } else {
            result.status = 'error';
            result.message = businessError;
          }
        } else if (response.status === 401 || response.status === 403) {
          result.status = 'invalid';
          result.message = '密钥已过期或被禁用，请重新生成';
        } else {
          result.status = 'error';
          result.message = `API错误: ${response.status}`;
        }
      } catch (err) {
        result.status = 'error';
        result.message = err instanceof Error ? err.message : '连接失败';
      }

      return result;
    });

    const statuses = await Promise.all(statusPromises);
    results.push(...statuses);

    // 返回检测结果
    const hasInvalid = results.some(r => r.status === 'invalid');
    const hasError = results.some(r => r.status === 'error');

    return NextResponse.json({
      success: true,
      checkedAt,
      summary: {
        total: results.length,
        valid: results.filter(r => r.status === 'valid').length,
        invalid: results.filter(r => r.status === 'invalid').length,
        error: results.filter(r => r.status === 'error').length,
      },
      hasWarning: hasInvalid || hasError,
      shops: results,
    });
  } catch (err) {
    console.error('密钥状态检测失败:', err);
    return NextResponse.json(
      { success: false, error: '检测失败', details: err instanceof Error ? err.message : '未知错误' },
      { status: 500 }
    );
  }
}
