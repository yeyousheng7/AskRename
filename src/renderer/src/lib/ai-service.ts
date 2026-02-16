import type { AIChatResponse, AIChatSettings, ChatMessage } from '@shared/ipc-types';
import { electronApi } from '@/lib/electron-api';
import { SMART_DECISION_SYSTEM_PROMPT } from '@/modes/smart/decision-prompt';
import type { SmartDecision } from '@/types/types';

export type AIProvider = 'openai' | 'deepseek' | 'ollama' | 'custom';

export interface AIServiceConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL: string;
  model: string;
  jsonMode: boolean;
  maxTokens: number;
}

interface BatchPromptContext {
  requestId?: string;
  startIndex?: number; // 1-based
  totalCount?: number;
}

const PROVIDER_PRESETS: Record<AIProvider, Omit<AIServiceConfig, 'apiKey'>> = {
  openai: {
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    jsonMode: true,
    maxTokens: 4096
  },
  deepseek: {
    provider: 'deepseek',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    jsonMode: true,
    maxTokens: 4096
  },
  ollama: {
    provider: 'ollama',
    baseURL: 'http://localhost:11434/v1',
    model: 'llama3',
    jsonMode: false,
    maxTokens: 4096
  },
  custom: {
    provider: 'custom',
    baseURL: '',
    model: '',
    jsonMode: false,
    maxTokens: 4096
  }
};

export const AI_SYSTEM_PROMPT = `你是一个文件名批处理助手。用户会提供文件列表和修改指令。
你必须返回一个纯 JSON 字符串数组，包含修改后的文件名。数组长度必须与输入文件严格一致。
EXAMPLE INPUT:
文件列表：["photo_001.jpg", "photo_002.jpg"]
修改指令：添加日期前缀 2024-01-15

EXAMPLE JSON OUTPUT:
["2024-01-15_photo_001.jpg", "2024-01-15_photo_002.jpg"]

规则：
- 只输出 JSON 数组，不要任何解释或 markdown 标记
- 数组长度必须与输入文件数量完全相同
- 保持文件扩展名不变（除非用户明确要求修改）`;

export function getConfigFromEnv(): AIServiceConfig {
  const provider = (import.meta.env.VITE_AI_PROVIDER as AIProvider) || 'deepseek';
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom;

  return {
    ...preset,
    provider,
    apiKey: import.meta.env.VITE_AI_API_KEY || '',
    baseURL: import.meta.env.VITE_AI_BASE_URL || preset.baseURL,
    model: import.meta.env.VITE_AI_MODEL || preset.model,
    jsonMode: import.meta.env.VITE_AI_JSON_MODE !== 'false',
    maxTokens: parseInt(import.meta.env.VITE_AI_MAX_TOKENS || '') || preset.maxTokens
  };
}

export function getProviderPreset(provider: AIProvider): Omit<AIServiceConfig, 'apiKey'> {
  return { ...PROVIDER_PRESETS[provider] };
}

export function getSupportedProviders(): { id: AIProvider; name: string }[] {
  return [
    { id: 'openai', name: 'OpenAI' },
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'ollama', name: 'Ollama' },
    { id: 'custom', name: '自定义' }
  ];
}

function ensureConfig(config: AIServiceConfig): void {
  if (config.provider !== 'ollama' && !config.apiKey) {
    throw new Error('API Key 未配置，请在设置中填写 API Key');
  }
  if (!config.baseURL) {
    throw new Error('API Base URL 未配置');
  }
  if (!config.model) {
    throw new Error('模型名称未配置');
  }
}

function parseJson(content: string): unknown {
  const cleanedContent = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleanedContent);
}

