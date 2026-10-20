import { expect, it } from 'vitest';
import { parseDocument, parseDocumentResult } from '../../src/core/parser';
const source = 'bank/p/content_dialogue/content.json';
it('keeps keywords supplementary and all references ordered', () => {
  const q = parseDocument(
    {
      structure_type: 'collector.dialogue',
      info: {
        stid: 'g',
        question: [
          {
            xh: '1',
            ask: 'Prompt',
            keywords: 'river; town',
            answer: 'Explicit',
            std: [{ value: 'First' }],
            ref: [{ value: 'Last' }],
          },
        ],
      },
    },
    source,
  );
  expect(q.parts[0].answers.map((a) => a.text)).toEqual(['Explicit', 'First', 'Last']);
  expect(q.parts[0].supplements).toContainEqual({ label: 'Keywords', text: 'river; town' });
});
it('accepts missing local numbers and preserves valid questions after a malformed row', () => {
  const r = parseDocumentResult(
    {
      structure_type: 'collector.dialogue',
      info: { stid: 'g', question: [{ ask: 'Good', std: [] }, { ask: { bad: true } }] },
    },
    source,
  );
  expect(r.question?.parts).toHaveLength(1);
  expect(r.partial).toBe(true);
});
it('rejects empty dialogue structures and malformed answers', () => {
  for (const question of [[], [{}], [{ ask: 'Prompt', std: 'bad' }]])
    expect(() =>
      parseDocument(
        { structure_type: 'collector.dialogue', info: { stid: 'g', question } },
        source,
      ),
    ).toThrow();
});
