import type { MetadataValue } from '../../../types';
import type { JsonObject } from '../types';
import { isObject } from './validation';
import { text } from './text';
export const images = (info: JsonObject, ...keys: string[]) =>
  keys.map((key) => text(info[key])).filter(Boolean);
// Keep bounded, inert format metadata; it is never rendered as HTML or interpreted as an answer.
export function harmlessMetadata(
  info: JsonObject,
  known: string[],
): Record<string, MetadataValue> | undefined {
  function safe(value: unknown, depth: number): MetadataValue | undefined {
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return value.slice(0, 1024);
    if (depth > 1) return undefined;
    if (Array.isArray(value))
      return value
        .slice(0, 32)
        .map((v) => safe(v, depth + 1))
        .filter((v): v is MetadataValue => v !== undefined);
    if (isObject(value)) return collect(value, [], depth + 1);
    return undefined;
  }
  function collect(
    obj: JsonObject,
    excluded: string[],
    depth: number,
  ): Record<string, MetadataValue> {
    const output: Record<string, MetadataValue> = Object.create(null);
    for (const [key, value] of Object.entries(obj).slice(0, 32)) {
      if (excluded.includes(key) || ['__proto__', 'constructor', 'prototype'].includes(key))
        continue;
      const item = safe(value, depth);
      if (item !== undefined) output[key] = item;
    }
    return output;
  }
  const output = collect(info, known, 0);
  return Object.keys(output).length ? output : undefined;
}
