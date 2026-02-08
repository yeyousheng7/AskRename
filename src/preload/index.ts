import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// ============================================================================
// AI API 类型定义
// ============================================================================

interface AISettings {
  apiKey: string;
  baseURL: string;
  model: string;
  jsonMode: boolean;
  maxTokens: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIChatResponse {
  success: boolean;
  content?: string;
  error?: string;
}

// ============================================================================
// Custom APIs for renderer
// ============================================================================

const api = {
  /**
   * 调用 AI Chat API
   * @param settings - AI 服务配置
   * @param messages - 聊天消息数组
   * @returns AI 响应结果
   */
  askAI: (settings: AISettings, messages: ChatMessage[]): Promise<AIChatResponse> => {
    return ipcRenderer.invoke('ai:chat', { settings, messages });
  }
};

// ============================================================================
// Expose APIs to renderer
// ============================================================================

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
