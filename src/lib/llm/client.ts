import { Config, LLMClient as CozeLLMClient, LLMResponse } from 'coze-coding-dev-sdk';
import type { Message } from 'coze-coding-dev-sdk';

// 创建LLM客户端
export function createLLMClient(): CozeLLMClient {
  const config = new Config();
  return new CozeLLMClient(config);
}

// 调用LLM的统一方法
export async function callLLM(params: {
  model?: string;
  messages: { role: string; content: string }[];
  temperature?: number;
}): Promise<string> {
  const client = createLLMClient();
  const model = params.model || process.env.LLM_MODEL || 'doubao-seed-2-0-pro-260215';
  
  try {
    // 转换为SDK的Message格式
    const sdkMessages: Message[] = params.messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content
    }));
    
    const response: LLMResponse = await client.invoke(sdkMessages, {
      model,
      temperature: params.temperature || 0.7
    });
    
    return response.content || '';
  } catch (error) {
    console.error('LLM调用失败:', error);
    throw error;
  }
}

// 导出类型
export type LLMClient = CozeLLMClient;
