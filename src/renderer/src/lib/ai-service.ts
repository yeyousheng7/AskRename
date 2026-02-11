/**
 * AI 重命名服务
 * 通过 IPC 调用主进程 API，绕过 CORS/CSP 限制
 */

// ============================================================================
// 类型定义
// ============================================================================

import type { AIChatResponse, AIChatSettings, ChatMessage } from '@shared/ipc-types';
import { electronApi } from '@/lib/electron-api';

export type AIProvider = 'openai' | 'deepseek' | 'ollama' | 'custom';

export type RegexAssistResult = { find: string; replace: string };

export interface AIServiceConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL: string;
  model: string;
  /** 是否启用 JSON 模式（DeepSeek 推荐开启） */
  jsonMode: boolean;
  /** 最大 token 数，防止 JSON 被截断 */
  maxTokens: number;
}

// ============================================================================
// 预设配置
// ============================================================================

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

// ============================================================================
// System Prompt（包含 JSON 示例，兼容 DeepSeek JSON Output 要求）
// ============================================================================

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

// ============================================================================
// 配置管理
// ============================================================================

/**
 * 从环境变量获取配置
 */
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

/**
 * 获取指定厂商的预设配置
 */
export function getProviderPreset(provider: AIProvider): Omit<AIServiceConfig, 'apiKey'> {
  return { ...PROVIDER_PRESETS[provider] };
}

/**
 * 获取所有支持的厂商列表
 */
export function getSupportedProviders(): { id: AIProvider; name: string }[] {
  return [
    { id: 'openai', name: 'OpenAI' },
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'ollama', name: 'Ollama' },
    { id: 'custom', name: '自定义' }
  ];
}

// ============================================================================
// 核心 API（通过 IPC 调用主进程）
// ============================================================================

/**
 * 调用 AI 生成新文件名
 * @param files - 原始文件名数组
 * @param userInstruction - 用户的重命名指令
 * @param config - API 配置（可选，默认从环境变量读取）
 * @returns 新文件名数组
 */
