export type ChatMessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export interface AIChatSettings {
  apiKey: string;
  baseURL: string;
  model: string;
  jsonMode: boolean;
  maxTokens: number;
}

export interface AIChatRequest {
  settings: AIChatSettings;
  messages: ChatMessage[];
}

export interface AIChatResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export interface RenameFileItem {
  oldPath: string;
  /**
   * 新文件名（仅文件名，不包含路径）。推荐使用该字段，由主进程负责拼接路径。
   */
  newName?: string;
  /**
   * 兼容旧版：直接传完整目标路径。
   */
  newPath?: string;
}

export interface RenameError {
  path: string;
  error: string;
}

export interface RenamedItem {
  oldPath: string;
  newPath: string;
}

export interface RenameResult {
  successCount: number;
  errors: RenameError[];
  renamed?: RenamedItem[];
}
