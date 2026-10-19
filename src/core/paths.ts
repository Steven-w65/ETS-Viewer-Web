/** Preserve Unicode and spaces; reject ambiguity instead of rewriting traversal. */
export function normalizePath(input: string): string {
  const path = input.replace(/\\/g, '/');
  if (!path || path.startsWith('/') || /[\x00-\x1f\x7f:]/.test(path))
    throw new Error('Unsafe archive or file path');
  const parts = path.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..'))
    throw new Error('Unsafe or ambiguous archive path');
  return path;
}
export const parentPath = (path: string) =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
export const baseName = (path: string) => path.split('/').at(-1) ?? '';
export function taskFolder(source: string): string {
  const folder = parentPath(source);
  return baseName(folder).startsWith('content_') ? parentPath(folder) : folder;
}
export function bankName(paths: string[], fallback: string): string {
  if (!paths.length) return fallback;
  const first = paths[0].split('/')[0];
  return paths.every((p) => p.startsWith(first + '/')) ? first : fallback;
}
