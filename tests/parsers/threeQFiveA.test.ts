import { expect, it } from 'vitest';
import { parseDocument } from '../../src/core/parser';
const source = 'bank/resource/three/content2.json';
it('keeps 3q5a alternatives as answers of their original question', () => {
  const q = parseDocument(
    {
      structure_type: 'collector.3q5a',
      info: {
        question: [
          { ask: 'Job?', std: [{ value: 'Teacher' }, { value: 'He teaches' }] },
          { ask: 'Place?', std: ['A school', { value: 'At school' }] },
        ],
      },
    },
    source,
  );
  expect(q.parts).toHaveLength(2);
  expect(q.parts.map((p) => p.answers.map((a) => a.text))).toEqual([
    ['Teacher', 'He teaches'],
    ['A school', 'At school'],
  ]);
});
it('accepts missing answers and rejects empty or malformed question lists', () => {
  expect(
    parseDocument(
      { structure_type: 'collector.3q5a', info: { question: [{ ask: 'Prompt' }] } },
      source,
    ).parts[0].answers,
  ).toEqual([]);
  for (const question of [[], {}, [{}]])
    expect(() =>
      parseDocument({ structure_type: 'collector.3q5a', info: { question } }, source),
    ).toThrow();
});