export async function generateNewNames(
  files: string[],
  userInstruction: string,
  config?: Partial<AIServiceConfig>
): Promise<string[]> {
  const finalConfig: AIServiceConfig = { ...getConfigFromEnv(), ...config };
  const { provider, apiKey, baseURL, model, jsonMode, maxTokens } = finalConfig;

  if (provider !== 'ollama' && !apiKey) {
    throw new Error('API Key 未配置，请在设置中填写 API Key');
  }

  if (!baseURL) {
    throw new Error('API Base URL 未配置');
  }

  if (!model) {
    throw new Error('模型名称未配置');
  }

  if (files.length === 0) {
    return [];
  }

  const userMessage = `文件列表：${JSON.stringify(files)}

修改指令：${userInstruction}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ];

  // 通过 IPC 调用主进程
  const response: AIChatResponse = await electronApi.askAI(
    { provider, apiKey, baseURL, model, jsonMode, maxTokens } satisfies AIChatSettings,
    messages
  );

  if (!response.success) {
    throw new Error(response.error || 'AI 服务发生未知错误');
  }

  if (!response.content) {
    throw new Error('AI 返回内容为空，请尝试修改指令后重试');
  }

  return parseAndValidateResponse(response.content, files.length);
}

// ============================================================================
// 响应解析
// ============================================================================

/**
 * 解析并验证 AI 响应
 */
function parseAndValidateResponse(content: string, expectedLength: number): string[] {
  let newNames: unknown;

  try {
    // 移除可能的 markdown 代码块标记（兼容未开启 JSON 模式的情况）
    const cleanedContent = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    newNames = JSON.parse(cleanedContent);
  } catch {
    throw new Error(
      `AI 生成格式错误，无法解析 JSON，请重试。原始输出: ${content.slice(0, 100)}...`
    );
  }

  // 验证返回格式
  if (!Array.isArray(newNames)) {
    throw new Error('AI 生成格式错误：返回值必须是数组，请重试');
  }

  if (newNames.length !== expectedLength) {
    throw new Error(
      `AI 生成格式错误：返回数组长度 (${newNames.length}) 与输入文件数量 (${expectedLength}) 不匹配，请重试`
    );
  }

  // 确保每个元素都是字符串
  return newNames.map((name, index) => {
    if (typeof name !== 'string') {
      throw new Error(`AI 生成格式错误：第 ${index + 1} 个文件名不是字符串，请重试`);
    }
    return name;
  });
}

// ============================================================================
// Auto Mode 决策引擎
// ============================================================================

import type { AIDecision } from '@shared/ipc-types';

// Re-export for external use
export type { AIDecision };

/** 决策模式采样数量：只发送前 N 个文件名给 AI 以节省 Token */
const DECISION_SAMPLE_SIZE = 20;

/** 决策型 System Prompt */
const AUTO_DECISION_PROMPT = `你是文件重命名助手。请分析用户的指令，判断能否用正则表达式（JavaScript 语法）解决。

判断规则：
- 正则适用场景：删除数字、替换特定字符、添加前后缀、大小写转换、简单模式提取、添加序号/编号等
- AI 适用场景：翻译、理解文件内容、复杂语义理解、需要上下文推理的任务

魔法变量（正则模式专属）：
你可以在 replace 字段中使用以下变量来生成序号：
- \${i} → 序号 (1, 2, 3...)
- \${i0} → 双位序号 (01, 02, 03...)
- \${i00} → 三位序号 (001, 002...)
- \${i000} → 四位序号 (0001...)

响应格式（只返回 JSON，不要任何解释）：

正则任务示例：
{"type":"regex","find":"\\\\d+","replace":""}

添加序号示例：
{"type":"regex","find":"^","replace":"\${i0}_"}

AI 任务示例：
{"type":"list","names":["新名称1.txt","新名称2.txt"]}

规则：
- 如果用户要求添加序号、编号或排序，优先使用正则模式 + 魔法变量
- 如果返回 list 类型，names 数组长度必须与输入文件数量完全一致
- 正则表达式使用 JavaScript 语法，会自动添加 g 标志
- 只输出 JSON，不要任何解释或 markdown 标记`;

/**
 * 调用 AI 获取重命名决策
 * @param files - 原始文件名数组（只发送前 20 个作为样本）
 * @param userInstruction - 用户的重命名指令
 * @param config - API 配置
 * @returns AI 决策结果（regex 或 list）
 */
export async function generateAutoDecision(
  files: string[],
  userInstruction: string,
  config?: Partial<AIServiceConfig>,
  requestId?: string
): Promise<AIDecision> {
  const finalConfig: AIServiceConfig = { ...getConfigFromEnv(), ...config };
  const { provider, apiKey, baseURL, model, jsonMode, maxTokens } = finalConfig;

  if (provider !== 'ollama' && !apiKey) {
    throw new Error('API Key 未配置，请在设置中填写 API Key');
  }

  if (!baseURL) {
    throw new Error('API Base URL 未配置');
  }

  if (!model) {
    throw new Error('模型名称未配置');
  }

  if (files.length === 0) {
    throw new Error('没有文件需要重命名');
  }

  // 只发送前 N 个文件名作为样本，节省 Token
  const sampleFiles = files.slice(0, DECISION_SAMPLE_SIZE);
  const totalCount = files.length;

  const userMessage = `文件列表（共 ${totalCount} 个，显示前 ${sampleFiles.length} 个）：
${JSON.stringify(sampleFiles)}

修改指令：${userInstruction}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: AUTO_DECISION_PROMPT },
    { role: 'user', content: userMessage }
  ];

  // 通过 IPC 调用主进程
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

  return parseAutoDecisionResponse(response.content, sampleFiles.length);
}

/**
 * 解析 AI 决策响应
 */
function parseAutoDecisionResponse(content: string, sampleLength: number): AIDecision {
  let decision: unknown;

  try {
    const cleanedContent = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    decision = JSON.parse(cleanedContent);
  } catch {
    throw new Error(`AI 决策格式错误，无法解析 JSON。原始输出: ${content.slice(0, 100)}...`);
  }

  // 验证返回格式
  if (typeof decision !== 'object' || decision === null) {
    throw new Error('AI 决策格式错误：返回值必须是对象');
  }

  const obj = decision as Record<string, unknown>;

  if (obj.type === 'regex') {
    if (typeof obj.find !== 'string') {
      throw new Error('AI 决策格式错误：regex 类型缺少 find 字段');
    }
    if (typeof obj.replace !== 'string') {
      throw new Error('AI 决策格式错误：regex 类型缺少 replace 字段');
    }
    return { type: 'regex', find: obj.find, replace: obj.replace };
  }

  if (obj.type === 'list') {
    if (!Array.isArray(obj.names)) {
      throw new Error('AI 决策格式错误：list 类型缺少 names 数组');
    }
    if (obj.names.length !== sampleLength) {
      throw new Error(
        `AI 决策格式错误：names 数组长度 (${obj.names.length}) 与样本数量 (${sampleLength}) 不匹配`
      );
    }
    const names = obj.names.map((n, i) => {
      if (typeof n !== 'string') {
        throw new Error(`AI 决策格式错误：第 ${i + 1} 个文件名不是字符串`);
      }
      return n;
    });
    return { type: 'list', names };
  }

  throw new Error(`AI 决策格式错误：未知类型 "${obj.type}"，应为 "regex" 或 "list"`);
}
