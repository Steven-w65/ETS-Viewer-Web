import { expect, it } from 'vitest';
import { parseDocument, parseDocumentResult } from '../../src/core/parser';
const source = 'bank/paper/content_fill/content.json';
it('supports xth and th, preserves slash text and never merges duplicate blank IDs', () => {
  const r = parseDocumentResult(
    {
      structure_type: 'collector.fill',
      info: {
        stid: 'fill',
        value: 'Shared passage',
        std: [
          { xth: '15', value: 'A/B' },
          { th: '16', value: '12/10/2026' },
          { xth: '15', value: 'Separate blank' },
          { value: 'Unnumbered' },
        ],
      },
    },
    source,
  );
  expect(r.question?.parts.map((p) => p.number)).toEqual(['15', '16', '15', '']);
  expect(r.question?.parts.map((p) => p.answers[0]?.text)).toEqual([
    'A/B',
    '12/10/2026',
    'Separate blank',
    'Unnumbered',
  ]);
  expect(r.question?.context).toBe('Shared passage');
  expect(r.diagnostics.some((d) => d.code === 'invalid_numbering')).toBe(true);
});
it('preserves missing answers without treating source text as an answer', () => {
  const q = parseDocument(
    { structure_type: 'collector.fill', info: { stid: 'g', std: [{ th: '1', value: '' }] } },
    source,
  );
  expect(q.parts[0].answers).toEqual([]);
});
it('diagnoses conflicting numbering and malformed fill values', () => {
  const r = parseDocumentResult(
    {
      structure_type: 'collector.fill',
      info: { stid: 'g', std: [{ xth: '15', th: '16', value: 'Original' }] },
    },
    source,
  );
  expect(r.question?.parts[0].number).toBe('15');
  expect(r.diagnostics.some((d) => d.code === 'ambiguous_field')).toBe(true);
  for (const std of [[], false, [{ value: { bad: true } }]])
    expect(() =>
      parseDocument({ structure_type: 'collector.fill', info: { stid: 'g', std } }, source),
    ).toThrow();
});
