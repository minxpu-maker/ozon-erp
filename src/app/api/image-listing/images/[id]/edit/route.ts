import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/image-listing/images/[id]/edit - AI修图
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { editType, templateId } = body;

    const validEditTypes = [
      'remove_background',    // 去背景
      'white_background',     // 白底图
      'scene_image',          // 场景图
      'size_adapter',         // 尺寸适配
      'enhance',              // 图片增强
      'watermark_remove'      // 去水印
    ];

    if (!editType || !validEditTypes.includes(editType)) {
      return NextResponse.json(
        { success: false, error: `editType 必须是: ${validEditTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // TODO: 第八步接入AI修图API
    // 现在返回模拟结果

    const editResult = {
      imageId: parseInt(id),
      editType,
      templateId: templateId || null,
      status: 'processing',
      message: 'AI修图功能将在第八步实现',
      estimatedTime: '30-60秒',
      originalUrl: `/api/image-listing/images/${id}/original`,
      processedUrl: null // 处理完成后返回新URL
    };

    return NextResponse.json({
      success: true,
      data: editResult
    });
  } catch (error) {
    console.error('[API] AI修图失败:', error);
    return NextResponse.json(
      { success: false, error: 'AI修图失败' },
      { status: 500 }
    );
  }
}
