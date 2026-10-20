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
/** Safe candidates within the owning resource; never search other folders by basename. */
export function ownedPaths(reference: string, source: string): string[] {
  const variants = [reference];
  try {
    const decoded = decodeURIComponent(reference);
    if (decoded !== reference) variants.push(decoded);
  } catch {
    /* A literal percent is valid. */
  }
  const paths: string[] = [],
    directory = parentPath(source),
    prefix = directory ? directory + '/' : '';
  let unsafe = false;
  for (const variant of variants)
    try {
      const path = normalizePath(
        variant
          .replace(/\\/g, '/')
          .split('/')
          .filter((segment) => segment !== '.')
          .join('/'),
      );
      paths.push(prefix + path);
      if (!path.startsWith('material/')) paths.push(prefix + 'material/' + path);
    } catch {
      unsafe = true;
    }
  return unsafe ? [] : [...new Set(paths)];
}
export function taskFolder(source: string): string {
  const folder = parentPath(source);
  return baseName(folder).startsWith('content_') ? parentPath(folder) : folder;
}
export function bankName(paths: string[], fallback: string): string {
  if (!paths.length) return fallback;
  const first = paths[0].split('/')[0];
  return paths.every((p) => p.startsWith(first + '/')) ? first : fallback;
}
