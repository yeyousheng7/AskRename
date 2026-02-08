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

// 文件重命名类型定义
interface RenameFileItem {
  oldPath: string;
  newName?: string;
  newPath?: string;
}

interface RenameError {
  path: string;
  error: string;
}

interface RenameResult {
  successCount: number;
  errors: RenameError[];
  renamed?: { oldPath: string; newPath: string }[];
}

interface CustomAPI {
  getPathForFile: (file: File) => string;
  askAI: (settings: AISettings, messages: ChatMessage[]) => Promise<AIChatResponse>;
  applyRename: (files: RenameFileItem[]) => Promise<RenameResult>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: CustomAPI;
  }
}
