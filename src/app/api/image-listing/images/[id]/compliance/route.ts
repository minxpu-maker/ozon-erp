import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/image-listing/images/[id]/compliance - 触发图片合规检查
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // TODO: 第八步接入真实合规检查逻辑
    // 现在返回模拟的通过结果

    const complianceResult = {
      imageId: parseInt(id),
      checkedAt: new Date().toISOString(),
      overall: 'pass',
      checks: [
        { name: '尺寸合规', status: 'pass', message: '图片尺寸符合Ozon要求' },
        { name: '格式合规', status: 'pass', message: '图片格式为JPG/PNG' },
        { name: '分辨率', status: 'pass', message: '分辨率不低于1000x1000' },
        { name: '水印检测', status: 'pass', message: '未检测到水印' },
        { name: '文字检测', status: 'pass', message: '未检测到违规文字' },
        { name: '品牌Logo', status: 'pass', message: '未检测到侵权Logo' },
        { name: '背景要求', status: 'pass', message: '背景符合要求' },
        { name: '质量评分', status: 'pass', message: '图片质量评分85分' }
      ]
    };

    return NextResponse.json({
      success: true,
      data: complianceResult
    });
  } catch (error) {
    console.error('[API] 合规检查失败:', error);
    return NextResponse.json(
      { success: false, error: '合规检查失败' },
      { status: 500 }
    );
  }
}
