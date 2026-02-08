/**
 * AI Chat IPC Handler
 * 在主进程中处理 AI API 请求，绕过 CORS/CSP 限制
 */

import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

export interface AISettings {
  apiKey: string;
  baseURL: string;
  model: string;
  jsonMode: boolean;
  maxTokens: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIChatRequest {
  settings: AISettings;
  messages: ChatMessage[];
}

export interface AIChatResponse {
  success: boolean;
  content?: string;
  error?: string;
}

interface OpenAIChatResponse {
  choices: {
    message: {
      content: string | null;
    };
  }[];
}

// 文件重命名类型
export interface RenameFileItem {
  oldPath: string;
  /**
   * 新文件名（仅文件名，不包含路径）。推荐使用该字段，由主进程负责拼接路径，避免
   * renderer 端 path 处理在 Windows 上出错（例如分隔符、盘符）。
   */
  newName?: string;
  /**
   * 兼容旧版：直接传完整目标路径。
   * 若同时提供 newName 与 newPath，以 newName 为准（保持“同目录重命名”）。
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

// ============================================================================
// IPC Handler 注册
// ============================================================================

function isWindowsPlatform(): boolean {
  return process.platform === 'win32';
}

function normalizePathForCompare(filePath: string): string {
  const resolved = path.resolve(filePath);
  return isWindowsPlatform() ? resolved.toLowerCase() : resolved;
}

function isSamePathIgnoreCase(a: string, b: string): boolean {
  if (!isWindowsPlatform()) return a === b;
  return normalizePathForCompare(a) === normalizePathForCompare(b);
}

function isValidWindowsFileName(name: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: '文件名不能为空' };
  if (trimmed === '.' || trimmed === '..') return { ok: false, reason: '文件名不能为 . 或 ..' };
  if (trimmed.endsWith(' ') || trimmed.endsWith('.')) {
    return { ok: false, reason: '文件名不能以空格或点结尾' };
  }

  // Windows 禁止字符（含控制字符）
  if (/[<>:"/\\|?*]/.test(trimmed)) {
    return { ok: false, reason: '文件名包含 Windows 禁止字符' };
  }
  for (const ch of trimmed) {
    if (ch.charCodeAt(0) < 32) {
      return { ok: false, reason: '文件名包含控制字符' };
    }
  }

  // 保留设备名（带扩展名也不允许，例如 CON.txt）
  const reserved = new Set([
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9'
  ]);
  const base = trimmed.split('.')[0]?.toUpperCase();
  if (base && reserved.has(base)) return { ok: false, reason: '文件名为 Windows 保留设备名' };

  return { ok: true };
}

async function makeUniqueTempPath(dir: string, ext: string, hint: string): Promise<string> {
  // temp 文件放在同目录，避免跨盘符/分区导致 rename 失败
  for (let i = 0; i < 20; i++) {
    const suffix = `${Date.now()}_${process.pid}_${Math.random().toString(16).slice(2)}_${i}`;
    const tmpName = `.askrename_tmp_${hint}_${suffix}${ext}`;
    const tmpPath = path.join(dir, tmpName);
    try {
      await fs.access(tmpPath);
      // exists, try another
    } catch {
      return tmpPath;
    }
  }
  // 理论上不会到这里
  throw new Error('无法生成临时文件名，请重试');
}

export function registerAIHandlers(): void {
  // AI Chat Handler
  ipcMain.handle('ai:chat', async (_event, request: AIChatRequest): Promise<AIChatResponse> => {
    const { settings, messages } = request;
    const { apiKey, baseURL, model, jsonMode, maxTokens } = settings;

    // 参数验证
    if (!apiKey) {
      return { success: false, error: 'API Key 未配置' };
    }

    if (!baseURL) {
      return { success: false, error: 'API Base URL 未配置' };
    }

    // 构建请求体
    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens
    };

    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    try {
      // 使用 Node.js fetch（Electron 18+ 内置）
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API 请求失败: ${response.status} - ${errorText}`
        };
      }

      const data: OpenAIChatResponse = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return {
          success: false,
          error: 'AI 返回内容为空，请尝试修改指令后重试'
        };
      }

      return { success: true, content };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      return { success: false, error: `请求失败: ${message}` };
    }
  });

  // 文件重命名 Handler
  ipcMain.handle(
    'app:rename-files',
    async (_event, files: RenameFileItem[]): Promise<RenameResult> => {
      const errors: RenameError[] = [];
      const renamed: RenamedItem[] = [];
      let successCount = 0;

      // 预处理：计算 newPath、验证输入，并收集需要执行的任务
      const tasks: { oldPath: string; newPath: string }[] = [];

      for (const file of files) {
        const oldPath = file?.oldPath;
        const newName = file?.newName;
        const legacyNewPath = file?.newPath;

        if (!oldPath || typeof oldPath !== 'string') {
          errors.push({ path: '未知路径', error: 'oldPath 不能为空' });
          continue;
        }

        if (!path.isAbsolute(oldPath)) {
          errors.push({ path: oldPath, error: 'oldPath 必须是绝对路径（请从文件管理器拖入文件）' });
          continue;
        }

        let newPath: string | undefined;
        if (typeof newName === 'string' && newName.trim()) {
          const nameOnly = newName.trim();
          if (path.basename(nameOnly) !== nameOnly) {
            errors.push({ path: oldPath, error: '新文件名不能包含路径分隔符' });
            continue;
          }
          if (isWindowsPlatform()) {
            const valid = isValidWindowsFileName(nameOnly);
            if (!valid.ok) {
              errors.push({ path: oldPath, error: `新文件名非法：${valid.reason}` });
              continue;
            }
          }
          newPath = path.join(path.dirname(oldPath), nameOnly);
        } else if (typeof legacyNewPath === 'string' && legacyNewPath.trim()) {
          newPath = legacyNewPath.trim();
        } else {
          errors.push({ path: oldPath, error: 'newName/newPath 不能为空' });
          continue;
        }

        if (!path.isAbsolute(newPath)) {
          errors.push({ path: oldPath, error: 'newPath 必须是绝对路径' });
          continue;
        }

        // 不支持移动目录：仅同目录重命名
        const oldDir = path.dirname(oldPath);
        const newDir = path.dirname(newPath);
        if (!isSamePathIgnoreCase(oldDir, newDir)) {
          errors.push({ path: oldPath, error: '不支持跨目录移动（仅支持同目录重命名）' });
          continue;
        }

        tasks.push({ oldPath, newPath });
      }

      // 验证源文件存在、目标名冲突（支持批量互换/循环重命名）
      const taskOldSet = new Set(tasks.map((t) => normalizePathForCompare(t.oldPath)));
      const taskNewSet = new Set<string>();
      const effectiveTasks: { oldPath: string; newPath: string }[] = [];

      for (const task of tasks) {
        // 检查源文件是否存在
        try {
          await fs.access(task.oldPath);
        } catch {
          errors.push({ path: task.oldPath, error: '文件不存在' });
          continue;
        }

        // 如果新旧路径相同（或 Windows 下仅大小写不同），仍然作为一次“成功”或“需要处理”的任务
        const oldNorm = normalizePathForCompare(task.oldPath);
        const newNorm = normalizePathForCompare(task.newPath);

        // 目标重复（同一次批量中）
        if (taskNewSet.has(newNorm)) {
          errors.push({ path: task.oldPath, error: '批量重命名中存在重复的目标文件名' });
          continue;
        }
        taskNewSet.add(newNorm);

        // old === new：直接算成功（无需文件系统操作）
        if (task.oldPath === task.newPath) {
          successCount++;
          continue;
        }

        // 检查目标文件是否已存在：
        // - 若目标是本批次的某个 oldPath：允许（会先挪走到 temp）
        // - 若 Windows 下仅大小写更改：允许（需要两步重命名）
        // - 否则：报错
        try {
          await fs.access(task.newPath);
          const isTargetInBatch = taskOldSet.has(newNorm);
          const isCaseOnly = isWindowsPlatform() && oldNorm === newNorm;
          if (!isTargetInBatch && !isCaseOnly) {
            errors.push({
              path: task.oldPath,
              error: `目标文件已存在: ${path.basename(task.newPath)}`
            });
            continue;
          }
        } catch {
          // 目标不存在，可以继续
        }

        effectiveTasks.push(task);
      }

      // 两阶段重命名：old -> temp -> new，避免互换/循环/大小写重命名失败
      const movedToTemp: { oldPath: string; tempPath: string; newPath: string }[] = [];

      try {
        for (let index = 0; index < effectiveTasks.length; index++) {
          const task = effectiveTasks[index];
          const dir = path.dirname(task.oldPath);
          const ext = path.extname(task.oldPath);
          const tempPath = await makeUniqueTempPath(dir, ext, String(index));
          await fs.rename(task.oldPath, tempPath);
          movedToTemp.push({ oldPath: task.oldPath, tempPath, newPath: task.newPath });
        }

        for (const moved of movedToTemp) {
          await fs.rename(moved.tempPath, moved.newPath);
          successCount++;
          renamed.push({ oldPath: moved.oldPath, newPath: moved.newPath });
        }
      } catch (error) {
        // 尝试回滚已移动到 temp 的文件，避免留下临时文件名
        for (let i = movedToTemp.length - 1; i >= 0; i--) {
          const moved = movedToTemp[i];
          try {
            await fs.rename(moved.tempPath, moved.oldPath);
          } catch {
            // ignore rollback failures
          }
        }
        const message = error instanceof Error ? error.message : '未知错误';
        errors.push({ path: '批量重命名', error: message });
      }

      return { successCount, errors, renamed };
    }
  );
}
