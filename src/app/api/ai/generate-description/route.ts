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
    const title = productInfo.title || productInfo.productTitle || "";
    const categoryPath = productInfo.categoryPath || productInfo.category || "";
    const features = productInfo.features || productInfo.characteristics || "";
    const existingKeywords = keywords?.join(", ") || "";

    const prompt = `你是一个专业的Ozon电商描述撰写专家。请根据以下信息生成高质量的商品描述。

商品信息：
- 商品标题：${title}
- 类目路径：${categoryPath}
- 商品特征：${features}
- 相关关键词：${existingKeywords}

要求：
1. 描述长度200-500字符（俄语）
2. 分为2-3个段落，结构清晰
3. 包含商品核心卖点、使用场景、规格参数
4. 自然融入关键词，提升搜索排名
5. 使用HTML标签（<p>、<li>）格式化

请直接返回HTML格式的描述，不要解释。`;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: "你是一个专业的电商描述撰写专家，擅长生成符合平台规范的高转化商品描述。" },
      { role: "user", content: prompt }
    ];

    const response = await (client as any).invoke(messages);

    const description = response.content?.trim() || response.toString();

    return NextResponse.json({
      success: true,
      data: {
        description,
        tips: [
          "描述前100字符最重要，确保核心卖点突出",
          "使用项目符号列表提升可读性",
          "避免夸大宣传，确保描述与实际商品一致"
        ]
      }
    });
  } catch (error: any) {
    console.error("描述生成错误:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "生成失败"
    }, { status: 500 });
  }
}
