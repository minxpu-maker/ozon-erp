import { NextRequest, NextResponse } from 'next/server';
import { authenticateExtension, hasPermission } from '@/lib/auth/extension-auth';

/**
 * 测试鉴权中间件的接口
 * GET /api/extension-api-keys/test-auth
 * 
 * 用于验证 API Key 鉴权是否正常工作
 */
export async function GET(request: NextRequest) {
  // 验证 API Key
  const authResult = await authenticateExtension(request);
  
  if (!authResult.success) {
    return NextResponse.json(
      { 
        success: false, 
        error: authResult.error,
        hint: '请确保请求头包含有效的 Authorization: Bearer ozon_ext_xxx'
      },
      { status: authResult.status || 401 }
    );
  }
  
  // 检查权限示例
  const canReadSignals = hasPermission(authResult.permissions!, 'read:signals');
  const canWriteSignals = hasPermission(authResult.permissions!, 'write:signals');
  const canReadOpportunities = hasPermission(authResult.permissions!, 'read:opportunities');
  
  return NextResponse.json({
    success: true,
    message: '鉴权成功',
    data: {
      shopId: authResult.shopId,
      userId: authResult.userId,
      permissions: authResult.permissions,
      permissionCheck: {
        'read:signals': canReadSignals,
        'write:signals': canWriteSignals,
        'read:opportunities': canReadOpportunities,
      }
    }
  });
}
