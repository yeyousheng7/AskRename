/**
 * AI 重命名服务
 * 支持 OpenAI、DeepSeek 等兼容 API 的厂商
 */

// ============================================================================
// 类型定义
// ============================================================================

export type AIProvider = 'openai' | 'deepseek' | 'custom'

export interface AIServiceConfig {
  provider: AIProvider
  apiKey: string
  baseURL: string
  model: string
  /** 是否启用 JSON 模式（DeepSeek 推荐开启） */
  jsonMode: boolean
  /** 最大 token 数，防止 JSON 被截断 */
  maxTokens: number
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices: {
    message: {
      content: string | null
    }
  }[]
}

// ============================================================================
// 预设配置
// ============================================================================

const PROVIDER_PRESETS: Record<AIProvider, Omit<AIServiceConfig, 'apiKey'>> = {
  openai: {
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
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
  custom: {
    provider: 'custom',
    baseURL: '',
    model: '',
    jsonMode: false,
    maxTokens: 4096
  }
}

// ============================================================================
// System Prompt（包含 JSON 示例，兼容 DeepSeek JSON Output 要求）
// ============================================================================

const SYSTEM_PROMPT = `你是一个文件名批处理助手。用户会提供文件列表和修改指令。

你必须返回一个纯 JSON 字符串数组，包含修改后的文件名。数组长度必须与输入文件严格一致。

EXAMPLE INPUT:
文件列表：["photo_001.jpg", "photo_002.jpg"]
修改指令：添加日期前缀 2024-01-15

EXAMPLE JSON OUTPUT:
["2024-01-15_photo_001.jpg", "2024-01-15_photo_002.jpg"]

规则：
- 只输出 JSON 数组，不要任何解释或 markdown 标记
- 数组长度必须与输入文件数量完全相同
- 保持文件扩展名不变（除非用户明确要求修改）`

// ============================================================================
// 配置管理
// ============================================================================

/**
 * 从环境变量获取配置
 */
export function getConfigFromEnv(): AIServiceConfig {
  const provider = (import.meta.env.VITE_AI_PROVIDER as AIProvider) || 'deepseek'
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom

  return {
    ...preset,
    provider,
    apiKey: import.meta.env.VITE_AI_API_KEY || '',
    baseURL: import.meta.env.VITE_AI_BASE_URL || preset.baseURL,
    model: import.meta.env.VITE_AI_MODEL || preset.model,
    jsonMode: import.meta.env.VITE_AI_JSON_MODE !== 'false',
    maxTokens: parseInt(import.meta.env.VITE_AI_MAX_TOKENS || '') || preset.maxTokens
  }
}

/**
 * 获取指定厂商的预设配置
 */
export function getProviderPreset(provider: AIProvider): Omit<AIServiceConfig, 'apiKey'> {
  return { ...PROVIDER_PRESETS[provider] }
}

/**
 * 获取所有支持的厂商列表
 */
export function getSupportedProviders(): { id: AIProvider; name: string }[] {
  return [
    { id: 'openai', name: 'OpenAI' },
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'custom', name: '自定义' }
  ]
}

// ============================================================================
// 核心 API
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
  const finalConfig: AIServiceConfig = { ...getConfigFromEnv(), ...config }
  const { apiKey, baseURL, model, jsonMode, maxTokens } = finalConfig

  if (!apiKey) {
    throw new Error('API Key 未配置，请在设置中填写 API Key')
  }

  if (!baseURL) {
    throw new Error('API Base URL 未配置')
  }

  if (files.length === 0) {
    return []
  }

  const userMessage = `文件列表：${JSON.stringify(files)}

修改指令：${userInstruction}`

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ]

  // 构建请求体
  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.3,
    max_tokens: maxTokens
  }

  // DeepSeek / OpenAI JSON 模式
  if (jsonMode) {
    requestBody.response_format = { type: 'json_object' }
  }

  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 请求失败: ${response.status} - ${errorText}`)
    }

    const data: ChatCompletionResponse = await response.json()
    const content = data.choices?.[0]?.message?.content

    // DeepSeek JSON 模式有时会返回空 content
    if (!content) {
      throw new Error('AI 返回内容为空，请尝试修改指令后重试')
    }

    return parseAndValidateResponse(content, files.length)
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('AI 服务发生未知错误，请重试')
  }
}

// ============================================================================
// 响应解析
// ============================================================================

/**
 * 解析并验证 AI 响应
 */
function parseAndValidateResponse(content: string, expectedLength: number): string[] {
  let newNames: unknown

  try {
    // 移除可能的 markdown 代码块标记（兼容未开启 JSON 模式的情况）
    const cleanedContent = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    newNames = JSON.parse(cleanedContent)
  } catch {
    throw new Error(`AI 生成格式错误，无法解析 JSON，请重试。原始输出: ${content.slice(0, 100)}...`)
  }

  // 验证返回格式
  if (!Array.isArray(newNames)) {
    throw new Error('AI 生成格式错误：返回值必须是数组，请重试')
  }

  if (newNames.length !== expectedLength) {
    throw new Error(
      `AI 生成格式错误：返回数组长度 (${newNames.length}) 与输入文件数量 (${expectedLength}) 不匹配，请重试`
    )
  }

  // 确保每个元素都是字符串
  return newNames.map((name, index) => {
    if (typeof name !== 'string') {
      throw new Error(`AI 生成格式错误：第 ${index + 1} 个文件名不是字符串，请重试`)
    }
    return name
  })
}
