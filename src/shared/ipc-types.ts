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
  requestId?: string;
}

export interface AIChatResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export interface RenameFileItem {
  oldPath: string;
  newName?: string;
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

export interface ScannedFileItem {
  name: string;
  path: string;
}

export interface ScanDirectoryResult {
  files: ScannedFileItem[];
  errors: string[];
}

export interface ScanDirectoryShallowResult {
  files: ScannedFileItem[];
  errors: string[];
  hasSubdirectories: boolean;
}
