import { expect, it } from 'vitest';
import { parseDocument, parseDocumentResult } from '../../src/core/parser';
const source = 'bank/p/content_1/content.json';
const parse = (item: unknown, extra = {}) =>
  parseDocument(
    { structure_type: 'collector.choose', info: { stid: 'g', xtlist: [item], ...extra } },
    source,
  );
it('keeps xt_nr as prompt and distinct xt_value as question-specific context', () => {
  const p = parse({
    xt_xh: '1',
    xt_nr: 'ets_th1 Which?',
    xt_value: 'M: First.\nW: Second.',
    answer: 'B',
  }).parts[0];
  expect(p.prompt).toBe('Which?');
  expect(p.context).toContain('M: First.');
  expect(p.answers[0].text).toBe('B');
});
it('uses xt_value when the prompt is absent and keeps shared value at group level', () => {
  const q = parse({ xt_xh: '1', xt_value: 'Which response?' }, { value: 'Shared passage' });
  expect(q.parts[0].prompt).toBe('Which response?');
  expect(q.parts[0].context).toBe('');
  expect(q.context).toBe('Shared passage');
});
it('preserves distinct st_nr and value without repeating shared material per part', () => {
  const q = parse({ xt_xh: '1', xt_nr: 'Prompt' }, { st_nr: 'Passage', value: 'Group transcript' });
  expect(q.context).toBe('Passage');
  expect(q.sharedMaterials).toContainEqual({ label: 'Context', text: 'Group transcript' });
  expect(q.parts[0].context).toBe('');
});
it('preserves text-only, image-only and combined options in source order', () => {
  const q = parse({
    xt_xh: '1',
    xt_nr: 'Choose',
    xxlist: [
      { xx_mc: 'A', xx_nr: 'Text' },
      { xx_mc: 'B', xx_wj: '图 片.jpg' },
      { xx_mc: 'C', xx_nr: 'Both', xx_wj: 'material/c.png' },
    ],
  });
  expect(q.parts[0].options).toEqual([
    { label: 'A', text: 'Text' },
    { label: 'B', text: '', images: ['图 片.jpg'] },
    { label: 'C', text: 'Both', images: ['material/c.png'] },
  ]);
});
it('keeps missing answers absent and diagnoses malformed options', () => {
  expect(parse({ xt_xh: '1', xt_nr: 'Prompt' }).parts[0].answers).toEqual([]);
  expect(() => parse({ xt_xh: '1', xt_nr: 'Prompt', xxlist: 'bad' })).toThrow();
  expect(() => parse({})).toThrow();
});
it('preserves an explicit question number embedded in a numbering-only xt_nr', () => {
  const q = parseDocumentResult(
    {
      structure_type: 'collector.choose',
      info: { stid: 'g', xtlist: [{ xt_nr: '15.', xt_value: 'Original question', answer: 'A' }] },
    },
    source,
  );
  expect(q.question?.parts[0]).toMatchObject({ number: '15', prompt: 'Original question' });
  expect(q.diagnostics.some((d) => d.code === 'field_variant')).toBe(true);
});
it('does not duplicate the prompt when both source fields are exactly equal', () => {
  const p = parse({ xt_xh: '1', xt_nr: 'Same prompt', xt_value: 'Same prompt' }).parts[0];
  expect(p.prompt).toBe('Same prompt');
  expect(p.context).toBe('');
});
it('requires original group and local IDs for metadata answers, while retaining inline answers', () => {
  const metadata = [
    {
      code_id: 'answer',
      code_json_array: JSON.stringify([
        { stid: 'content_1', xth: '1', answer: 'Wrong group join' },
        { stid: 'g', xth: '15', answer: 'Wrong local join' },
      ]),
    },
  ];
  const withoutGroup = {
    structure_type: 'collector.choose',
    info: { xtlist: [{ xt_xh: '1', xt_nr: 'Prompt' }] },
  };
  expect(
    parseDocument(withoutGroup, 'bank/p/content_1/content.json', metadata).parts[0].answers,
  ).toEqual([]);
  const withoutLocal = {
    structure_type: 'collector.choose',
    info: { stid: 'g', xtlist: [{ xt_nr: '15.', xt_value: 'Prompt' }] },
  };
  const p = parseDocument(withoutLocal, source, metadata).parts[0];
  expect(p.answers).toEqual([]);
  expect(p.number).toBe('15');
  expect(p.numberOrigin).toBe('display');
  expect(
    parseDocument(
      { ...withoutGroup, info: { xtlist: [{ xt_xh: '1', xt_nr: 'Prompt', answer: 'Inline' }] } },
      source,
      metadata,
    ).parts[0].answers[0].text,
  ).toBe('Inline');
});
it('retains numbering-only source labels independently of local and official numbers', () => {
  const p = parse({ xt_xh: '1', xt_nr: '15.', xt_value: 'Prompt' }).parts[0];
  expect(p.number).toBe('1');
  expect(p.officialNumber).toBeUndefined();
  expect(p.sourceNumberLabels).toContainEqual({
    text: '15.',
    field: 'info.xtlist[0].xt_nr',
    source,
  });
});
it('does not use a numbering-only display label for a metadata answer join', () => {
  const q = parseDocument(
    {
      structure_type: 'collector.choose',
      info: { stid: 'g', xtlist: [{ xt_nr: '15.', xt_value: 'Prompt' }] },
    },
    source,
    [
      {
        code_id: 'answer',
        code_json_array: '[{"stid":"g","xth":"15","answer":"Unsupported join"}]',
      },
    ],
  );
  expect(q.parts[0].answers).toEqual([]);
});
