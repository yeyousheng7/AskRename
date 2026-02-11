import {
  Archive,
  Code,
  Cpu,
  File,
  FileText,
  Folder,
  Image as ImageIcon,
  Music,
  Video
} from 'lucide-react';

function getBaseName(fileName: string): string {
  const normalized = (fileName || '').trim();
  if (!normalized) return '';
  return normalized.split(/[\\/]/).pop() || normalized;
}

function getLowerExt(baseName: string): string {
  const dot = baseName.lastIndexOf('.');
  if (dot <= 0 || dot === baseName.length - 1) return '';
  return baseName.slice(dot + 1).toLowerCase();
}

function hasArchiveDoubleExt(baseName: string): boolean {
  const lower = baseName.toLowerCase();
  return lower.endsWith('.tar.gz') || lower.endsWith('.tar.bz2') || lower.endsWith('.tar.xz');
}

export function getFileIcon(fileName: string, isDirectory?: boolean): React.JSX.Element {
  if (isDirectory) {
    return <Folder className="h-4 w-4 text-yellow-500" aria-hidden="true" />;
  }

  const baseName = getBaseName(fileName);
  if (hasArchiveDoubleExt(baseName)) {
    return <Archive className="h-4 w-4 text-orange-500" aria-hidden="true" />;
  }

  const ext = getLowerExt(baseName);

  const video = new Set(['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'wmv', 'flv']);
  const audio = new Set(['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'aiff']);
  const archive = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz']);
  const code = new Set([
    'js',
    'jsx',
    'ts',
    'tsx',
    'json',
    'py',
    'html',
    'css',
    'scss',
    'less',
    'md',
    'yml',
    'yaml',
    'toml',
    'xml',
    'sql',
    'sh',
    'bat',
    'ps1',
    'java',
    'c',
    'cc',
    'cpp',
    'h',
    'hpp',
    'rs',
    'go',
    'php',
    'rb'
  ]);
  const docs = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv']);
  const system = new Set(['exe', 'msi', 'dmg', 'iso', 'apk', 'deb', 'rpm']);
  const images = new Set([
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'svg',
    'bmp',
    'tiff',
    'ico',
    'heic'
  ]);

  if (video.has(ext)) return <Video className="h-4 w-4 text-red-500" aria-hidden="true" />;
  if (audio.has(ext)) return <Music className="h-4 w-4 text-purple-500" aria-hidden="true" />;
  if (archive.has(ext)) return <Archive className="h-4 w-4 text-orange-500" aria-hidden="true" />;
  if (code.has(ext)) return <Code className="h-4 w-4 text-green-500" aria-hidden="true" />;
  if (docs.has(ext)) return <FileText className="h-4 w-4 text-blue-500" aria-hidden="true" />;
  if (system.has(ext)) return <Cpu className="h-4 w-4 text-slate-500" aria-hidden="true" />;
  if (images.has(ext)) return <ImageIcon className="h-4 w-4 text-teal-500" aria-hidden="true" />;

  return <File className="h-4 w-4 text-gray-400" aria-hidden="true" />;
}
