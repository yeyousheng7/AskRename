export interface FileItem {
  id: string;
  original: string;
  renamed: string;
  path: string;
  isDirectory?: boolean;
}

export type TargetMode = 'file' | 'folder';
