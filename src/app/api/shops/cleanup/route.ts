/**
 * 店铺清理 API
 * DELETE /api/shops/cleanup
 * 清理不属于前端显示范围的店铺数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq, and, ne, or } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * DELETE /api/shops/cleanup
 * 物理删除不显示的店铺（isActive=false 或 platform 非 ozon）
 */
export async function DELETE(request: NextRequest) {
  try {
    // 查询将被删除的店铺
    const toDelete = await db
      .select({ id: shops.id, name: shops.name, platform: shops.platform, isActive: shops.isActive })
      .from(shops)
      .where(
        or(
          eq(shops.isActive, false),
          ne(shops.platform, 'ozon')
        )
      );

    if (toDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要清理的店铺',
        deleted: 0,
      });
    }

    // 获取要删除的店铺ID
    const idsToDelete = toDelete.map(s => s.id);
    
    // 构建 IN 子句的ID列表
    const idsInClause = idsToDelete.map(id => `'${id}'`).join(', ');
    
    // 禁用外键约束并执行删除
    await db.execute(sql.raw(`SET CONSTRAINTS ALL DEFERRED`));
    
    // 按依赖顺序删除关联数据
    await db.execute(sql.raw(`DELETE FROM selection_retrospectives WHERE shop_id IN (${idsInClause})`));
    await db.execute(sql.raw(`DELETE FROM product_cards WHERE shop_id IN (${idsInClause})`));
    await db.execute(sql.raw(`DELETE FROM opportunities WHERE shop_id IN (${idsInClause})`));
    await db.execute(sql.raw(`DELETE FROM extension_api_keys WHERE shop_id IN (${idsInClause})`));
    await db.execute(sql.raw(`DELETE FROM market_signals WHERE shop_id IN (${idsInClause})`));
    await db.execute(sql.raw(`DELETE FROM order_sync_logs WHERE shop_id IN (${idsInClause})`));
    await db.execute(sql.raw(`DELETE FROM order_finance WHERE order_id IN (SELECT id FROM orders WHERE shop_id IN (${idsInClause}))`));
    await db.execute(sql.raw(`DELETE FROM orders WHERE shop_id IN (${idsInClause})`));
    await db.execute(sql.raw(`DELETE FROM selection_strategy_templates WHERE shop_id IN (${idsInClause})`));
    // 最后删除店铺
    await db.execute(sql.raw(`DELETE FROM shops WHERE id IN (${idsInClause})`));

    return NextResponse.json({
      success: true,
      message: `已清理 ${toDelete.length} 个店铺`,
      deleted: toDelete.length,
      cleanedShops: toDelete,
    });
  } catch (error) {
    console.error('[Shops Cleanup API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '清理店铺失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/shops/cleanup
 * 查询将被清理的店铺列表（不执行删除）
 */
export async function GET() {
  try {
    // 查询将被删除的店铺
    const toDelete = await db
      .select({ id: shops.id, name: shops.name, platform: shops.platform, isActive: shops.isActive })
      .from(shops)
      .where(
        or(
          eq(shops.isActive, false),
          ne(shops.platform, 'ozon')
        )
      );

    // 查询当前有效店铺
    const validShops = await db
      .select({ id: shops.id, name: shops.name })
      .from(shops)
      .where(
        and(
          eq(shops.isActive, true),
          eq(shops.platform, 'ozon')
        )
      );

    return NextResponse.json({
      success: true,
      validShops: validShops,
      invalidShops: toDelete,
      total: validShops.length,
      toClean: toDelete.length,
    });
  } catch (error) {
    console.error('[Shops Cleanup API] GET error:', error);
    return NextResponse.json(
      { success: false, error: '查询清理信息失败' },
      { status: 500 }
    );
  }
}
