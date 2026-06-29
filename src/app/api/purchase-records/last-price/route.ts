import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseRecords, purchaseDemands } from '@/storage/database/shared/fulfillment';
import { eq, and, ne, desc } from 'drizzle-orm';

/**
 * GET - 查询 SKU 的最近采购价
 * 用于 Drawer 录入表单显示"上次采购价"
 * 
 * Query params:
 * - sku: SKU 编码（必填）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');

    if (!sku) {
      return NextResponse.json(
        { success: false, error: 'sku 参数是必填的' },
        { status: 400 }
      );
    }

    // 查询最近一次该 SKU 的采购记录（排除 cancelled）
    // 通过 purchase_records JOIN purchase_demands（on demandId = purchase_demands.id）
    const result = await db
      .select({
        purchasePrice: purchaseRecords.purchasePrice,
        orderedAt: purchaseRecords.orderedAt,
        supplierName: purchaseRecords.supplierName,
        supplierSource: purchaseRecords.supplierSource,
      })
      .from(purchaseRecords)
      .innerJoin(purchaseDemands, eq(purchaseDemands.id, purchaseRecords.demandId))
      .where(and(
        eq(purchaseDemands.sku, sku),
        ne(purchaseRecords.status, 'cancelled')
      ))
      .orderBy(desc(purchaseRecords.orderedAt))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        purchasePrice: result[0].purchasePrice ? Number(result[0].purchasePrice) : null,
        orderedAt: result[0].orderedAt,
        supplierName: result[0].supplierName,
        supplierSource: result[0].supplierSource,
      },
    });
  } catch (error) {
    console.error('Error fetching last purchase price:', error);
    return NextResponse.json(
      { success: false, error: '获取上次采购价失败' },
      { status: 500 }
    );
  }
}