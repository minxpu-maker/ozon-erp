import { Config, LLMClient as CozeLLMClient } from 'coze-coding-dev-sdk';

// 创建LLM客户端
export function createLLMClient(): CozeLLMClient {
  const config = new Config();
  return new CozeLLMClient(config);
}

// 导出类型
export type LLMClient = CozeLLMClient;
