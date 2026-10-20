import type { JsonObject, ParseContext } from '../types';
import { text, templateMarker } from './text';
export function number(
  info: JsonObject,
  keys: string[],
  field: string,
  context: ParseContext,
): string {
  const values = keys.map((key) => text(info[key])).filter(Boolean);
  if (new Set(values).size > 1)
    context.report(
      'ambiguous_field',
      'Conflicting explicit question numbers; using ' + keys[0],
      field,
      'warning',
    );
  if (!values.length)
    context.report(
      'missing_number',
      'No explicit question number; source order is retained',
      field,
    );
  if (values[0] && keys.length > 1 && !text(info[keys[0]]))
    context.variant(field, 'Alternative numbering field ' + keys[1]);
  return values[0] || '';
}
export function officialNumber(value: unknown, context: ParseContext): string | undefined {
  const marker = templateMarker(value);
  return marker ? context.officialNumbers?.get(marker) : undefined;
}
