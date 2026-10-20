import { classifyMedia, sniffMedia } from './classify';
import { assetPath } from './paths';
import { imageHeader, MAX_IMAGE_BYTES } from './imageHeader';
import { mediaError, type ResolvedMedia } from './types';
export const MAX_MEDIA_BYTES = 32 * 1024 ** 2;
export async function resolveMedia(
  reference: string,
  source: string,
  assets: Map<string, Blob>,
): Promise<ResolvedMedia> {
  const { resolvedPath, candidates, blob } = assetPath(reference, source, assets),
    hint = classifyMedia(resolvedPath, blob.type);
  if (hint.kind === 'data' || hint.kind === 'unknown')
    throw mediaError('unsupported_type', reference, source, hint.kind, candidates, resolvedPath);
  if (!blob.size || blob.size > (hint.kind === 'image' ? MAX_IMAGE_BYTES : MAX_MEDIA_BYTES))
    throw mediaError('size_limit', reference, source, hint.kind, candidates, resolvedPath);
  let actual;
  try {
    actual = await sniffMedia(blob, resolvedPath);
  } catch {
    throw mediaError('file_read', reference, source, hint.kind, candidates, resolvedPath);
  }
  if (actual.kind === 'unknown')
    throw mediaError('unsupported_type', reference, source, hint.kind, candidates, resolvedPath);
  if (actual.kind !== hint.kind)
    throw mediaError('type_mismatch', reference, source, hint.kind, candidates, resolvedPath);
  const diagnostics = [];
  if (
    actual.mimeType !== hint.mimeType ||
    (blob.type && blob.type.toLowerCase().split(';')[0] !== actual.mimeType)
  )
    diagnostics.push({
      ...mediaError('type_mismatch', reference, source, actual.kind, candidates, resolvedPath)
        .diagnostic,
      severity: 'info' as const,
      message: 'Validated content type overrides inaccurate MIME/extension metadata',
    });
  let header;
  if (actual.kind === 'image')
    try {
      header = await imageHeader(blob);
    } catch {
      throw mediaError('image_decode', reference, source, 'image', candidates, resolvedPath);
    }
  return {
    kind: actual.kind as ResolvedMedia['kind'],
    sourcePath: source,
    resolvedPath,
    mimeType: actual.mimeType,
    blob,
    header,
    diagnostics,
  };
}
