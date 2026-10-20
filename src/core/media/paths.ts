import { normalizePath, ownedPaths } from '../paths';
import { classifyMedia } from './classify';
import { mediaError } from './types';
export function assetPath(
  reference: string,
  source: string,
  assets: Map<string, Blob>,
): { resolvedPath: string; candidates: string[]; blob: Blob } {
  const kind = classifyMedia(reference).kind;
  if (!reference.trim()) throw mediaError('missing_reference', reference, source, kind);
  const candidates = ownedPaths(reference, source);
  try {
    normalizePath(source);
  } catch {
    throw mediaError('unsafe_path', reference, '[invalid source path]', kind);
  }
  if (!candidates.length) throw mediaError('unsafe_path', reference, source, kind);
  const matches = candidates.filter((path) => assets.has(path));
  if (!matches.length) throw mediaError('file_not_found', reference, source, kind, candidates);
  if (matches.length > 1) throw mediaError('ambiguous_path', reference, source, kind, candidates);
  return { resolvedPath: matches[0], candidates, blob: assets.get(matches[0])! };
}
