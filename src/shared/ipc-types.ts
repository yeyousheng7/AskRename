export type ChatMessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export type AIProvider = 'openai' | 'deepseek' | 'ollama' | 'custom';

export interface AIChatSettings {
  provider: AIProvider;
  apiKey: string;
  baseURL: string;
  model: string;
  jsonMode: boolean;
  maxTokens: number;
}

export interface AIChatRequest {
  settings: AIChatSettings;
  messages: ChatMessage[];
  /**
   * 可选：用于取消指定请求（批处理/并发场景）。
   */
  requestId?: string;
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

// AI 决策结果：正则类型或列表类型
export type AIDecision =
  | { type: 'regex'; find: string; replace: string }
  | { type: 'list'; names: string[] };

// 目录扫描结果
export interface ScannedFileItem {
  /** 文件名 (basename) */
  name: string;
  /** 绝对路径 */
  path: string;
}

export interface ScanDirectoryResult {
  files: ScannedFileItem[];
  errors: string[];
}