function parseAndValidateNameList(content: string, expectedLength: number): string[] {
  let parsed: unknown;
  try {
    parsed = parseJson(content);
  } catch {
    throw new Error(
      `AI 生成格式错误，无法解析 JSON，请重试。原始输出: ${content.slice(0, 100)}...`
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI 生成格式错误：返回值必须是数组，请重试');
  }

  if (parsed.length !== expectedLength) {
    throw new Error(
      `AI 生成格式错误：返回数组长度 (${parsed.length}) 与输入文件数量 (${expectedLength}) 不匹配，请重试`
    );
  }

  return parsed.map((name, index) => {
    if (typeof name !== 'string') {
      throw new Error(`AI 生成格式错误：第 ${index + 1} 个文件名不是字符串，请重试`);
    }
    return name;
  });
}

export async function generateNewNames(
  files: string[],
  userInstruction: string,
  config?: Partial<AIServiceConfig>,
  context?: BatchPromptContext
): Promise<string[]> {
  const finalConfig: AIServiceConfig = { ...getConfigFromEnv(), ...config };
  const { provider, apiKey, baseURL, model, jsonMode, maxTokens } = finalConfig;

  ensureConfig(finalConfig);

  if (files.length === 0) {
    return [];
  }

  const safeStartIndex = Number.isFinite(context?.startIndex)
    ? Math.max(1, Math.floor(context?.startIndex ?? 1))
    : undefined;
  const safeTotalCount = Number.isFinite(context?.totalCount)
    ? Math.max(files.length, Math.floor(context?.totalCount ?? files.length))
    : undefined;
  const batchIndexHint = safeStartIndex
    ? `\n\n全局序号信息：当前批第一个文件在全量列表中的位置是第 ${safeStartIndex} 个（从 1 开始）。` +
      `${safeTotalCount ? ` 全量文件总数约为 ${safeTotalCount} 个。` : ''}` +
      '\n如果用户要求添加序号/编号，请基于该全局起始位置连续编号，不要每批从 1 重新开始。'
    : '';
  const userMessage =
    `文件列表：${JSON.stringify(files)}\n\n修改指令：${userInstruction}` + batchIndexHint;

  const messages: ChatMessage[] = [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ];

  const response: AIChatResponse = await electronApi.askAI(
    { provider, apiKey, baseURL, model, jsonMode, maxTokens } satisfies AIChatSettings,
    messages,
    context?.requestId
  );

  if (!response.success) {
    throw new Error(response.error || 'AI 服务发生未知错误');
  }

  if (!response.content) {
    throw new Error('AI 返回内容为空，请尝试修改指令后重试');
  }

  return parseAndValidateNameList(response.content, files.length);
}

export async function generateNewNamesBatched(
  files: string[],
  userInstruction: string,
  config?: Partial<AIServiceConfig>,
  options?: {
    batchSize?: number;
    concurrencyLimit?: number;
    continueOnError?: boolean;
  }
): Promise<{ names: string[]; errors: Array<{ batchIndex: number; message: string }> }> {
  if (files.length === 0) {
    return { names: [], errors: [] };
  }

  const batchSize = Math.min(Math.max(Math.floor(options?.batchSize ?? 10), 1), 50);
  const concurrencyLimit = Math.min(Math.max(Math.floor(options?.concurrencyLimit ?? 3), 1), 10);
  const continueOnError = options?.continueOnError ?? true;

  const batches: Array<{ batchIndex: number; start: number; items: string[] }> = [];
  for (let start = 0, batchIndex = 0; start < files.length; start += batchSize, batchIndex++) {
    const end = Math.min(start + batchSize, files.length);
    batches.push({ batchIndex, start, items: files.slice(start, end) });
  }

  const names = new Array<string>(files.length);
  const errors: Array<{ batchIndex: number; message: string }> = [];
  let cursor = 0;
  let hardError: Error | null = null;

  const runWorker = async (): Promise<void> => {
    while (cursor < batches.length) {
      const current = cursor;
      cursor += 1;
      const batch = batches[current];
      if (!batch) continue;

      try {
        const batchNames = await generateNewNames(batch.items, userInstruction, config, {
          startIndex: batch.start + 1,
          totalCount: files.length
        });
        batchNames.forEach((value, offset) => {
          names[batch.start + offset] = value;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : '批次处理失败';
        errors.push({ batchIndex: batch.batchIndex, message });

        if (!continueOnError) {
          hardError = new Error(`第 ${batch.batchIndex + 1} 批处理失败：${message}`);
          return;
        }

        batch.items.forEach((value, offset) => {
          names[batch.start + offset] = value;
        });
      }
    }
  };

  const workerCount = Math.min(concurrencyLimit, batches.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  if (hardError) throw hardError;

  for (let index = 0; index < names.length; index++) {
    if (typeof names[index] !== 'string') {
      names[index] = files[index] ?? '';
    }
  }

  return { names, errors };
}

function normalizeDecisionRegexFind(findRaw: string): string {
  const trimmed = findRaw.trim();
  if (!trimmed) return '';

  const wrappedPattern = trimmed.match(/^\/(.+)\/([a-z]*)$/i);
  if (!wrappedPattern) return trimmed;

  const pattern = wrappedPattern[1] ?? '';
  const flags = wrappedPattern[2] ?? '';
  const unsupportedFlags = flags.replace(/g/gi, '');
  if (unsupportedFlags.length > 0) {
    throw new Error(`AI 决策格式错误：regex 规则不支持 flags "${flags}"，请仅返回纯模式字符串`);
  }

  return pattern.trim();
}

function parseAutoDecisionResponse(content: string): SmartDecision {
  let decision: unknown;

  try {
    decision = parseJson(content);
  } catch {
    throw new Error(`AI 决策格式错误，无法解析 JSON。原始输出: ${content.slice(0, 100)}...`);
  }

  if (typeof decision !== 'object' || decision === null) {
    throw new Error('AI 决策格式错误：返回值必须是对象');
  }

  const obj = decision as Record<string, unknown>;
  if (obj.type !== 'regex' && obj.type !== 'list') {
    throw new Error('AI 决策格式错误：type 必须是 "regex" 或 "list"（严格新协议）');
  }

  if (obj.type === 'list') {
    if (!Array.isArray(obj.names)) {
      throw new Error('AI 决策格式错误：list 类型缺少 names 数组');
    }
    const names = obj.names.map((item, index) => {
      if (typeof item !== 'string') {
        throw new Error(`AI 决策格式错误：第 ${index + 1} 个文件名不是字符串`);
      }
      return item;
    });
    return { type: 'list', names };
  }

  if (typeof obj.payload !== 'object' || obj.payload === null) {
    throw new Error('AI 决策格式错误：regex 类型缺少 payload 对象');
  }
  const payloadObj = obj.payload as Record<string, unknown>;
  const findRaw = payloadObj.find;
  const replaceRaw = payloadObj.replace;

  if (typeof findRaw !== 'string') {
    throw new Error('AI 决策格式错误：regex 类型缺少 payload.find 字段');
  }
  if (typeof replaceRaw !== 'string') {
    throw new Error('AI 决策格式错误：regex 类型缺少 payload.replace 字段');
  }
  const normalizedFind = normalizeDecisionRegexFind(findRaw);
  if (!normalizedFind) {
    throw new Error('AI 决策格式错误：regex 类型的 payload.find 不能为空');
  }

  return {
    type: 'regex',
    payload: {
      find: normalizedFind,
      replace: replaceRaw
    }
  };
}

export async function generateAutoDecision(
  files: string[],
  userInstruction: string,
  config?: Partial<AIServiceConfig>,
  requestId?: string,
  options?: {
    startIndex?: number; // 1-based, for batched decision context
    totalCount?: number;
  }
): Promise<SmartDecision> {
  const finalConfig: AIServiceConfig = { ...getConfigFromEnv(), ...config };
  const { provider, apiKey, baseURL, model, jsonMode, maxTokens } = finalConfig;

  ensureConfig(finalConfig);

  if (files.length === 0) {
    throw new Error('没有文件需要重命名');
  }

  const decisionFiles = files;
  const totalCount = files.length;
  const safeStartIndex = Number.isFinite(options?.startIndex)
    ? Math.max(1, Math.floor(options?.startIndex ?? 1))
    : undefined;
  const decisionTotalCount = Number.isFinite(options?.totalCount)
    ? Math.max(totalCount, Math.floor(options?.totalCount ?? totalCount))
    : totalCount;
  const batchIndexHint = safeStartIndex
    ? `\n\n全局序号信息：当前批第一个文件在全量列表中的位置是第 ${safeStartIndex} 个（从 1 开始），全量文件总数约为 ${decisionTotalCount} 个。` +
      '\n如果用户要求编号/序号，请据此判断是否应保持全局连续。'
    : '';

  const userMessage = `文件列表（共 ${totalCount} 个）：${JSON.stringify(decisionFiles)}\n\n修改指令：${userInstruction}\n\n若输出 type="list"，names 必须与文件数量一致。${batchIndexHint}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: SMART_DECISION_SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ];

  const response = await electronApi.askAI(
    { provider, apiKey, baseURL, model, jsonMode, maxTokens },
    messages,
    requestId
  );

  if (!response.success) {
    throw new Error(response.error || 'AI 服务发生未知错误');
  }

  if (!response.content) {
    throw new Error('AI 返回内容为空，请尝试修改指令后重试');
  }

  return parseAutoDecisionResponse(response.content);
}
