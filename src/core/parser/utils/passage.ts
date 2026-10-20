import type { JsonObject, ParseContext } from '../types';
import { prompt, text } from './text';
import { images } from './fields';
import { officialNumber } from './numbering';
import { ParseError } from '../diagnostics';
export function passage(info: JsonObject, context: ParseContext) {
  const q = context.createQuestion();
  if (!prompt(info.value) && !images(info, 'image').length && !q.media?.some((m) => m.reference))
    throw new ParseError('Word/reading record has no question content', 'info.value');
  q.parts = [
    context.createPart({
      number: text(info.xh),
      officialNumber: officialNumber(info.value, context),
      prompt: prompt(info.value),
      explanation: text(info.analyze),
      translation: text(info.translate),
    }),
  ];
  q.images = images(info, 'image');
  return q;
}
