export function splitFileName(name: string): { base: string; ext: string } {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === name.length - 1) return { base: name, ext: '' };
  return { base: name.slice(0, dotIndex), ext: name.slice(dotIndex) };
}

export function getExtension(name: string): string {
  return splitFileName(name).ext;
}

/**
 * If `newName` has no extension but `originalName` does, append it.
 * If `newName` already has an extension, keep it unchanged.
 */
export function ensureExtension(newName: string, originalName: string): string {
  const newExt = getExtension(newName);
  if (newExt) return newName;

  const originalExt = getExtension(originalName);
  if (!originalExt) return newName;

  return newName + originalExt;
}
