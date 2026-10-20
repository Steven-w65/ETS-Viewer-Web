import type { Question, SubQuestion } from '../../types';
import type { JsonObject, ParseContext, ParseOptions } from './types';
import { baseName, parentPath } from '../paths';
import { text } from './utils/text';
import { harmlessMetadata } from './utils/fields';
import { mediaFields } from './utils/media';
export function createContext(
  info: JsonObject,
  source: string,
  kind: Question['kind'],
  metadata: unknown,
  diagnostics: ParseContext['diagnostics'],
  options: ParseOptions,
): ParseContext {
  const originalId = text(info.stid),
    resourceId = baseName(parentPath(source)) || baseName(source);
  const id = originalId || resourceId;
  const context: ParseContext = {
    source,
    kind,
    id,
    metadata,
    diagnostics,
    officialNumbers: options.officialNumbers,
    createQuestion: () => ({
      ...(mediaFields(info, 'info').length ? { media: mediaFields(info, 'info') } : {}),
      id,
      kind,
      source,
      parts: [],
      context: '',
      instructions: '',
      topic: '',
      images: [],
      explanation: '',
      keyPoints: '',
      identity: {
        origin: originalId ? 'source' : 'resource',
        ...(originalId ? { originalId } : {}),
        resourceId,
      },
      ...(options.displayTitle ? { displayTitle: options.displayTitle } : {}),
      metadata: harmlessMetadata(info, [
        'stid',
        'xtlist',
        'question',
        'std',
        'ref',
        'value',
        'st_nr',
        'st_sm',
        'st_pic',
        'image',
        'topic',
        'keypoint',
        'analyze',
        'translate',
        'xh',
      ]),
    }),
    createPart: (values: Partial<SubQuestion> = {}) => ({
      number: '',
      prompt: '',
      context: '',
      options: [],
      answers: [],
      explanation: '',
      images: [],
      translation: '',
      ...values,
    }),
    report(code, message, field = '', severity = 'info') {
      diagnostics.push({
        path: source,
        structureType: kind,
        questionId: id,
        code,
        message,
        field,
        severity,
      });
    },
    variant(field, message) {
      context.report('field_variant', message, field);
    },
  };
  if (!originalId)
    context.report('missing_identifier', 'No stid; using the owning resource locator', 'info.stid');
  return context;
}
