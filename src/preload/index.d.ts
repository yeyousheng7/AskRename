import { ElectronAPI } from '@electron-toolkit/preload';

// AI API 类型定义
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

interface CustomAPI {
  askAI: (settings: AISettings, messages: ChatMessage[]) => Promise<AIChatResponse>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: CustomAPI;
  }
}
