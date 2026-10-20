import type { QuestionTypeParser } from '../types';
import { rows } from '../utils/validation';
import { text } from '../utils/text';
import { number } from '../utils/numbering';
import { images } from '../utils/fields';
import { storedAnswer } from '../utils/answers';
import { mediaFields } from '../utils/media';
export const fillParser: QuestionTypeParser = {
  type: 'collector.fill',
  label: 'Fill in the blanks',
  parse(info, context) {
    const q = context.createQuestion(),
      seen = new Set<string>();
    const st = text(info.st_nr),
      value = text(info.value);
    q.context = st || value;
    q.images = images(info, 'image', 'st_pic');
    if (st && value && st !== value) q.sharedMaterials = [{ label: 'Context', text: value }];
    q.parts = rows(info.std, 'info.std', context, (row, i) => {
      const field = `info.std[${i}]`,
        n = number(row, ['xth', 'th'], field, context),
        value = text(row.value);
      if (n && seen.has(n))
        context.report(
          'invalid_numbering',
          'Repeated blank number; preserving each source row separately',
          field,
          'warning',
        );
      seen.add(n);
      const answer = storedAnswer(value, field + '.value', mediaFields(row, field));
      return context.createPart({
        number: n,
        answers: answer ? [answer] : [],
      });
    });
    return q;
  },
};
