import type { TFunction } from 'i18next';
import type { Issue } from '../types';
const categories = new Set([
  'file_not_found',
  'missing_reference',
  'unsafe_path',
  'ambiguous_path',
  'unsupported_type',
  'type_mismatch',
  'image_decode',
  'audio_playback',
  'video_playback',
  'file_read',
  'blob_lifecycle',
  'size_limit',
]);
const codes: Readonly<Record<string, string>> = {
  invalid_json: 'diagnostics.invalid_json',
  invalid_file: 'diagnostics.invalid_file',
  invalid_field: 'diagnostics.invalid_field',
  unsupported_structure: 'diagnostics.unsupported_structure',
  partial_record: 'diagnostics.partial_record',
  invalid_numbering: 'diagnostics.invalid_numbering',
  duplicate_identity: 'diagnostics.duplicate_identity',
  ambiguous_field: 'diagnostics.ambiguous_field',
  conflicting_copies: 'diagnostics.conflicting_copies',
  ambiguous_metadata: 'diagnostics.metadata',
  missing_structure: 'diagnostics.missing_structure',
};
/** Localized presentation over the existing diagnostic, never over its source paths. */
export function translatedIssueTitle(issue: Issue, t: TFunction): string {
  const kind = issue.mediaKind ?? 'unknown';
  const key =
    issue.messageKey ||
    (issue.category && categories.has(issue.category)
      ? `diagnostics.${issue.category}`
      : codes[issue.code ?? '']) ||
    'diagnostics.generic';
  return t(key, {
    defaultValue: t('diagnostics.generic'),
    kind: t(`diagnostics.kind.${kind}`),
    kindLower: t(`diagnostics.kindLower.${kind}`),
    field: issue.field || t('warnings.resource'),
    structureType: issue.structureType || t('questionTypes.unknown'),
    ...issue.messageParams,
  });
}
