export interface FileItem {
  id: string;
  original: string;
  renamed: string;
  path: string;
}

export type TargetMode = 'file' | 'folder';
