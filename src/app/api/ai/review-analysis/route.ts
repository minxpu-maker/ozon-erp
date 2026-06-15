import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config } from "coze-coding-dev-sdk";

const config = new Config();
const client = new LLMClient(config);

export async function POST(request: NextRequest) {
  try {
    const { reviews, productTitle } = await request.json();

    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return NextResponse.json({
        success: false,
        error: "缺少评论数据"
      }, { status: 400 });
    }

    // 构建提示词
    const reviewsText = reviews.slice(0, 50).map((r: any, i: number) =>
      `${i + 1}. ${r.text || r.content || r.review_text || JSON.stringify(r)}`
    ).join("\n");

    const prompt = `分析以下商品评论，返回JSON格式结果。

商品：${productTitle || "未知商品"}

评论列表：
${reviewsText}

请返回以下JSON格式的分析结果：
{
  "summary": "整体评论摘要（50字以内）",
  "sentiment": {
    "positive": 正面评论数量,
    "neutral": 中性评论数量,
    "negative": 负面评论数量,
    "score": 情感得分(0-100)
  },
  "pros": ["优点1", "优点2", "优点3"],
  "cons": ["缺点1", "缺点2", "缺点3"],
  "keywords": {
    "positive": ["正面关键词1", "正面关键词2"],
    "negative": ["负面关键词1", "负面关键词2"]
  },
  "userProfile": "用户画像描述（30字以内）",
  "suggestions": "改进建议（50字以内）"
}`;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: "你是一个专业的电商评论分析师，擅长从大量评论中提取有价值的信息。" },
      { role: "user", content: prompt }
    ];

    // 使用 invoke 方法
    const response = await (client as any).invoke(messages);

    // 解析JSON响应
    let analysisResult;
    try {
      const content = response.content?.trim() || response;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        analysisResult = { summary: content };
      }
    } catch (parseError) {
      analysisResult = { summary: String(response.content || response) };
    }

    return NextResponse.json({
      success: true,
      data: analysisResult
    });
  } catch (error: any) {
    console.error("评论分析错误:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "分析失败"
    }, { status: 500 });
  }
}
