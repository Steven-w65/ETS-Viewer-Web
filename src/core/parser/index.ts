import { questionKindLabel, type Kind, type Question } from '../../types';
import { plainText } from '../markup';
import { parserRegistry } from './registry';
import { createContext } from './context';
import { ParseError } from './diagnostics';
import { isObject, objects } from './utils/validation';
import type { ParseOptions, ParseResult } from './types';
export { metadataAnswerMap } from './utils/answers';
export function parseDocumentResult(
  input: unknown,
  source: string,
  metadata?: unknown,
  options: ParseOptions = {},
): ParseResult {
  const result: ParseResult = { diagnostics: [], partial: false };
  try {
    let data = input;
    if (Array.isArray(data)) {
      metadata = data;
      const wrapper = objects(data, 'metadata').find((x) => x.code_id === 'content_choose');
      if (!wrapper || typeof wrapper.code_json_obj !== 'string')
        throw new ParseError('Metadata does not contain a complete supported question');
      data = { structure_type: 'collector.choose', info: JSON.parse(wrapper.code_json_obj) };
    }
    if (!isObject(data)) throw new ParseError('No supported ETS collector schema');
    const type = typeof data.structure_type === 'string' ? data.structure_type : '';
    result.structureType = type || undefined;
    const parser = parserRegistry.get(type as Kind);
    if (!parser)
      throw new ParseError(
        'Unsupported question format: ' + (type || 'no collector schema'),
        'structure_type',
        'unsupported_structure',
      );
    if (!isObject(data.info))
      throw new ParseError('info must be an object', 'info', 'invalid_field');
    const context = createContext(
      data.info,
      source,
      parser.type,
      metadata,
      result.diagnostics,
      options,
    );
    const question = parser.parse(data.info, context);
    if (!question.parts.length) throw new ParseError('Question group has no sub-questions', 'info');
    question.typeLabel = parser.label;
    result.question = question;
    result.partial = result.diagnostics.some((d) => d.code === 'partial_record');
  } catch (error) {
    result.diagnostics.push({
      path: source,
      severity: 'error',
      code: error instanceof ParseError ? error.code : 'invalid_field',
      field: error instanceof ParseError ? error.field : '',
      structureType: result.structureType,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return result;
}
export function parseDocument(
  input: unknown,
  source: string,
  metadata?: unknown,
  options?: ParseOptions,
): Question {
  const result = parseDocumentResult(input, source, metadata, options);
  if (!result.question) throw new Error(result.diagnostics.map((d) => d.message).join('; '));
  return result.question;
}
const titles = new WeakMap<Question, string>();
export function questionTitle(q: Question): string {
  if (!titles.has(q))
    titles.set(
      q,
      plainText(
        q.displayTitle ||
          q.topic ||
          q.parts.find((p) => p.prompt || p.context)?.prompt ||
          q.parts.find((p) => p.prompt || p.context)?.context ||
          q.context,
      ) || questionKindLabel(q),
    );
  return titles.get(q)!;
}
