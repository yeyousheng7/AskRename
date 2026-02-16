import type { ChatMessage } from '@shared/ipc-types';
import { electronApi } from '@/lib/electron-api';
import { getConfigFromEnv, type AIServiceConfig } from '@/lib/ai-service';

export type RegexAssistResult = { find: string; replace: string };

const SYSTEM_PROMPT = `你是一个规则表达式专家。将用户需求转换为查找和替换。
严格输出 JSON 对象：{"find": string, "replace": string}
只返回 JSON，不要解释。

约束：
- find 必须是 JavaScript RegExp 的纯模式字符串，不要写成 /pattern/ 或 /pattern/g。
- 不要使用 flags（系统固定使用全局 g）。
- 不要使用内联 flags（如 (?i)、(?m)、(?s)）。
- 不要使用后行断言（(?<=...) / (?<!...)）。
- 不要使用命名捕获组与命名反向引用（(?<name>...) / \\k<name>）。
- replace 可使用 $1/$2... 捕获组，也可使用 \${i}/\${i0}/\${i00}/\${i000} 序号变量。
- 若需要“整个匹配”，请使用 $&，不要使用 $0。
- 若要输出字面量 $，请使用 $$。`;

function parseJsonFromModel(content: string): unknown {
  try {
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`AI 返回不是有效 JSON: ${content.slice(0, 120)}...`);
  }
}

function normalizeRegexFind(findRaw: string): string {
  const trimmed = findRaw.trim();
  if (!trimmed) return '';

  const wrappedPattern = trimmed.match(/^\/(.+)\/([a-z]*)$/i);
  if (!wrappedPattern) return trimmed;

  const pattern = wrappedPattern[1] ?? '';
  const flags = wrappedPattern[2] ?? '';
  const unsupportedFlags = flags.replace(/g/gi, '');
  if (unsupportedFlags.length > 0) {
    throw new Error(`AI 返回格式错误：find 不支持 flags "${flags}"，请仅返回纯模式字符串`);
  }

  return pattern.trim();
}

function validateRegexEngineCompatibility(pattern: string): void {
  if (/\(\?<([=!])/.test(pattern)) {
    throw new Error('AI 返回格式错误：当前引擎不支持后行断言（?<= / ?<!)');
  }
  if (/\(\?<[^=!]/.test(pattern)) {
    throw new Error('AI 返回格式错误：当前引擎不支持命名捕获组 (?<name>...)');
  }
  if (/\\k<[^>]+>/.test(pattern)) {
    throw new Error('AI 返回格式错误：当前引擎不支持命名反向引用 \\k<name>');
  }
  if (/\(\?[a-zA-Z-]/.test(pattern)) {
    throw new Error('AI 返回格式错误：当前引擎不支持内联 flags（如 (?i)）');
  }

  try {
    // Runtime engine is fixed to global replace (`g`).
    new RegExp(pattern, 'g');
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知语法错误';
    throw new Error(`AI 返回格式错误：find 语法无效（${message}）`);
  }
}

function validateReplacementCompatibility(replace: string): void {
  if (/\$0(?!\d)/.test(replace)) {
    throw new Error('AI 返回格式错误：replace 不支持 $0，请使用 $& 表示整个匹配');
  }
  if (/\$<[^>]+>/.test(replace)) {
    throw new Error('AI 返回格式错误：replace 不支持命名组引用 $<name>');
  }
}

export async function generateRegexFromDescription(
  requirement: string,
  config?: Partial<
    Pick<AIServiceConfig, 'provider' | 'apiKey' | 'baseURL' | 'model' | 'jsonMode' | 'maxTokens'>
  >
): Promise<RegexAssistResult> {
  const envCfg = getConfigFromEnv();
  const finalConfig: AIServiceConfig = {
    ...envCfg,
    ...config,
    jsonMode: (config?.provider ?? envCfg.provider) === 'ollama' ? envCfg.jsonMode : true
  };

  const { provider, apiKey, baseURL, model, jsonMode, maxTokens } = finalConfig;

  if (provider !== 'ollama' && !apiKey.trim()) {
    throw new Error('API Key 未配置，请先在设置中配置 API Key');
  }
  if (!baseURL.trim()) throw new Error('API Base URL 未配置');
  if (!model.trim()) throw new Error('模型名称未配置');
  if (!requirement.trim()) throw new Error('请输入规则需求描述');

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `User: ${requirement}` }
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
  const normalizedFind = normalizeRegexFind(record.find);
  if (!normalizedFind) {
    throw new Error('AI 返回格式错误：find 不能为空');
  }
  validateRegexEngineCompatibility(normalizedFind);
  validateReplacementCompatibility(record.replace);

  return { find: normalizedFind, replace: record.replace };
}
