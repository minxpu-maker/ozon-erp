/**
 * Ozon API 连接测试接口
 * 用于验证 API 配置是否正确
 */
import { NextResponse } from 'next/server';
import { getOzonConfig } from '@/lib/ozon/config';

export async function GET() {
  try {
    const config = getOzonConfig();

    if (!config.clientId || !config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Ozon API 未配置',
        hint: '请在系统设置中配置 Ozon Client ID 和 API Key',
        configured: false,
      });
    }

    // 测试 API 连接 - 调用一个简单的接口验证
    const response = await fetch('https://api-seller.ozon.ru/v2/posting/fbs/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': config.clientId!,
        'Api-Key': config.apiKey!,
      },
      body: JSON.stringify({
        filter: {
          status: 'awaiting_packaging',
        },
        limit: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'API 请求失败';

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        // 解析失败，使用原始文本
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        status: response.status,
        configured: true,
        hint: 'API 密钥可能无效或已过期，请检查配置',
      });
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Ozon API 连接成功',
      configured: true,
      shopInfo: {
        clientId: config.clientId,
        // 返回一些基本信息确认连接成功
        orderCount: data.result?.length || 0,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      configured: false,
      hint: '网络连接失败，请检查网络或稍后重试',
    });
  }
}

/**
 * 保存 Ozon API 配置
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, apiKey, name } = body;

    if (!clientId || !apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Client ID 和 API Key 不能为空',
      });
    }

    // 验证配置是否有效
    const testResponse = await fetch('https://api-seller.ozon.ru/v2/posting/fbs/list', {
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

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      let errorMessage = 'API 验证失败';

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        // 忽略解析错误
      }

      return NextResponse.json({
        success: false,
        error: `配置验证失败: ${errorMessage}`,
      });
    }

    // 配置有效，返回成功
    // 注意：实际保存应该存入数据库，这里只是验证
    return NextResponse.json({
      success: true,
      message: 'Ozon API 配置验证成功',
      shop: {
        name: name || 'Ozon 店铺',
        clientId,
        // 不返回 apiKey，安全考虑
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '配置保存失败',
    });
  }
}
