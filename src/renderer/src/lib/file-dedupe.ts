import type { FileItem } from '@/types/file';

function isWindowsPathLike(p: string): boolean {
  // Windows: C:\ or C:/, or UNC \\server\share
  return /^[a-zA-Z]:[\\/]/.test(p) || /^\\\\/.test(p);
}

export function normalizePathKey(p: string): string {
  const normalizedSlashes = p.replaceAll('/', '\\');
  return isWindowsPathLike(normalizedSlashes) ? normalizedSlashes.toLowerCase() : normalizedSlashes;
}

export function getDedupeKey(file: Pick<FileItem, 'path' | 'original'>): string {
  const p = (file.path || '').trim();
  if (p && (isWindowsPathLike(p) || p.startsWith('/'))) return `path:${normalizePathKey(p)}`;
  return `name:${file.original}`;
}
