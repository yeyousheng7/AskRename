import type { FileItem } from '@/types/file';
import { electronApi } from '@/lib/electron-api';

export function isAbsolutePathLike(p: string): boolean {
  if (!p) return false;
  // Windows: C:\ or C:/, or UNC \\server\share
  if (/^[a-zA-Z]:[\\/]/.test(p) || /^\\\\/.test(p)) return true;
  // POSIX: /home/...
  return p.startsWith('/');
}

export function extractFilePathsFromDataTransfer(dt: DataTransfer): string[] {
  const uriList = dt.getData('text/uri-list') || dt.getData('text/plain') || '';
  const lines = uriList
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const paths: string[] = [];

  for (const line of lines) {
    if (!line.toLowerCase().startsWith('file:')) continue;
    try {
      const url = new URL(line);
      const host = url.host;
      const pathname = decodeURIComponent(url.pathname);

      // Windows: file:///C:/Users/... -> C:\Users\...
      if (/^\/[a-zA-Z]:\//.test(pathname)) {
        paths.push(pathname.slice(1).replaceAll('/', '\\'));
        continue;
      }

      // Windows UNC: file://server/share/path -> \\server\share\path
      if (host) {
        const unc = `\\\\${host}${pathname}`.replaceAll('/', '\\');
        paths.push(unc);
        continue;
      }

      // POSIX: file:///home/... -> /home/...
      paths.push(pathname);
    } catch {
      // ignore parse failures
    }
  }

  return paths.filter(isAbsolutePathLike);
}

export function getElectronFilePath(file: File): string {
  try {
    return (electronApi.getPathForFile(file) || '').trim();
  } catch {
    // ignore
  }

  const compatibilityFile = file as unknown as { path?: string };
  return (compatibilityFile.path || '').trim();
}

export function toFileItemsFromDataTransferFiles(
  files: File[],
  fallbackPaths: string[]
): FileItem[] {
  const rawPaths = files.map((f) => getElectronFilePath(f));
  return files.map((file, index) => {
    const rawPath = rawPaths[index] || '';
    const pathFromUri = fallbackPaths[index] || '';
    const finalPath = isAbsolutePathLike(rawPath) ? rawPath : pathFromUri;

    return {
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      original: file.name,
      renamed: file.name,
      path: finalPath || file.name,
      renameOrigin: 'initial'
    };
  });
}
