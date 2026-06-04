import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { systemConfigs } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

// 默认汇率配置
const DEFAULT_CONFIGS = {
  'rub_to_cny': '0.08',  // 1卢布 = 0.08人民币
  'rub_to_cny_updated_at': new Date().toISOString(),
};

// GET /api/system-config - 获取系统配置
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (key) {
      // 获取单个配置
      const result = await db
        .select()
        .from(systemConfigs)
        .where(eq(systemConfigs.key, key))
        .limit(1);

      if (result.length > 0) {
        return NextResponse.json({ success: true, data: result[0] });
      }

      // 返回默认值
      if (DEFAULT_CONFIGS[key as keyof typeof DEFAULT_CONFIGS]) {
        return NextResponse.json({
          success: true,
          data: {
            key,
            value: DEFAULT_CONFIGS[key as keyof typeof DEFAULT_CONFIGS],
            description: '默认值',
          },
        });
      }

      return NextResponse.json({ success: false, error: '配置不存在' }, { status: 404 });
    }

    // 获取所有配置
    const configs = await db.select().from(systemConfigs);

    // 合并默认配置
    const allConfigs = { ...DEFAULT_CONFIGS };
    for (const config of configs) {
      allConfigs[config.key as keyof typeof allConfigs] = config.value;
    }

    return NextResponse.json({ success: true, data: allConfigs });
  } catch (error) {
    console.error('获取系统配置失败:', error);
    return NextResponse.json({ success: false, error: '获取系统配置失败' }, { status: 500 });
  }
}

// POST /api/system-config - 更新系统配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, description } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
    }

    // 检查配置是否存在
    const existing = await db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.key, key))
      .limit(1);

    if (existing.length > 0) {
      // 更新
      await db
        .update(systemConfigs)
        .set({ value, description, updated_at: new Date() })
        .where(eq(systemConfigs.key, key));
    } else {
      // 新增
      await db.insert(systemConfigs).values({
        key,
        value,
        description,
      });
    }

    return NextResponse.json({ success: true, message: '配置更新成功' });
  } catch (error) {
    console.error('更新系统配置失败:', error);
    return NextResponse.json({ success: false, error: '更新系统配置失败' }, { status: 500 });
  }
}
