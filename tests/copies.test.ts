import { expect, it } from 'vitest';
import { scanBank } from '../src/core/scanner';
const doc = (id = 'g', rows: unknown[] = [{ xt_xh: '1', xt_nr: 'Prompt', answer: 'A' }]) => ({
  structure_type: 'collector.choose',
  info: { stid: id, xtlist: rows },
});
const scan = (a: unknown, b: unknown) =>
  scanBank(
    [
      { path: 'bank/p/content_1/content.json', blob: new Blob([JSON.stringify(a)]) },
      { path: 'bank/p/content_1/content2.json', blob: new Blob([JSON.stringify(b)]) },
    ],
    'bank',
  );
it('deduplicates equivalent copies including a matching explicit numeric prompt prefix', async () => {
  const b = await scan(doc(), doc('g', [{ xt_xh: '1', xt_nr: '1. Prompt', answer: 'A' }]));
  expect(b.papers[0].questions).toHaveLength(1);
  expect(b.papers[0].questions[0].sourceFiles).toHaveLength(2);
  expect(b.diagnostics?.some((d) => d.code === 'equivalent_copy')).toBe(true);
});
it('merges complementary data only by stable group and local question IDs', async () => {
  const b = await scan(
    doc('g', [{ xt_xh: '1', xt_nr: 'Prompt' }]),
    doc('g', [
      { xt_xh: '1', xt_nr: 'Prompt', answer: 'A' },
      { xt_xh: '2', xt_nr: 'Second', answer: 'B' },
    ]),
  );
  expect(b.papers[0].questions).toHaveLength(1);
  expect(b.papers[0].questions[0].parts.map((p) => p.answers[0]?.text)).toEqual(['A', 'B']);
  expect(b.diagnostics?.some((d) => d.code === 'complementary_copy')).toBe(true);
});
it('restores a real xt_nr when an incomplete copy promoted its transcript to prompt', async () => {
  const b = await scan(
    doc('g', [{ xt_xh: '1', xt_value: 'Transcript' }]),
    doc('g', [{ xt_xh: '1', xt_nr: '1. Real prompt', xt_value: 'Transcript' }]),
  );
  expect(b.papers[0].questions).toHaveLength(1);
  expect(b.papers[0].questions[0].parts[0]).toMatchObject({
    prompt: '1. Real prompt',
    context: 'Transcript',
  });
});
it('retains conflicting revisions and unrelated IDs instead of preferring a filename', async () => {
  const a = await scan(doc(), doc('g', [{ xt_xh: '1', xt_nr: 'Changed', answer: 'B' }]));
  expect(a.papers[0].questions).toHaveLength(2);
  expect(a.issues.some((d) => d.code === 'conflicting_copies')).toBe(true);
  const b = await scan(doc('one'), doc('two'));
  expect(b.papers[0].questions.map((q) => q.id)).toEqual(['one', 'two']);
});
it('never joins unnumbered or duplicate numbered rows by array position', async () => {
  const role = (ask: string) => ({
    structure_type: 'collector.role',
    info: { stid: 'g', question: [{ ask, std: [{ value: 'Answer' }] }] },
  });
  const b = await scan(role('One'), role('Other'));
  expect(b.papers[0].questions).toHaveLength(2);
});
it('recognizes verified copy numbering prefixes that differ from local IDs and retains the original variant', async () => {
  const b = await scan(doc(), doc('g', [{ xt_xh: '1', xt_nr: '6. Prompt', answer: 'A' }]));
  expect(b.papers[0].questions).toHaveLength(1);
  expect(b.papers[0].questions[0].parts[0].promptVariants).toContainEqual({
    source: 'bank/p/content_1/content2.json',
    text: '6. Prompt',
  });
  expect(b.papers[0].questions[0].parts[0].officialNumber).toBeUndefined();
});
it('retains changed numbered source sentences rather than stripping numbers from both revisions', async () => {
  const b = await scan(
    doc('g', [{ xt_xh: '1', xt_nr: '1984. The year', answer: 'A' }]),
    doc('g', [{ xt_xh: '1', xt_nr: '1985. The year', answer: 'A' }]),
  );
  expect(b.papers[0].questions).toHaveLength(2);
});
it('keeps resource locators and explicit source IDs in separate identity domains', async () => {
  const role = (stid?: string, answer?: string) => ({
    structure_type: 'collector.role',
    info: {
      ...(stid ? { stid } : {}),
      question: [{ xh: '1', ask: 'Prompt', ...(answer ? { std: [{ value: answer }] } : {}) }],
    },
  });
  const b = await scan(role(), role('content_1', 'Original'));
  expect(b.papers[0].questions).toHaveLength(2);
  const both = await scan(role(), role(undefined, 'Original'));
  expect(both.papers[0].questions).toHaveLength(2);
  const equivalent = await scan(role(), role());
  expect(equivalent.papers[0].questions).toHaveLength(1);
});
it('never uses display-derived numbers as source-local IDs in complementary copies', async () => {
  const a = doc('g', [{ xt_nr: '15.', xt_value: 'Prompt' }]);
  const b = await scan(a, doc('g', [{ xt_xh: '15', xt_nr: 'Prompt', answer: 'A' }]));
  expect(b.papers[0].questions).toHaveLength(2);
  const both = await scan(a, doc('g', [{ xt_nr: '15.', xt_value: 'Prompt', answer: 'A' }]));
  expect(both.papers[0].questions).toHaveLength(2);
});
