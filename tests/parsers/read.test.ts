import { expect, it } from 'vitest';
import { parseDocument, parseDocumentResult } from '../../src/core/parser';
const source = 'bank/p/content_read/content.json';
it('keeps paragraph formatting and legitimate answer absence without warnings', () => {
  const r = parseDocumentResult(
    {
      structure_type: 'collector.read',
      info: {
        stid: 'g',
        value: '<p>First.</p><p>Second.</p>',
        image: 'page.png',
        ai: 'Evaluator',
        answer: 'Not a stored answer',
      },
    },
    source,
  );
  expect(r.question?.parts[0].prompt).toBe('<p>First.</p><p>Second.</p>');
  expect(r.question?.parts[0].answers).toEqual([]);
  expect(r.diagnostics.filter((d) => d.severity !== 'info')).toEqual([]);
});
it('accepts image-only reading and rejects empty or malformed reading values', () => {
  expect(
    parseDocument(
      { structure_type: 'collector.read', info: { stid: 'g', image: 'page.png' } },
      source,
    ).parts[0].answers,
  ).toEqual([]);
  for (const info of [{ stid: 'g' }, { stid: 'g', value: [] }])
    expect(() => parseDocument({ structure_type: 'collector.read', info }, source)).toThrow();
});
