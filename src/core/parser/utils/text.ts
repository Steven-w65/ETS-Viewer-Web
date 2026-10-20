import { ParseError } from '../diagnostics';
export function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new ParseError('Expected a text field, found ' + typeof value, '', 'invalid_field');
  return String(value).trim();
}
export const prompt = (value: unknown) =>
  text(value)
    .replace(/^\s*ets_th\d+\s*/, '')
    .trim();
export const templateMarker = (value: unknown) => text(value).match(/^\s*(ets_th\d+)\b/)?.[1];
