export interface FileItem {
  id: string;
  original: string;
  renamed: string;
  path: string;
  isDirectory?: boolean;

  /**
   * `renamed` 的来源：用于区分 AI 建议与用户手动编辑。
   * - initial: 初始态（renamed === original）
   * - ai: AI/智能模式生成的改名建议
   * - user: 用户在编辑框中手动修改
   * - rule: 正则/规则引擎批量生成
   */
  renameOrigin: 'initial' | 'ai' | 'user' | 'rule';
}

export type TargetMode = 'file' | 'folder';

export type RenameOrigin = FileItem['renameOrigin'];
