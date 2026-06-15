import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config } from "coze-coding-dev-sdk";

const config = new Config();
const client = new LLMClient(config);

export async function POST(request: NextRequest) {
  try {
    const { productInfo, existingKeywords } = await request.json();

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
    const existKw = existingKeywords?.join(", ") || "无";

    const prompt = `你是一个专业的Ozon电商关键词优化专家。请根据以下信息生成一组高效的搜索关键词。

商品信息：
- 商品标题：${title}
- 类目路径：${categoryPath}
- 商品特征：${features}
- 已有关键词：${existKw}

要求：
1. 生成10-20个关键词
2. 包含短尾关键词（1-2词，如：рюкзак）
3. 包含长尾关键词（3-5词，如：рюкзак женский кожаный）
4. 包含品牌词（如果有）
5. 包含功能/材质/场景词
6. 已有关键词不要重复

请返回JSON格式的关键词列表：
{
  "keywords": ["关键词1", "关键词2", ...],
  "highPriority": ["高优先级关键词1", ...],
  "reason": "关键词选取理由（50字以内）"
}`;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: "你是一个专业的电商关键词优化专家，擅长从商品信息中提取高效的搜索关键词。" },
      { role: "user", content: prompt }
    ];

    const response = await (client as any).invoke(messages);

    let result;
    try {
      const content = response.content?.trim() || response;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        // 如果解析失败，尝试按行分割返回
        const lines = content.split("\n").filter((l: string) => l.trim());
        result = { keywords: lines.slice(0, 15) };
      }
    } catch (parseError) {
      result = { keywords: response.content?.split("\n").filter((l: string) => l.trim()).slice(0, 15) || [] };
    }

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("关键词生成错误:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "生成失败"
    }, { status: 500 });
  }
}
