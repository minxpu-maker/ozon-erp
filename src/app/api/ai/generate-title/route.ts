import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config } from "coze-coding-dev-sdk";

const config = new Config();
const client = new LLMClient(config);

export async function POST(request: NextRequest) {
  try {
    const { productInfo, keywords } = await request.json();

    if (!productInfo) {
      return NextResponse.json({
        success: false,
        error: "缺少商品信息"
      }, { status: 400 });
    }

    // 构建提示词
    const categoryPath = productInfo.categoryPath || productInfo.category || "";
    const brand = productInfo.brand || "";
    const currentTitle = productInfo.title || productInfo.productTitle || "";
    const features = productInfo.features || productInfo.characteristics || "";
    const existingKeywords = keywords?.join(", ") || "";

    const prompt = `你是一个专业的Ozon电商标题优化专家。请根据以下信息生成一个高质量的商品标题。

商品信息：
- 类目路径：${categoryPath}
- 品牌：${brand}
- 当前标题：${currentTitle}
- 商品特征：${features}
- 相关关键词：${existingKeywords}

要求：
1. 标题长度30-200字符（俄语）
2. 包含核心关键词（搜索权重最高）
3. 突出商品卖点（材质、功能、适用人群等）
4. 使用Ozon平台常用的标题格式
5. 避免堆砌关键词，保持可读性

请直接返回标题，不要解释。`;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: "你是一个专业的电商标题优化专家，擅长生成符合平台规范的高转化标题。" },
      { role: "user", content: prompt }
    ];

    const response = await (client as any).invoke(messages);

    const title = response.content?.trim() || response.toString();

    return NextResponse.json({
      success: true,
      data: {
        title,
        tips: [
          "标题前30个字符最重要，确保包含核心关键词",
          "使用阿拉伯数字比俄语数字更醒目",
          "避免使用特殊字符和全大写"
        ]
      }
    });
  } catch (error: any) {
    console.error("标题生成错误:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "生成失败"
    }, { status: 500 });
  }
}
