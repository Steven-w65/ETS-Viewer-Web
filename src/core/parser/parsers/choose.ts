import type { QuestionTypeParser } from '../types';
import { rows, objects } from '../utils/validation';
import { text, prompt } from '../utils/text';
import { images, harmlessMetadata } from '../utils/fields';
import { answerKey, metadataAnswerMap } from '../utils/answers';
import { number, officialNumber } from '../utils/numbering';
import { ParseError } from '../diagnostics';
import { mediaFields } from '../utils/media';
export const chooseParser: QuestionTypeParser = {
  type: 'collector.choose',
  label: 'Multiple choice',
  parse(info, context) {
    const q = context.createQuestion(),
      map = metadataAnswerMap(context.metadata),
      seen = new Set<string>();
    const st = text(info.st_nr),
      value = text(info.value);
    q.context = st || value;
    if (st && value && st !== value) q.sharedMaterials = [{ label: 'Context', text: value }];
    q.instructions = text(info.st_sm);
    q.images = images(info, 'st_pic');
    q.parts = rows(info.xtlist, 'info.xtlist', context, (row, i) => {
      const field = `info.xtlist[${i}]`,
        nr = prompt(row.xt_nr),
        value = text(row.xt_value);
      const numberOnly = nr.match(/^(\d+)[.、．]?$/)?.[1];
      const n = number(row, ['xt_xh'], field, context) || numberOnly || '';
      const localId = text(row.xt_xh);
      if (n && seen.has(n))
        throw new ParseError(
          field + '.xt_xh must identify a distinct sub-question',
          field + '.xt_xh',
          'duplicate_identity',
        );
      seen.add(n);
      const fallback = !nr || !!numberOnly;
      const p = context.createPart({
        ...(mediaFields(row, field, { xt_wj: 'audio' }).length
          ? { media: mediaFields(row, field, { xt_wj: 'audio' }) }
          : {}),
        number: n,
        numberOrigin: localId ? 'source' : 'display',
        ...(numberOnly
          ? { sourceNumberLabels: [{ text: nr, field: field + '.xt_nr', source: context.source }] }
          : {}),
        officialNumber: officialNumber(row.xt_nr, context),
        prompt: fallback ? prompt(value) : nr,
        promptField: fallback ? 'xt_value' : 'xt_nr',
        context: fallback || value === nr ? '' : value,
        images: images(row, 'xt_pic'),
        explanation: text(row.xt_analy),
        metadata: harmlessMetadata(row, [
          'xt_xh',
          'xt_nr',
          'xt_value',
          'xt_pic',
          'xt_analy',
          'xxlist',
          'answer',
        ]),
      });
      if (fallback && value)
        context.variant(field + '.xt_value', 'Using xt_value as the question prompt');
      if (!(p.prompt || p.context || p.images.length || q.context))
        throw new ParseError(field + ' has no question content', field);
      const explicit = text(row.answer),
        key = answerKey(q.id, n);
      p.answers = explicit
        ? [{ text: explicit, field: field + '.answer' }]
        : q.identity?.origin === 'source' && !!localId && map.has(key)
          ? [map.get(key)!]
          : [];
      p.options = objects(row.xxlist, field + '.xxlist').map((o) => {
        const refs = images(o, 'xx_wj');
        if (refs.length) context.variant(field + '.xxlist.xx_wj', 'Image option');
        return {
          label: text(o.xx_mc),
          text: text(o.xx_nr),
          ...(refs.length ? { images: refs } : {}),
        };
      });
      return p;
    });
    return q;
  },
};
