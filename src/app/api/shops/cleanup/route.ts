import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq, or, ne } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // 查询无效店铺（不在前端显示的）
    const invalidShopsList = await db
      .select({
        id: shops.id,
        name: shops.name,
        platform: shops.platform,
        isActive: shops.isActive,
      })
      .from(shops)
      .where(
        or(
          eq(shops.isActive, false),
          ne(shops.platform, 'ozon')
        )
      );

    const validShopsList = await db
      .select({ id: shops.id, name: shops.name })
      .from(shops)
      .where(
        eq(shops.isActive, true)
      );

    return NextResponse.json({
      success: true,
      validShops: validShopsList,
      invalidShops: invalidShopsList,
      total: validShopsList.length,
      toClean: invalidShopsList.length,
    });
  } catch (error) {
    console.error('[cleanup] GET error:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    // 查询无效店铺
    const invalidShopsList = await db
      .select({ id: shops.id, name: shops.name })
      .from(shops)
      .where(
        or(
          eq(shops.isActive, false),
          ne(shops.platform, 'ozon')
        )
      );

    if (invalidShopsList.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要清理的店铺',
        deletedCount: 0,
      });
    }

    const invalidIds = invalidShopsList.map(s => s.id);
    const idsPlaceholder = invalidIds.map((_, i) => `$${i + 1}`).join(', ');

    // 按依赖顺序删除关联数据（从最底层到最顶层）
    await db.execute(sql`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE shop_id IN (${sql.raw(idsPlaceholder)}))`);
    await db.execute(sql`DELETE FROM orders WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM order_finance WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM order_sync_logs WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM purchase_tasks WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM purchase_demands WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM purchase_records WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM qc_records WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM shipment_records WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM selection_retrospectives WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM selection_strategy_templates WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM opportunities WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM product_cards WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM product_groups WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM product_monitor WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM monitor_items WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM monitor_keyword_rankings WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM monitor_shop WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM monitor_snapshots WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM keyword_library WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM keyword_reverse WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM market_signals WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM policy_change_events WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM extension_api_keys WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    await db.execute(sql`DELETE FROM ozon_orders WHERE shop_id IN (${sql.raw(idsPlaceholder)})`);
    
    // 最后删除店铺
    await db.execute(sql`DELETE FROM shops WHERE id IN (${sql.raw(idsPlaceholder)})`);

    return NextResponse.json({
      success: true,
      message: `成功清理 ${invalidShopsList.length} 个无效店铺及其所有关联数据`,
      deletedShops: invalidShopsList,
      deletedCount: invalidShopsList.length,
    });
  } catch (error) {
    console.error('[cleanup] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '清理失败', details: String(error) },
      { status: 500 }
    );
  }
}
