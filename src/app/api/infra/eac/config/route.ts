import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';

// GET /api/infra/eac/config - 获取EAC配置
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sellerType = searchParams.get('sellerType');

    const conditions = [];
    if (sellerType) conditions.push(eq(schema.eacConfig.sellerType, sellerType));

    const configs = await db.select()
      .from(schema.eacConfig)
      .where(conditions.length > 0 ? eq(schema.eacConfig.sellerType, sellerType!) : undefined);

    return NextResponse.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('[API] 获取EAC配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取EAC配置失败' },
      { status: 500 }
    );
  }
}

// POST /api/infra/eac/config - 更新EAC配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sellerType, policy, updatedBy } = body;

    if (!sellerType || !policy) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: sellerType, policy' },
        { status: 400 }
      );
    }

    const validPolicies = ['warning', 'veto', 'none'];
    if (!validPolicies.includes(policy)) {
      return NextResponse.json(
        { success: false, error: `policy 必须是: ${validPolicies.join(', ')}` },
        { status: 400 }
      );
    }

    const [config] = await db.insert(schema.eacConfig)
      .values({
        sellerType,
        policy,
        updatedAt: new Date(),
        updatedBy: updatedBy || 'system'
      })
      .onConflictDoUpdate({
        target: [schema.eacConfig.sellerType],
        set: {
          policy,
          updatedAt: new Date(),
          updatedBy: updatedBy || 'system'
        }
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('[API] 更新EAC配置失败:', error);
    return NextResponse.json(
      { success: false, error: '更新EAC配置失败' },
      { status: 500 }
    );
  }
}
