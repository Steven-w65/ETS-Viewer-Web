import type { StoredAnswer, MediaReference } from '../../../types';
import type { JsonObject } from '../types';
import { plainText } from '../../markup';
import { ParseError } from '../diagnostics';
import { objects, isObject } from './validation';
import { text } from './text';
import { mediaFields } from './media';
import { markupMedia } from '../../media/references';
/** A stored media answer is content even when it has no accompanying transcript. */
export function storedAnswer(
  value: string,
  field: string,
  media: MediaReference[] = [],
): StoredAnswer | undefined {
  if (!plainText(value) && !media.some((m) => m.reference) && !markupMedia(value, field).length)
    return;
  return { text: value, field, ...(media.length ? { media } : {}) };
}
export const answerKey = (stid: string, number: string) => JSON.stringify([stid, number]);
export function metadataAnswerMap(metadata: unknown): Map<string, StoredAnswer> {
  const result = new Map<string, StoredAnswer>();
  if (!Array.isArray(metadata)) return result;
  for (const entry of objects(metadata, 'metadata')) {
    if (entry.code_id !== 'answer' || !('code_json_array' in entry)) continue;
    if (typeof entry.code_json_array !== 'string')
      throw new ParseError('code_json_array must be JSON text', 'code_json_array', 'invalid_field');
    for (const [i, row] of objects(
      JSON.parse(entry.code_json_array),
      'code_json_array',
    ).entries()) {
      const stid = text(row.stid),
        number = text(row.xth),
        answer = text(row.answer);
      if (!stid || !number || !answer) continue;
      const key = answerKey(stid, number);
      if (result.has(key) && result.get(key)!.text !== answer)
        throw new ParseError(
          `Conflicting metadata answers for ${stid}/${number}`,
          'code_json_array',
          'ambiguous_field',
        );
      result.set(key, { text: answer, field: `info.json:answer[${i}].answer` });
    }
  }
  return result;
}
export function references(info: JsonObject, field: string, allowStrings = false): StoredAnswer[] {
  const result: StoredAnswer[] = [];
  const explicit = text(info.answer);
  if (explicit) result.push({ text: explicit, field: field + '.answer' });
  for (const key of ['std', 'ref']) {
    const values = info[key];
    if (values == null) continue;
    if (!Array.isArray(values))
      throw new ParseError(
        field + '.' + key + ' must be an array',
        field + '.' + key,
        'invalid_field',
      );
    for (const [i, row] of values.entries()) {
      const stringVariant = allowStrings && key === 'std' && typeof row === 'string';
      if (!stringVariant && !isObject(row))
        throw new ParseError(
          'Reference must be an object with a value',
          `${field}.${key}[${i}]`,
          'invalid_field',
        );
      const value = text(stringVariant ? row : (row as JsonObject).value);
      const media = stringVariant ? [] : mediaFields(row as JsonObject, `${field}.${key}[${i}]`);
      const answer = storedAnswer(
        value,
        `${field}.${key}[${i}]${stringVariant ? '' : '.value'}`,
        media,
      );
      if (answer) result.push(answer);
    }
  }
  return result;
}
