import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { marketSignals } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

/**
 * 翻译文本
 * 
 * 当前使用 placeholder 实现，返回 `[翻译] ${原文}`
 * 
 * TODO: 后续接入真实翻译API，推荐两种方案：
 * 
 * 方案A - 使用项目已有的 LLM API（如 GPT-4o-mini）:
 * ```
 * import { generateText } from 'ai';
 * const result = await generateText({
 *   model: 'gpt-4o-mini',
 *   prompt: `将以下${fromLang}翻译为${toLang}，只返回翻译结果，不要解释：\n${text}`
 * });
 * return result.text;
 * ```
 * 
 * 方案B - 使用翻译专用 API（Google Translate / DeepL）:
 * ```
 * // Google Translate API
 * const response = await fetch(
 *   `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
 *   {
 *     method: 'POST',
 *     body: JSON.stringify({
 *       q: text,
 *       source: from,
 *       target: to,
 *       format: 'text'
 *     })
 *   }
 * );
 * const data = await response.json();
 * return data.data.translations[0].translatedText;
 * ```
 * 
 * 方案B 成本更低，适合大量翻译场景
 */
async function translateText(
  text: string,
  from: string,
  to: string
): Promise<string | null> {
  try {
    // Placeholder 实现：返回带前缀的原文
    // 后续替换为真实翻译 API 调用
    const fromLang = from === 'ru' ? '俄语' : from;
    const toLang = to === 'zh' ? '中文' : to;
    
    // 模拟翻译延迟（实际API调用时会有网络延迟）
    // await new Promise(resolve => setTimeout(resolve, 100));
    
    // Placeholder 结果
    return `[翻译${fromLang}→${toLang}] ${text}`;
  } catch (error) {
    console.error('Translation error:', error);
    return null;
  }
}

/**
 * POST /api/translate
 * 
 * 翻译市场信号的标题
 * 
 * Request Body:
 * - signalId: 市场信号ID
 * - text: 待翻译文本
 * - from: 源语言（如 'ru'）
 * - to: 目标语言（如 'zh'）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signalId, text, from = 'ru', to = 'zh' } = body;

    // 参数校验
    if (!signalId || typeof signalId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'signalId is required and must be a number' },
        { status: 400 }
      );
    }

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'text is required and must be a string' },
        { status: 400 }
      );
    }

    // 检查信号是否存在
    const existingSignal = await db
      .select({ 
        id: marketSignals.id, 
        productTitle: marketSignals.productTitle,
        productTitleZh: marketSignals.productTitleZh 
      })
      .from(marketSignals)
      .where(eq(marketSignals.id, signalId))
      .limit(1);

    if (existingSignal.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Signal not found' },
        { status: 404 }
      );
    }

    // 幂等性检查：已有翻译且非强制更新时跳过
    const forceUpdate = body.force === true;
    if (existingSignal[0].productTitleZh && !forceUpdate) {
      return NextResponse.json({
        success: true,
        signalId,
        translatedText: existingSignal[0].productTitleZh,
        originalText: text,
        cached: true,
        message: 'Translation already exists, skipped. Use force=true to override.'
      });
    }

    // 执行翻译
    const translatedText = await translateText(text, from, to);

    if (translatedText === null) {
      // 翻译失败，不更新数据库，返回错误但不阻塞
      return NextResponse.json({
        success: false,
        signalId,
        translatedText: null,
        error: 'Translation failed'
      });
    }

    // 更新数据库
    await db
      .update(marketSignals)
      .set({
        productTitleZh: translatedText,
        updatedAt: new Date()
      })
      .where(eq(marketSignals.id, signalId));

    console.log(`[Translate] Signal ${signalId}: "${text}" → "${translatedText}"`);

    return NextResponse.json({
      success: true,
      signalId,
      translatedText,
      originalText: text
    });

  } catch (error) {
    console.error('Translate API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
