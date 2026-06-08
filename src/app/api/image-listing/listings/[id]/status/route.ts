import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';
import { getImportInfo } from '@/lib/ozon';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/image-listing/listings/[id]/status - 查询Ozon审核状态
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 获取上架任务
    const [task] = await db.select()
      .from(schema.listingTasks)
      .where(eq(schema.listingTasks.id, parseInt(id)));

    if (!task) {
      return NextResponse.json(
        { success: false, error: '上架任务不存在' },
        { status: 404 }
      );
    }

    if (!task.ozonTaskId) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'not_submitted',
          message: '尚未提交到Ozon'
        }
      });
    }

    // 查询Ozon审核状态
    const importInfo = await getImportInfo(task.shopId, task.ozonTaskId);

    // 更新任务状态
    if (importInfo.status === 'completed') {
      const allSuccess = importInfo.items.every(item => item.status === 'imported');
      
      await db.update(schema.listingTasks)
        .set({
          status: allSuccess ? 'approved' : 'failed',
          resultMessage: JSON.stringify(importInfo.items),
          updatedAt: new Date()
        })
        .where(eq(schema.listingTasks.id, parseInt(id)));
    }

    return NextResponse.json({
      success: true,
      data: {
        status: importInfo.status,
        items: importInfo.items
      }
    });
  } catch (error) {
    console.error('[API] 查询审核状态失败:', error);
    return NextResponse.json(
      { success: false, error: '查询审核状态失败' },
      { status: 500 }
    );
  }
}
