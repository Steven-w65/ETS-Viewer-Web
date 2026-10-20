import type { Issue } from '../../types';
export type MediaKind = 'image' | 'audio' | 'video' | 'unknown';
export type AssetKind = MediaKind | 'data';
export type FailureCategory =
  | 'missing_reference'
  | 'file_not_found'
  | 'file_read'
  | 'unsafe_path'
  | 'ambiguous_path'
  | 'unsupported_type'
  | 'type_mismatch'
  | 'image_decode'
  | 'audio_playback'
  | 'video_playback'
  | 'blob_lifecycle'
  | 'size_limit';
export interface MediaDiagnostic extends Issue {
  reference: string;
  mediaKind: AssetKind;
  candidates: string[];
  resolvedPath?: string;
  category: FailureCategory;
}
export interface ResolvedMedia {
  kind: Exclude<MediaKind, 'unknown'>;
  sourcePath: string;
  resolvedPath: string;
  mimeType: string;
  blob: Blob;
  header?: { width: number; height: number; mime: string };
  diagnostics: MediaDiagnostic[];
}
export class MediaError extends Error {
  constructor(public diagnostic: MediaDiagnostic) {
    super(diagnostic.message);
    this.name = 'MediaError';
  }
}
export function mediaError(
  category: FailureCategory,
  reference: string,
  source: string,
  kind: AssetKind,
  candidates: string[] = [],
  resolvedPath?: string,
): MediaError {
  const safeRef = /^(?:[a-z][a-z0-9+.-]*:|[\\/])/i.test(reference)
    ? '[unsafe external or absolute reference]'
    : reference;
  return new MediaError({
    path: source,
    reference: safeRef,
    mediaKind: kind,
    candidates,
    resolvedPath,
    category,
    code: category === 'file_not_found' ? 'missing_media' : 'media_' + category,
    severity: 'warning',
    message: category.replaceAll('_', ' '),
  });
}
