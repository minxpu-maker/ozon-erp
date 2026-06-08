import { NextRequest, NextResponse } from 'next/server';

interface OzonAttribute {
  attribute_id: number;
  attribute_name: string;
  description?: string;
  type: string;
  required: boolean;
  dictionary?: { id: number; value: string }[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryId } = await params;

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: '缺少类目ID' },
        { status: 400 }
      );
    }

    // Try to load from cache first
    const cacheKey = `category_attrs_${categoryId}`;
    
    // For now, return mock data since we need to call Ozon API
    // In production, this would call the Ozon getCategoryAttributes API
    const mockAttributes: OzonAttribute[] = [
      {
        attribute_id: 1,
        attribute_name: '品牌',
        type: 'text',
        required: true,
        description: '商品品牌名称',
      },
      {
        attribute_id: 2,
        attribute_name: '材质',
        type: 'select',
        required: true,
        dictionary: [
          { id: 1, value: '棉' },
          { id: 2, value: '涤纶' },
          { id: 3, value: '尼龙' },
          { id: 4, value: '丝绸' },
          { id: 5, value: '羊毛' },
          { id: 6, value: '混纺' },
        ],
      },
      {
        attribute_id: 3,
        attribute_name: '颜色',
        type: 'multiselect',
        required: false,
        dictionary: [
          { id: 1, value: '黑色' },
          { id: 2, value: '白色' },
          { id: 3, value: '红色' },
          { id: 4, value: '蓝色' },
          { id: 5, value: '绿色' },
          { id: 6, value: '黄色' },
          { id: 7, value: '灰色' },
          { id: 8, value: '粉色' },
        ],
      },
      {
        attribute_id: 4,
        attribute_name: '尺码',
        type: 'multiselect',
        required: false,
        dictionary: [
          { id: 1, value: 'XS' },
          { id: 2, value: 'S' },
          { id: 3, value: 'M' },
          { id: 4, value: 'L' },
          { id: 5, value: 'XL' },
          { id: 6, value: 'XXL' },
          { id: 7, value: 'XXXL' },
        ],
      },
      {
        attribute_id: 5,
        attribute_name: '重量(kg)',
        type: 'number',
        required: false,
        description: '商品净重',
      },
      {
        attribute_id: 6,
        attribute_name: '产地',
        type: 'select',
        required: false,
        dictionary: [
          { id: 1, value: '中国' },
          { id: 2, value: '俄罗斯' },
          { id: 3, value: '土耳其' },
          { id: 4, value: '越南' },
          { id: 5, value: '印度' },
        ],
      },
      {
        attribute_id: 7,
        attribute_name: '季节',
        type: 'select',
        required: false,
        dictionary: [
          { id: 1, value: '四季通用' },
          { id: 2, value: '春季' },
          { id: 3, value: '夏季' },
          { id: 4, value: '秋季' },
          { id: 5, value: '冬季' },
        ],
      },
      {
        attribute_id: 8,
        attribute_name: '风格',
        type: 'select',
        required: false,
        dictionary: [
          { id: 1, value: '休闲' },
          { id: 2, value: '商务' },
          { id: 3, value: '运动' },
          { id: 4, value: '时尚' },
          { id: 5, value: '简约' },
        ],
      },
    ];

    // In real implementation, we would:
    // 1. Check cache table for this category's attributes
    // 2. If not cached, call Ozon API getCategoryAttributes
    // 3. Store in cache and return

    return NextResponse.json({
      success: true,
      data: mockAttributes,
      meta: {
        categoryId,
        cached: false,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching category attributes:', error);
    return NextResponse.json(
      { success: false, error: '获取类目属性失败' },
      { status: 500 }
    );
  }
}
