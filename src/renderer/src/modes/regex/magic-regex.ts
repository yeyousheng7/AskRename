/**
 * Magic regex replace engine.
 * Supports ${i}, ${i0}, ${i00}, ${i000} sequence variables.
 */
import { safeReplace } from '@/lib/safe-replace';

function parseMagicVariables(replacement: string, absoluteIndex: number): string {
  const seq = absoluteIndex; // 1-based

  return replacement
    .replace(/\$\{i000\}/g, seq.toString().padStart(4, '0'))
    .replace(/\$\{i00\}/g, seq.toString().padStart(3, '0'))
    .replace(/\$\{i0\}/g, seq.toString().padStart(2, '0'))
    .replace(/\$\{i\}/g, seq.toString());
}

export function applyMagicRegex(
  filename: string,
  findPattern: string,
  replacePattern: string,
  index: number,
  startIndex = 1
): string {
  if (!findPattern.trim()) return filename;

  try {
    const regex = new RegExp(findPattern, 'g');
    const processedReplacement = parseMagicVariables(replacePattern, startIndex + index);
    return safeReplace(filename, regex, processedReplacement);
  } catch {
    return filename;
  }
}

export function batchApplyMagicRegex(
  filenames: string[],
  findPattern: string,
  replacePattern: string,
  startIndex = 1
): string[] {
  return filenames.map((name, index) =>
    applyMagicRegex(name, findPattern, replacePattern, index, startIndex)
  );
}
