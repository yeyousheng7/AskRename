import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import type {
  AIChatResponse,
  AIChatSettings,
  ChatMessage,
  AIProvider,
  RenameFileItem,
  RenameResult,
  ScanDirectoryResult
} from '@shared/ipc-types';

// ============================================================================
// AI API 类型定义
// ============================================================================

// ============================================================================
// 文件重命名类型定义
// ============================================================================

// ============================================================================
// Custom APIs for renderer
// ============================================================================

const api = {
  /**
   * 从 File 对象获取真实绝对路径（Electron 推荐方式）
   * 说明：在较新的 Electron 版本中，renderer 侧的 `file.path` 可能为空。
   */
  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      // ignore and fall back
    }

    // fallback（旧版本 Electron 可能仍有非标准属性）
    const legacy = file as unknown as { path?: string };
    return legacy.path || '';
  },

  /**
   * 调用 AI Chat API
   * @param settings - AI 服务配置
   * @param messages - 聊天消息数组
   * @param requestId - 可选：用于取消指定请求（批处理/并发场景）
   * @returns AI 响应结果
   */
  askAI: (
    settings: AIChatSettings,
    messages: ChatMessage[],
    requestId?: string
  ): Promise<AIChatResponse> => {
    return ipcRenderer.invoke('ai:chat', { settings, messages, requestId });
  },

  cancelAI: (requestId: string): Promise<void> => {
    return ipcRenderer.invoke('ai:cancel', requestId);
  },

  /**
   * 应用文件重命名
   * @param files - 要重命名的文件列表
   * @returns 重命名结果
   */
  applyRename: (files: RenameFileItem[]): Promise<RenameResult> => {
    return ipcRenderer.invoke('app:rename-files', files);
  },

  /**
   * 获取指定 provider 的 API Key（从主进程安全存储）
   */
  getApiKey: (provider: AIProvider): Promise<string> => {
    return ipcRenderer.invoke('settings:get-api-key', provider);
  },

  /**
   * 保存指定 provider 的 API Key（写入主进程安全存储）
   */
  setApiKey: (provider: AIProvider, apiKey: string): Promise<void> => {
    return ipcRenderer.invoke('settings:set-api-key', { provider, apiKey });
  },

  /**
   * 递归扫描目录，返回所有文件
   */
  scanDirectory: (dirs: string[]): Promise<ScanDirectoryResult> => {
    return ipcRenderer.invoke('app:scan-directory', dirs);
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
