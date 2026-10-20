import type { MediaReference } from '../../../types';
import type { JsonObject } from '../types';
import { text } from './text';
/** Only explicit, verified fields are interpreted as owned resources. */
export function mediaFields(
  info: JsonObject,
  field: string,
  fields: Readonly<Record<string, 'audio' | 'video'>> = { audio: 'audio', video: 'video' },
): MediaReference[] {
  const refs: MediaReference[] = [];
  for (const [key, kind] of Object.entries(fields)) {
    const value = info[key];
    if (value == null || value === '') continue;
    const reference = typeof value === 'string' || typeof value === 'number' ? text(value) : '';
    refs.push({ kind, reference, field: field + '.' + key });
  }
  return refs;
}
