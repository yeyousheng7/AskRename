import { ElectronAPI } from '@electron-toolkit/preload';
import type {
  AIChatResponse,
  AIChatSettings,
  ChatMessage,
  RenameFileItem,
  RenameResult
} from '@shared/ipc-types';

interface CustomAPI {
  getPathForFile: (file: File) => string;
  askAI: (settings: AIChatSettings, messages: ChatMessage[]) => Promise<AIChatResponse>;
  applyRename: (files: RenameFileItem[]) => Promise<RenameResult>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: CustomAPI;
  }
}
