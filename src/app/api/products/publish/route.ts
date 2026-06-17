import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { collectionItems, marketSignals, shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

const OZON_API_BASE = 'https://api-seller.ozon.ru';

/**
 * POST /api/products/publish
 * 发布商品到Ozon
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collectionItemId } = body;
    
    if (!collectionItemId) {
      return NextResponse.json(
        { success: false, error: '缺少collectionItemId' },
        { status: 400 }
      );
    }
    
    // 获取采集箱条目及其关联的信号数据
    const [item] = await db
      .select({
        id: collectionItems.id,
        status: collectionItems.status,
        shopId: collectionItems.shopId,
        editedData: collectionItems.editedData,
        signal: marketSignals,
      })
      .from(collectionItems)
      .leftJoin(marketSignals, eq(collectionItems.signalId, marketSignals.id))
      .where(eq(collectionItems.id, collectionItemId))
      .limit(1);
    
    if (!item) {
      return NextResponse.json(
        { success: false, error: '采集箱条目不存在' },
        { status: 404 }
      );
    }
    
    if (item.status !== 'claimed') {
      return NextResponse.json(
        { success: false, error: '只有已认领的条目才能发布' },
        { status: 400 }
      );
    }
    
    // 获取店铺的API凭证
    const [shop] = await db
      .select({
        id: shops.id,
        clientId: shops.clientId,
        apiKey: shops.apiKey,
        ozonClientId: shops.ozonClientId,
        ozonApiKey: shops.ozonApiKey,
      })
      .from(shops)
      .where(eq(shops.id, item.shopId || ''))
      .limit(1);
    
    if (!shop) {
      return NextResponse.json(
        { success: false, error: '店铺不存在或未配置API凭证' },
        { status: 400 }
      );
    }
    
    const clientId = shop.ozonClientId || shop.clientId;
    const apiKey = shop.ozonApiKey || shop.apiKey;
    
    if (!clientId || !apiKey) {
      return NextResponse.json(
        { success: false, error: '店铺API凭证未配置' },
        { status: 400 }
      );
    }
    
    // 合并原始数据和编辑数据
    const signal = item.signal;
    const editedData = (item.editedData || {}) as Record<string, unknown>;
    
    const productName = (editedData.title as string) || signal?.productTitle || 'Unknown Product';
    const price = (editedData.price as number) || Number(signal?.price) || 0;
    const weight = (editedData.weight as number) || Number(signal?.weight) || 100;
    const description = (editedData.description as string) || '';
    
    // 构建Ozon API请求体
    const ozonRequest = {
      items: [
        {
          offer_id: signal?.productId || `item_${item.id}`,
          name: productName,
          price: price,
          vat: 0, // 增值税，0表示不含税
          weight: weight / 1000, // Ozon要求kg
          dimensions: {
            length: Number(signal?.dimensionLength) || 10,
            width: Number(signal?.dimensionWidth) || 10,
            height: Number(signal?.dimensionHeight) || 10,
          },
          description: description,
          category_id: signal?.categoryId || '',
          // 其他可选字段...
        },
      ],
    };
    
    // 调用Ozon API
    const ozonResponse = await fetch(`${OZON_API_BASE}/v3/product/import`, {
      method: 'POST',
      headers: {
        'Client-Id': clientId,
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ozonRequest),
    });
    
    const ozonResult = await ozonResponse.json();
    
    if (!ozonResponse.ok) {
      // 更新状态为rejected
      await db
        .update(collectionItems)
        .set({
          status: 'rejected',
          publishStatus: 'rejected',
          publishError: JSON.stringify(ozonResult),
          updatedAt: new Date(),
        })
        .where(eq(collectionItems.id, collectionItemId));
      
      return NextResponse.json(
        { success: false, error: 'Ozon API调用失败', details: ozonResult },
        { status: 500 }
      );
    }
    
    // 更新状态为published
    const taskId = ozonResult?.result?.task_id;
    await db
      .update(collectionItems)
      .set({
        status: 'published',
        publishStatus: 'pending_review',
        ozonTaskId: taskId ? String(taskId) : null,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(collectionItems.id, collectionItemId));
    
    return NextResponse.json({
      success: true,
      data: {
        taskId,
        message: '商品已提交到Ozon，待审核',
      },
    });
  } catch (error) {
    console.error('发布到Ozon失败:', error);
    return NextResponse.json(
      { success: false, error: '发布失败' },
      { status: 500 }
    );
  }
}
