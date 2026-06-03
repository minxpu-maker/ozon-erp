/**
 * Ozon API 配置接口
 * 保存 Ozon API 凭证到环境变量
 */
import { NextResponse } from 'next/server';

/**
 * 获取当前配置状态
 */
export async function GET() {
  const clientId = process.env.OZON_CLIENT_ID;
  const apiKey = process.env.OZON_API_KEY;
  
  return NextResponse.json({
    success: true,
    data: {
      clientId: clientId ? `${clientId.slice(0, 4)}****` : null,
      apiKey: apiKey ? '已配置' : null,
      configured: !!(clientId && apiKey),
    },
  });
}

/**
 * 保存配置（写入 .env.local）
 * 注意：生产环境应通过安全的配置管理服务
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, apiKey } = body;

    if (!clientId || !apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Client ID 和 API Key 不能为空',
      });
    }

    // 在开发环境中，更新 process.env
    // 注意：这只在当前进程中生效，重启后会丢失
    // 生产环境应使用数据库或配置服务
    process.env.OZON_CLIENT_ID = clientId;
    process.env.OZON_API_KEY = apiKey;

    // 同时写入 .env.local 文件以持久化
    const fs = await import('fs');
    const path = await import('path');
    const envPath = path.join(process.cwd(), '.env.local');
    
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // 更新或添加配置
    const updateEnvVar = (content: string, key: string, value: string) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${key}="${value}"`);
      }
      return content + (content.endsWith('\n') ? '' : '\n') + `${key}="${value}"\n`;
    };

    envContent = updateEnvVar(envContent, 'OZON_CLIENT_ID', clientId);
    envContent = updateEnvVar(envContent, 'OZON_API_KEY', apiKey);

    fs.writeFileSync(envPath, envContent);

    return NextResponse.json({
      success: true,
      message: '配置已保存，重启后生效',
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '配置保存失败',
    });
  }
}
