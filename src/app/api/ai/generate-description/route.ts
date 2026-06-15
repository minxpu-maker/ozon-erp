import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { pool } from '@/storage/database/client';

interface GenerateDescriptionRequest {
  title: string;
  category?: string;
  features?: string;
  language?: string;
  length?: 'short' | 'medium' | 'long';
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateDescriptionRequest = await request.json();
    const { title, category, features, language = 'ru', length = 'medium' } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    const config = new Config();
    const client = new LLMClient(config);
    const model = 'doubao-seed-2-0-lite-260215';

    // 根据长度设置字数
    const lengthMap = {
      short: '200-300',
      medium: '400-600',
      long: '800-1200'
    };
    const charCount = lengthMap[length];

    // 构建俄语提示词
    const prompt = `Вы эксперт по написанию описаний товаров для маркетплейса Ozon. 
Создайте привлекательное описание товара.

Название товара: ${title}
${category ? `Категория: ${category}` : ''}
${features ? `Характеристики товара: ${features}` : ''}
Язык: ${language === 'ru' ? 'Русский' : language === 'en' ? 'Английский' : language}
Объём описания: ${charCount} символов

Требования к описанию:
1. Используйте HTML-теги для форматирования: <p>, <ul>, <li>, <strong>
2. Опишите преимущества товара
3. Укажите ключевые характеристики
4. Добавьте призыв к действию
5. Формат: вернуть JSON {"description": "описание с HTML"}

Верните ТОЛЬКО JSON, без дополнительного текста.`;

    const response = await client.invoke(
      [{ role: 'user', content: prompt }],
      { model, temperature: 0.7 }
    );

    const text = response.content || '';

    // 解析JSON响应
    let description = '';
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        description = parsed.description || '';
      }
    } catch {
      description = text;
    }

    // 如果没有返回描述，生成一个默认的
    if (!description) {
      description = `<p>Качественный товар: ${title}</p>
<ul>
<li>Отличное соотношение цены и качества</li>
<li>Быстрая доставка</li>
<li>Гарантия качества</li>
</ul>
<p>Закажите сейчас!</p>`;
    }

    // 记录到日志
    try {
      await pool.query(
        `INSERT INTO ai_generation_logs (type, input, output, model) 
         VALUES ($1, $2, $3, $4)`,
        ['description', JSON.stringify(body), JSON.stringify({ description }), model]
      );
    } catch (logError) {
      console.error('Failed to log AI generation:', logError);
    }

    return NextResponse.json({ description });

  } catch (error) {
    console.error('Generate description error:', error);
    return NextResponse.json(
      { error: 'Failed to generate description', details: String(error) },
      { status: 500 }
    );
  }
}
