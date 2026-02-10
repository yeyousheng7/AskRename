import type {
  AIChatResponse,
  AIChatSettings,
  AIProvider,
  ChatMessage,
  RenameFileItem,
  RenameResult,
  ScanDirectoryResult
} from '@shared/ipc-types';

function getApi(): Window['api'] {
  if (!window.api) {
    throw new Error('Electron preload API is not available (window.api is undefined)');
  }
  return window.api;
}

export const electronApi = {
  getPathForFile(file: File): string {
    return getApi().getPathForFile(file);
  },

  askAI(
    settings: AIChatSettings,
    messages: ChatMessage[],
    requestId?: string
  ): Promise<AIChatResponse> {
    return getApi().askAI(settings, messages, requestId);
  },

  cancelAI(requestId: string): Promise<void> {
    return getApi().cancelAI(requestId);
  },

  applyRename(files: RenameFileItem[]): Promise<RenameResult> {
    return getApi().applyRename(files);
  },

  getApiKey(provider: AIProvider): Promise<string> {
    return getApi().getApiKey(provider);
  },

  setApiKey(provider: AIProvider, apiKey: string): Promise<void> {
    return getApi().setApiKey(provider, apiKey);
  },

  scanDirectory(dirs: string[]): Promise<ScanDirectoryResult> {
    return getApi().scanDirectory(dirs);
  }
} as const;
