import type { Issue } from '../types';
/** Display virtual references only; never expose imported absolute filesystem paths. */
export function diagnosticReference(issue: Issue): string | undefined {
  const value = issue.reference;
  if (
    !value?.trim() ||
    value === '[unsafe external or absolute reference]' ||
    /^(?:[a-z][a-z0-9+.-]*:|[\\/])/i.test(value)
  )
    return;
  return value;
}
export function issueTitle(issue: Issue): string {
  const label = (
    { image: 'Image', audio: 'Audio', video: 'Video', data: 'Resource', unknown: 'Media' } as const
  )[issue.mediaKind || 'unknown'];
  switch (issue.category) {
    case 'file_not_found':
      return `${label} not found`;
    case 'missing_reference':
      return `${label} reference is missing`;
    case 'unsafe_path':
      return `Unsafe ${label.toLowerCase()} resource path`;
    case 'ambiguous_path':
      return `${label} reference is ambiguous`;
    case 'unsupported_type':
      return `Unsupported ${label.toLowerCase()} format`;
    case 'type_mismatch':
      return `${label} type does not match the file`;
    case 'image_decode':
      return 'Image could not be decoded';
    case 'audio_playback':
      return 'Audio playback failed';
    case 'video_playback':
      return 'Video playback failed';
    case 'file_read':
      return `${label} could not be read`;
    case 'blob_lifecycle':
      return `${label} resource is no longer available`;
    case 'size_limit':
      return `${label} exceeds the resource size limit`;
    default:
      return issue.message;
  }
}
export function issueMessage(issue: Issue): string {
  const title = issueTitle(issue),
    reference = diagnosticReference(issue);
  return issue.category && reference ? `${title}: ${reference}` : title;
}
/** One entry per underlying failure in its source record; informational entries stay diagnostic-only. */
export function importWarnings(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (issue.severity === 'info') return false;
    const media = !!issue.category && !!issue.mediaKind;
    const key = JSON.stringify([
      issue.path,
      issue.questionId,
      issue.severity || 'warning',
      issue.code,
      issue.messageKey,
      issue.messageParams,
      issue.category,
      issue.mediaKind,
      issue.reference,
      issue.resolvedPath,
      media && diagnosticReference(issue) ? undefined : issue.field,
      media ? undefined : issue.message,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
