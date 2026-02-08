/**
 * AI Chat IPC Handler
 * 在主进程中处理 AI API 请求，绕过 CORS/CSP 限制
 */

import { ipcMain } from 'electron';

// ============================================================================
// 类型定义
// ============================================================================

export interface AISettings {
  apiKey: string;
  baseURL: string;
  model: string;
  jsonMode: boolean;
  maxTokens: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIChatRequest {
  settings: AISettings;
  messages: ChatMessage[];
}

export interface AIChatResponse {
  success: boolean;
  content?: string;
  error?: string;
}

interface OpenAIChatResponse {
  choices: {
    message: {
      content: string | null;
    };
  }[];
}

// ============================================================================
// IPC Handler 注册
// ============================================================================

export function registerAIHandlers(): void {
  ipcMain.handle('ai:chat', async (_event, request: AIChatRequest): Promise<AIChatResponse> => {
    const { settings, messages } = request;
    const { apiKey, baseURL, model, jsonMode, maxTokens } = settings;

    // 参数验证
    if (!apiKey) {
      return { success: false, error: 'API Key 未配置' };
    }

    if (!baseURL) {
      return { success: false, error: 'API Base URL 未配置' };
    }

    // 构建请求体
    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens
    };

    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    try {
      // 使用 Node.js fetch（Electron 18+ 内置）
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API 请求失败: ${response.status} - ${errorText}`
        };
      }

      const data: OpenAIChatResponse = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return {
          success: false,
          error: 'AI 返回内容为空，请尝试修改指令后重试'
        };
      }

      return { success: true, content };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      return { success: false, error: `请求失败: ${message}` };
    }
  });
}
