import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { pool } from '@/storage/database/client';

interface GenerateKeywordsRequest {
  title: string;
  category?: string;
  language?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateKeywordsRequest = await request.json();
    const { title, category, language = 'ru' } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    const config = new Config();
    const client = new LLMClient(config);
    const model = 'doubao-seed-2-0-lite-260215';

    // 构建俄语提示词
    const prompt = `Вы SEO-специалист для маркетплейса Ozon. 
Сгенерируйте список релевантных ключевых слов для товара.

Название товара: ${title}
${category ? `Категория: ${category}` : ''}
Язык: ${language === 'ru' ? 'Русский' : language === 'en' ? 'Английский' : language}

Требования:
1. Сгенерируйте 15-20 ключевых слов
2. Включите общие и специфичные термины
3. Включите синонимы и варианты написания
4. Добавьте бренды и характеристики если применимо
5. Упорядочьте по релевантности
6. Формат: вернуть JSON {"keywords": ["слово1", "слово2", ...]}

Верните ТОЛЬКО JSON, без дополнительного текста.`;

    const response = await client.invoke(
      [{ role: 'user', content: prompt }],
      { model, temperature: 0.6 }
    );

    const text = response.content || '';

    // 解析JSON响应
    let keywords: string[] = [];
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        keywords = parsed.keywords || [];
      }
    } catch {
      // 按行解析
      keywords = text.split(/[,\n]/)
        .map(k => k.trim().replace(/^["\d.]+/, ''))
        .filter(k => k.length > 2);
    }

    // 确保返回关键词
    if (keywords.length === 0) {
      keywords = ['товар', 'купить', 'цена', 'качество', 'доставка'];
    }

    // 记录到日志
    try {
      await pool.query(
        `INSERT INTO ai_generation_logs (type, input, output, model) 
         VALUES ($1, $2, $3, $4)`,
        ['keywords', JSON.stringify(body), JSON.stringify({ keywords }), model]
      );
    } catch (logError) {
      console.error('Failed to log AI generation:', logError);
    }

    return NextResponse.json({ keywords: keywords.slice(0, 20) });

  } catch (error) {
    console.error('Generate keywords error:', error);
    return NextResponse.json(
      { error: 'Failed to generate keywords', details: String(error) },
      { status: 500 }
    );
  }
}
