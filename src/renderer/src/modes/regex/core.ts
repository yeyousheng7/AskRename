import { batchApplyMagicRegex } from '@/lib/magic-regex';
import type { FileItem } from '@/types/file';

export interface RegexParams {
  findPattern: string;
  replacePattern: string;
}

export async function executeRegex(files: FileItem[], params: RegexParams): Promise<FileItem[]> {
  const originals = files.map((f) => f.original);
  const nextNames = batchApplyMagicRegex(originals, params.findPattern, params.replacePattern);

  return files.map((file, index) => {
    const renamed = nextNames[index] ?? file.renamed;
    if (renamed === file.renamed) return file;
    return {
      ...file,
      renamed,
      renameOrigin: 'rule'
    };
  });
}
