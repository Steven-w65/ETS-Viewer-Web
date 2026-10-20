import type { JsonObject, ParseContext } from '../types';
import { ParseError } from '../diagnostics';
export const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export function objects(value: unknown, field: string): JsonObject[] {
  if (value == null) return [];
  if (!Array.isArray(value) || !value.every(isObject))
    throw new ParseError(field + ' must be an array of objects', field, 'invalid_field');
  return value;
}
export function rows<T>(
  value: unknown,
  field: string,
  context: ParseContext,
  parse: (row: JsonObject, index: number) => T,
): T[] {
  if (!Array.isArray(value) || !value.length)
    throw new ParseError(field + ' must contain question rows', field);
  const result: T[] = [];
  for (const [i, row] of value.entries()) {
    try {
      if (!isObject(row))
        throw new ParseError('Question row must be an object', `${field}[${i}]`, 'invalid_field');
      result.push(parse(row, i));
    } catch (error) {
      if (error instanceof ParseError && error.code === 'duplicate_identity') throw error;
      context.report(
        'partial_record',
        error instanceof Error ? error.message : String(error),
        error instanceof ParseError && error.field ? error.field : `${field}[${i}]`,
        'warning',
      );
    }
  }
  if (!result.length) throw new ParseError(field + ' contains no valid questions', field);
  return result;
}
