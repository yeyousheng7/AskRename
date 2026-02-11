import { ElectronAPI } from '@electron-toolkit/preload';
import type {
  AIChatResponse,
  AIChatSettings,
  AIProvider,
  ChatMessage,
  RenameFileItem,
  RenameResult,
  ScanDirectoryResult,
  ScanDirectoryShallowResult
} from '@shared/ipc-types';

interface CustomAPI {
  getPathForFile: (file: File) => string;
  askAI: (
    settings: AIChatSettings,
    messages: ChatMessage[],
    requestId?: string
  ) => Promise<AIChatResponse>;
  cancelAI: (requestId: string) => Promise<void>;
  applyRename: (files: RenameFileItem[]) => Promise<RenameResult>;
  getApiKey: (provider: AIProvider) => Promise<string>;
  setApiKey: (provider: AIProvider, apiKey: string) => Promise<void>;
  scanDirectory: (dirs: string[]) => Promise<ScanDirectoryResult>;
  scanDirectoryShallow: (dirs: string[]) => Promise<ScanDirectoryShallowResult>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: CustomAPI;
  }
}
