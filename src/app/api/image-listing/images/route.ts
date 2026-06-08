import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { desc, eq, and } from 'drizzle-orm';

// GET /api/image-listing/images - 获取图片列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productCardId = searchParams.get('productCardId');
    const complianceStatus = searchParams.get('complianceStatus');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const conditions = [];
    if (productCardId) conditions.push(eq(schema.imageSets.productCardId, parseInt(productCardId)));
    if (complianceStatus) conditions.push(eq(schema.imageSets.status, complianceStatus));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db.select()
      .from(schema.imageSets)
      .where(whereClause)
      .orderBy(desc(schema.imageSets.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('[API] 获取图片列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取图片列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/image-listing/images - 上传图片
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const productCardId = formData.get('productCardId');
    const file = formData.get('file') as File;

    if (!productCardId || !file) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: productCardId, file' },
        { status: 400 }
      );
    }

    // TODO: 上传到S3
    // const s3Key = await uploadToS3(file);
    const s3Key = `images/${Date.now()}_${file.name}`;

    // 写入image_sets表
    const [imageSet] = await db.insert(schema.imageSets)
      .values({
        productCardId: parseInt(productCardId as string),
        variantId: null,
        originalImages: [{ key: s3Key, name: file.name, size: file.size, type: file.type }],
        processedImages: null,
        primaryImageIndex: 0,
        templateId: null,
        aiEditProvider: null,
        aiEditParams: null,
        complianceChecks: null,
        status: 'created',
        reviewerId: null,
        reviewedAt: null,
        rejectReason: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // TODO: 调用合规检查（第八步实现）

    return NextResponse.json({
      success: true,
      data: imageSet
    });
  } catch (error) {
    console.error('[API] 上传图片失败:', error);
    return NextResponse.json(
      { success: false, error: '上传图片失败' },
      { status: 500 }
    );
  }
}
