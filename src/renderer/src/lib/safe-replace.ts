export function normalizeBackreferenceSyntax(replacement: string): string {
  return replacement.replace(/(^|[^\\])\\(\d+)/g, (_match, prefix: string, group: string) => {
    return `${prefix}$${group}`;
  });
}

function escapeLiteralDollar(replacement: string): string {
  return replacement.replace(/\$(?![$&`'\d<])/g, '$$$$');
}

export function safeReplace(input: string, regex: RegExp, replacement: string): string {
  const normalized = normalizeBackreferenceSyntax(replacement);
  const escaped = escapeLiteralDollar(normalized);
  return input.replace(regex, escaped);
}
