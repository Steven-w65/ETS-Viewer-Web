import type { JsonObject, ParseContext } from '../types';
import { rows } from './validation';
import { images, harmlessMetadata } from './fields';
import { prompt, text } from './text';
import { references } from './answers';
import { number, officialNumber } from './numbering';
import { ParseError } from '../diagnostics';
import { mediaFields } from './media';
export function questionList(info: JsonObject, context: ParseContext, allowStrings = false) {
  const q = context.createQuestion();
  q.context = text(info.value);
  q.images = images(info, 'image');
  const seen = new Set<string>();
  q.parts = rows(info.question, 'info.question', context, (row, i) => {
    const field = `info.question[${i}]`,
      n = number(row, ['xh'], field, context);
    if (n && seen.has(n))
      context.report(
        'invalid_numbering',
        'Repeated local number; retaining separate questions in source order',
        field + '.xh',
        'warning',
      );
    seen.add(n);
    const p = context.createPart({
      number: n,
      officialNumber: officialNumber(row.ask, context),
      prompt: prompt(row.ask),
      images: images(row, 'askimg'),
      answers: references(row, field, allowStrings),
      explanation: text(row.analyze),
      metadata: harmlessMetadata(row, [
        'xh',
        'ask',
        'askimg',
        'std',
        'ref',
        'answer',
        'analyze',
        'keywords',
        'askaudio',
        'askvideo',
      ]),
    });
    const media = mediaFields(row, field, { askaudio: 'audio', askvideo: 'video' });
    if (media.length) p.media = media;
    if (!p.prompt && !p.images.length && !media.some((m) => m.reference))
      throw new ParseError(field + ' has no question content', field);
    const keywords = text(row.keywords);
    if (keywords) p.supplements = [{ label: 'Keywords', text: keywords }];
    if (allowStrings && Array.isArray(row.std) && row.std.some((v) => typeof v === 'string'))
      context.variant(field + '.std', 'String standard-answer variant');
    return p;
  });
  return q;
}
