import { expect, it } from 'vitest';
import { parseDocument, parseDocumentResult } from '../../src/core/parser';
const source = 'bank/resource/uuid-role/content.json';
it('parses each role question and retains its ordered answers and audio ownership', () => {
  const q = parseDocument(
    {
      structure_type: 'collector.role',
      info: {
        stid: 'role',
        value: 'Shared conversation',
        question: [
          {
            ask: 'Where?',
            askaudio: 'content_1.mp3',
            std: [{ value: 'Library' }, { value: 'In the library' }],
          },
          { ask: 'When?', std: [] },
        ],
      },
    },
    source,
  );
  expect(q.parts).toHaveLength(2);
  expect(q.parts[0].answers.map((a) => a.text)).toEqual(['Library', 'In the library']);
  expect(q.parts[1].answers).toEqual([]);
  expect(q.parts[0].media).toContainEqual({
    kind: 'audio',
    reference: 'content_1.mp3',
    field: 'info.question[0].askaudio',
  });
});
it('uses a resource locator for missing stid without inventing an original ID', () => {
  const r = parseDocumentResult(
    { structure_type: 'collector.role', info: { question: [{ ask: 'Prompt' }] } },
    source,
  );
  expect(r.question?.id).toBe('uuid-role');
  expect(r.question?.identity?.origin).toBe('resource');
  expect(r.diagnostics.some((d) => d.code === 'missing_identifier')).toBe(true);
});
it('rejects empty and malformed role structures', () => {
  for (const info of [
    { stid: 'g', question: [] },
    { stid: 'g', question: 'bad' },
    { stid: 'g', question: [{ ask: false }] },
  ])
    expect(() => parseDocument({ structure_type: 'collector.role', info }, source)).toThrow();
});
