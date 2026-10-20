import { expect, it } from 'vitest';
import { scanBank } from '../src/core/scanner';
const vf = (path: string, data: unknown) => ({ path, blob: new Blob([JSON.stringify(data)]) });
const role = (id: string) => ({
  structure_type: 'collector.role',
  info: { stid: id, question: [{ xh: '1', ask: 'ets_th7 Prompt', std: [{ value: 'Original' }] }] },
});
it('uses explicit Android data/resource relationships and section ordering', async () => {
  const bank = await scanBank(
    [
      vf('bank/data/paper-7', {
        name: 'Named paper',
        sectionData: [{ sectionItemData: [{ fileName: 'uuid-b' }, { fileName: 'uuid-a' }] }],
      }),
      vf('bank/resource/uuid-a/content.json', role('a')),
      vf('bank/resource/uuid-b/content2.json', role('b')),
    ],
    'bank',
  );
  expect(bank.papers).toHaveLength(1);
  expect(bank.papers[0].id).toBe('paper-7');
  expect(bank.papers[0].questions.map((q) => q.id)).toEqual(['b', 'a']);
  expect(bank.issues).toEqual([]);
});
it('supports items and byId metadata, preserving exact identifiers and per-resource template mappings', async () => {
  const bank = await scanBank(
    [
      vf('bank/index.json', {
        items: [{ id: 'p-id', name: 'Display', fileIdentifiers: ['uuid-a'] }],
      }),
      vf('bank/resource/uuid-a/content.json', role('g')),
      vf('bank/resource/uuid-a/res.json', {
        exam_type_list: [
          {
            exam_type_collect: 'collector.role',
            exam_type_name: 'Interview',
            exam_list: [{ exam_id: 'g', exam_info: [{ value: 'ets_th7 15' }] }],
          },
        ],
      }),
    ],
    'bank',
  );
  expect(bank.papers[0].id).toBe('p-id');
  expect(bank.papers[0].questions[0].displayTitle).toBe('Interview');
  expect(bank.papers[0].questions[0].parts[0].officialNumber).toBe('15');
  expect(bank.issues).toEqual([]);
  const by = await scanBank(
    [
      vf('bank/index.json', { byId: { p: { name: 'Name', file_identifiers: ['uuid-a'] } } }),
      vf('bank/resource/uuid-a/content.json', role('g')),
    ],
    'bank',
  );
  expect(by.papers[0].id).toBe('p');
});
it('diagnoses conflicting paper ownership and never finds resources by unrelated basenames', async () => {
  const b = await scanBank(
    [
      vf('bank/index.json', {
        items: [
          { id: 'one', fileIdentifiers: ['uuid-a'] },
          { id: 'two', fileIdentifiers: ['uuid-a'] },
        ],
      }),
      vf('bank/resource/uuid-a/content.json', role('g')),
      vf('other/resource/uuid-a/content.json', role('other')),
    ],
    'bank',
  );
  expect(b.papers.map((p) => p.id)).not.toContain('one');
  expect(b.issues.some((d) => d.code === 'ambiguous_metadata')).toBe(true);
});
it('records unsupported, partial, and variant coverage without warning for normal reading', async () => {
  const b = await scanBank(
    [
      vf('bank/p/content_1/content.json', { structure_type: 'collector.future', info: {} }),
      vf('bank/p/content_2/content.json', {
        structure_type: 'collector.role',
        info: { question: [{ ask: 'Good' }, { ask: false }] },
      }),
      vf('bank/p/content_3/content.json', {
        structure_type: 'collector.read',
        info: { stid: 'r', value: 'Passage' },
      }),
    ],
    'bank',
  );
  expect(b.coverage).toMatchObject({
    observed: { 'collector.future': 1, 'collector.role': 1, 'collector.read': 1 },
    successful: 1,
    partial: 1,
    unsupported: 1,
  });
  expect(b.issues.filter((i) => i.path.includes('content_3'))).toEqual([]);
});
it('binds explicit metadata in a ZIP without an enclosing root folder', async () => {
  const b = await scanBank(
    [
      vf('index.json', { items: [{ id: 'p', fileIdentifiers: ['u'] }] }),
      vf('resource/u/content.json', role('g')),
    ],
    'bank',
  );
  expect(b.papers[0].id).toBe('p');
  expect(b.issues).toEqual([]);
});
it('never restores an ambiguous official number after a third conflicting template entry', async () => {
  const b = await scanBank(
    [
      vf('bank/p/content_1/content.json', role('g')),
      vf('bank/p/content_1/res.json', {
        exam_type_list: [
          {
            exam_type_collect: 'collector.role',
            exam_list: [
              {
                exam_id: 'g',
                exam_info: [
                  { value: 'ets_th7=15.' },
                  { value: 'ets_th7=16.' },
                  { value: 'ets_th7=15.' },
                ],
              },
            ],
          },
        ],
      }),
    ],
    'bank',
  );
  expect(b.papers[0].questions[0].parts[0].officialNumber).toBeUndefined();
  expect(b.issues.some((d) => d.code === 'ambiguous_metadata')).toBe(true);
});
it('preserves media ownership and reports only missing or unsafe audio references', async () => {
  const q = {
    structure_type: 'collector.role',
    info: {
      question: [
        { ask: 'First', askaudio: 'a.mp3' },
        { ask: 'Second', askaudio: '../other.mp3' },
      ],
    },
  };
  const b = await scanBank(
    [
      vf('bank/resource/u/content.json', q),
      { path: 'bank/resource/u/a.mp3', blob: new Blob([new Uint8Array([255, 251, 144, 192, 0])]) },
    ],
    'bank',
  );
  expect(b.diagnostics?.filter((d) => d.category === 'unsafe_path')).toHaveLength(1);
  expect(b.diagnostics?.find((d) => d.category === 'unsafe_path')?.field).toBe(
    'info.question[1].askaudio',
  );
});
it('never joins an official exam ID to a resource locator, while allowing scoped metadata with no ID', async () => {
  const info = { question: [{ ask: 'ets_th7 Prompt' }] };
  const content = vf('bank/resource/u/content.json', { structure_type: 'collector.role', info });
  const res = (examId?: string) =>
    vf('bank/resource/u/res.json', {
      exam_type_list: [
        {
          exam_type_collect: 'collector.role',
          exam_list: [
            { ...(examId ? { exam_id: examId } : {}), exam_info: [{ value: 'ets_th7=15.' }] },
          ],
        },
      ],
    });
  const b = await scanBank([content, res('u')], 'bank');
  expect(b.papers[0].questions[0].identity?.origin).toBe('resource');
  expect(b.papers[0].questions[0].parts[0].officialNumber).toBeUndefined();
  const scoped = await scanBank([content, res()], 'bank');
  expect(scoped.papers[0].questions[0].parts[0].officialNumber).toBe('15');
});
