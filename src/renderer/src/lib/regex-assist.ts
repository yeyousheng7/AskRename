import type { ChatMessage } from '@shared/ipc-types';
import { electronApi } from '@/lib/electron-api';
import { getConfigFromEnv, type AIServiceConfig } from '@/lib/ai-service';

export type RegexAssistResult = { find: string; replace: string };

const SYSTEM_PROMPT =
  "You are a Regex Expert. Translate the user's natural language requirement into a JavaScript RegExp pattern. Return ONLY a JSON object: { find: string, replace: string }. Do not explain.";

function parseJsonFromModel(content: string): unknown {
  try {
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`AI 返回不是有效 JSON：${content.slice(0, 120)}...`);
  }
}

export async function generateRegexFromDescription(
  requirement: string,
  config: Pick<AIServiceConfig, 'provider' | 'apiKey' | 'baseURL' | 'model'> &
    Partial<Pick<AIServiceConfig, 'jsonMode' | 'maxTokens'>>
): Promise<RegexAssistResult> {
  const envCfg = getConfigFromEnv();
  const finalConfig: AIServiceConfig = {
    ...envCfg,
    ...config,
    jsonMode: config.provider === 'ollama' ? envCfg.jsonMode : true
  };

  const { provider, apiKey, baseURL, model, jsonMode, maxTokens } = finalConfig;

  if (provider !== 'ollama' && !apiKey.trim()) {
    throw new Error('API Key 未配置，请先在设置中配置 API Key');
  }
  if (!baseURL.trim()) throw new Error('API Base URL 未配置');
  if (!model.trim()) throw new Error('模型名称未配置');
  if (!requirement.trim()) throw new Error('请输入正则需求描述');

  const examples =
    'Examples:\n' +
    'User: 把所有数字去掉\nJSON: { "find": "\\\\d+", "replace": "" }\n' +
    'User: 把 jpg 后缀改成 png\nJSON: { "find": "\\\\.jpg$", "replace": ".png" }\n';

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${examples}\nUser: ${requirement}` }
  ];

  const response = await electronApi.askAI(
    { provider, apiKey, baseURL, model, jsonMode, maxTokens },
    messages
  );

  if (!response.success) throw new Error(response.error || 'AI 服务发生未知错误');
  if (!response.content) throw new Error('AI 返回内容为空，请重试');

  const obj = parseJsonFromModel(response.content);
  if (!obj || typeof obj !== 'object') {
    throw new Error('AI 返回格式错误：必须返回 JSON 对象');
  }

  const record = obj as Record<string, unknown>;
  if (typeof record.find !== 'string' || typeof record.replace !== 'string') {
    throw new Error('AI 返回格式错误：必须返回 { find: string, replace: string }');
  }

  return { find: record.find, replace: record.replace };
}
