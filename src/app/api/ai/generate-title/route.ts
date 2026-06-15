import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { pool } from '@/storage/database/client';

interface GenerateTitleRequest {
  sourceTitle: string;
  category?: string;
  language?: string;
  style?: 'seo' | 'natural';
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateTitleRequest = await request.json();
    const { sourceTitle, category, language = 'ru', style = 'seo' } = body;

    if (!sourceTitle) {
      return NextResponse.json(
        { error: 'sourceTitle is required' },
        { status: 400 }
      );
    }

    const config = new Config();
    const client = new LLMClient(config);
    const model = 'doubao-seed-2-0-lite-260215';

    // 构建俄语提示词
    const prompt = `Вы аналитик электронной коммерции. Сгенерируйте 3 варианта заголовков для товара.

Оригинальный заголовок: ${sourceTitle}
${category ? `Категория товара: ${category}` : ''}
Язык: ${language === 'ru' ? 'Русский' : language === 'en' ? 'Английский' : language}
Стиль: ${style === 'seo' ? 'SEO-оптимизированный (с ключевыми словами)' : 'Естественный (читабельный)'}

Требования:
1. Каждый заголовок должен содержать ключевые слова для поисковой оптимизации
2. Заголовок должен быть привлекательным для покупателей
3. Длина: 60-120 символов
4. Формат: вернуть 3 заголовка в формате JSON: {"titles": ["заголовок1", "заголовок2", "заголовок3"], "keywords": ["ключевое слово1", "ключевое слово2", ...]}

Верните ТОЛЬКО JSON, без дополнительного текста.`;

    const response = await client.invoke(
      [{ role: 'user', content: prompt }],
      { model, temperature: 0.8 }
    );

    const text = response.content || '';

    // 解析JSON响应
    let result = { titles: [] as string[], keywords: [] as string[] };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        result = {
          titles: parsed.titles || [],
          keywords: parsed.keywords || [],
        };
      }
    } catch {
      const lines = text.split('\n').filter(line => line.trim());
      result.titles = lines.slice(0, 3).map(line => line.replace(/^["\d.]+/, '').trim());
    }

    // 确保返回3个标题
    while (result.titles.length < 3) {
      result.titles.push(sourceTitle);
    }

    // 记录到日志
    try {
      await pool.query(
        `INSERT INTO ai_generation_logs (type, input, output, model) 
         VALUES ($1, $2, $3, $4)`,
        ['title', JSON.stringify(body), JSON.stringify(result), model]
      );
    } catch (logError) {
      console.error('Failed to log AI generation:', logError);
    }

    return NextResponse.json({
      titles: result.titles.slice(0, 3),
      keywords: result.keywords.slice(0, 10),
    });

  } catch (error) {
    console.error('Generate title error:', error);
    return NextResponse.json(
      { error: 'Failed to generate titles', details: String(error) },
      { status: 500 }
    );
  }
}
