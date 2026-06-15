import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm/client';

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage = 'ru', sourceLanguage = 'zh' } = await request.json();

    if (!text) {
      return NextResponse.json({ error: '缺少翻译文本' }, { status: 400 });
    }

    const prompt = `请将以下文本从${sourceLanguage === 'zh' ? '中文' : sourceLanguage}翻译成${targetLanguage === 'ru' ? '俄语' : targetLanguage}。

仅返回翻译结果，不要解释或添加其他内容。保持原文的风格和格式。

原文：
${text}`;

    const result = await callLLM({
      model: process.env.LLM_MODEL || 'doubao-seed-2-0-pro-260215',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    return NextResponse.json({
      success: true,
      data: {
        original: text,
        translated: result,
        sourceLanguage,
        targetLanguage,
      },
    });
  } catch (error) {
    console.error('翻译失败:', error);
    return NextResponse.json(
      { error: '翻译失败', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
