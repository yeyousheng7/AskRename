/**
 * 魔法正则替换引擎
 * 支持 ${i}, ${i0}, ${i00}, ${i000} 等序号变量
 */

/**
 * 解析魔法变量并生成替换字符串
 * @param replacement - 原始替换模式（可能包含魔法变量）
 * @param index - 当前文件索引（0-based）
 * @returns 解析后的替换字符串
 */
function parseMagicVariables(replacement: string, index: number): string {
  const seq = index + 1; // 1-based 序号

  return replacement
    .replace(/\$\{i000\}/g, seq.toString().padStart(4, '0')) // 0001, 0002...
    .replace(/\$\{i00\}/g, seq.toString().padStart(3, '0')) // 001, 002...
    .replace(/\$\{i0\}/g, seq.toString().padStart(2, '0')) // 01, 02...
    .replace(/\$\{i\}/g, seq.toString()); // 1, 2, 3...
}

/**
 * 应用带魔法变量的正则替换
 * @param filename - 原始文件名
 * @param findPattern - 正则查找模式
 * @param replacePattern - 替换模式（支持魔法变量和正则组引用）
 * @param index - 当前文件索引（0-based）
 * @returns 替换后的文件名
 */
export function applyMagicRegex(
  filename: string,
  findPattern: string,
  replacePattern: string,
  index: number
): string {
  if (!findPattern.trim()) return filename;

  try {
    const regex = new RegExp(findPattern, 'g');
    // 先解析魔法变量，再进行正则替换（保留 $1, $2 等组引用）
    const processedReplacement = parseMagicVariables(replacePattern, index);
    return filename.replace(regex, processedReplacement);
  } catch {
    // 正则语法错误时保持原名
    return filename;
  }
}

/**
 * 批量应用魔法正则替换
 * @param filenames - 原始文件名数组
 * @param findPattern - 正则查找模式
 * @param replacePattern - 替换模式（支持魔法变量）
 * @returns 替换后的文件名数组
 */
export function batchApplyMagicRegex(
  filenames: string[],
  findPattern: string,
  replacePattern: string
): string[] {
  return filenames.map((name, index) => applyMagicRegex(name, findPattern, replacePattern, index));
}
