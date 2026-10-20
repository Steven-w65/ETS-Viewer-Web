import { expect, it } from 'vitest';
import { parseDocument } from '../../src/core/parser';
const source = 'bank/p/content_word/content.json';
it('preserves the desktop word structure and ignores evaluator/answer fields', () => {
  const q = parseDocument(
    {
      structure_type: 'collector.word',
      info: {
        stid: 'g',
        xh: '2',
        value: 'ets_th2 Original sentence.',
        translate: '原文',
        analyze: 'Explanation',
        answer: 'Not reference',
        ai: 'Evaluator',
      },
    },
    source,
  );
  expect(q.parts[0]).toMatchObject({
    number: '2',
    prompt: 'Original sentence.',
    translation: '原文',
    explanation: 'Explanation',
    answers: [],
  });
});
it('handles optional fields and rejects malformed or empty word content', () => {
  expect(
    parseDocument({ structure_type: 'collector.word', info: { stid: 'g', value: 'Word' } }, source)
      .parts[0].translation,
  ).toBe('');
  for (const info of [{ stid: 'g' }, { stid: 'g', value: true }])
    expect(() => parseDocument({ structure_type: 'collector.word', info }, source)).toThrow();
});
