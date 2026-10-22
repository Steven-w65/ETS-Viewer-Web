import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { zipSync, strToU8, type Zippable } from 'fflate';
import { folderFiles, readZip } from '../src/core/importer';
import { scanBank } from '../src/core/scanner';
import { BankNavigation } from '../src/components/BankNavigation';
import type { Bank } from '../src/types';
import { choice } from './fixtures';

const folderDate = new Date(2026, 9, 19, 12, 0, 0).getTime();
const fileDate = new Date(2026, 9, 21, 12, 34, 56).getTime();
const path = 'bank/paper/content_1/content.json';
const content = JSON.stringify(choice);
const virtual = (source: string, modified = fileDate, text = content) => ({
  path: source,
  blob: new Blob([text]),
  modified,
});
const directory = (source: string, modified?: number) => ({
  path: source,
  directory: true as const,
  modified,
});
function folderFile() {
  const file = new File([content], 'content.json', { lastModified: fileDate });
  Object.defineProperty(file, 'webkitRelativePath', { value: path });
  return file;
}
const zipped = (records: [string, number, string][]) =>
  new Blob([
    zipSync(
      Object.fromEntries(
        records.map(([source, modified, text]) => [
          source,
          [strToU8(text), { mtime: new Date(modified) }],
        ]),
      ) as Zippable,
    ),
  ]);
const withFolder = (stamp = folderDate) =>
  zipped([
    ['bank/paper/', stamp, ''],
    [path, fileDate, content],
  ]);

it('does not substitute selected file modification times for unavailable folder metadata', async () => {
  const files = folderFiles([folderFile()]);
  const bank = await scanBank(files, 'bank');
  expect(bank.papers[0].modified).toBeNull();
  expect(bank.papers[0].questions).toHaveLength(1);
});
it('keeps a genuine ZIP directory timestamp separately from file entries', async () => {
  const entries = await readZip(withFolder());
  expect(entries).toContainEqual({ path: 'bank/paper', directory: true, modified: folderDate });
  const bank = await scanBank(entries, 'bank');
  expect(bank.papers[0].modified).toBe(folderDate);
  expect(bank.filesScanned).toBe(1);
  expect(bank.issues).toEqual([]);
});
it('ignores file timestamps when a ZIP omits the paper directory entry', async () => {
  const bank = await scanBank(await readZip(zipped([[path, fileDate, content]])), 'bank');
  expect(bank.papers[0].modified).toBeNull();
});
it('never replaces the paper folder date with newer files, nested folders or wrapper folders', async () => {
  const bank = await scanBank(
    await readZip(
      zipped([
        ['bank/', fileDate, ''],
        ['bank/paper/', folderDate, ''],
        ['bank/paper/content_1/', fileDate, ''],
        [path, fileDate, content],
        [path.replace('content.json', 'content2.json'), fileDate, content],
        ['bank/paper/content_1/material/', fileDate, ''],
      ]),
    ),
    'bank',
  );
  expect(bank.papers[0].modified).toBe(folderDate);
  expect(bank.papers[0].questions).toHaveLength(1);
});
it('does not infer a missing paper folder date from parent or nested directory entries', async () => {
  const bank = await scanBank(
    await readZip(
      zipped([
        ['bank/', folderDate, ''],
        ['bank/paper/content_1/', fileDate, ''],
        [path, fileDate, content],
      ]),
    ),
    'bank',
  );
  expect(bank.papers[0].modified).toBeNull();
});
it('keeps exact paper folder ownership and Unicode paths', async () => {
  const first = '包装/题库 一/试卷/content_1/content.json';
  const bank = await scanBank(
    await readZip(
      zipped([
        ['包装/题库 一/试卷/', folderDate, ''],
        [first, fileDate, content],
        ['包装/题库 二/试卷/', fileDate, ''],
        [first.replace('题库 一', '题库 二'), folderDate, content],
      ]),
    ),
    'bank',
  );
  expect(bank.papers).toHaveLength(2);
  expect(bank.papers.find((p) => p.key === '包装/题库 一/试卷')?.modified).toBe(folderDate);
  expect(bank.papers.find((p) => p.key === '包装/题库 二/试卷')?.modified).toBe(fileDate);
});
it('does not assign Android logical papers a resource folder or metadata file date', async () => {
  const bank = await scanBank(
    await readZip(
      zipped([
        ['bank/resource/uuid/', folderDate, ''],
        ['bank/data/', folderDate, ''],
        [
          'bank/data/paper-7',
          fileDate,
          JSON.stringify({
            name: 'Paper',
            sectionData: [{ sectionItemData: [{ fileName: 'uuid' }] }],
          }),
        ],
        ['bank/resource/uuid/content.json', fileDate, content],
      ]),
    ),
    'bank',
  );
  expect(bank.papers[0]).toMatchObject({ id: 'paper-7', modified: null });
});
it.each([undefined, NaN, Infinity, -1, 9e15])(
  'omits invalid or absent directory timestamps: %s',
  async (modified) => {
    const bank = await scanBank([virtual(path), directory('bank/paper', modified)], 'bank');
    expect(bank.papers[0].modified).toBeNull();
  },
);
it('preserves a valid Unix epoch directory timestamp', async () => {
  const bank = await scanBank([virtual(path), directory('bank/paper', 0)], 'bank');
  expect(bank.papers[0].modified).toBe(0);
});
it.each([0, (46 << 9) | (2 << 5) | 31])(
  'ignores invalid ZIP directory calendar dates without losing questions: %s',
  async (dosDate) => {
    const bytes = new Uint8Array(await withFolder().arrayBuffer());
    const view = new DataView(bytes.buffer);
    for (let i = 0; i + 46 <= bytes.length; i++)
      if (
        view.getUint32(i, true) === 0x02014b50 &&
        bytes[i + 46 + view.getUint16(i + 28, true) - 1] === 47
      )
        view.setUint16(i + 14, dosDate, true);
    const bank = await scanBank(await readZip(new Blob([bytes])), 'bank');
    expect(bank.papers[0].modified).toBeNull();
    expect(bank.papers[0].questions).toHaveLength(1);
  },
);
it('rejects duplicate directory identities and unsafe directory paths', async () => {
  await expect(
    scanBank(
      [virtual(path), directory('bank/paper', folderDate), directory('bank/paper', fileDate)],
      'bank',
    ),
  ).rejects.toThrow(/Duplicate/);
  await expect(
    readZip(
      zipped([
        ['../escape/', folderDate, ''],
        [path, fileDate, content],
      ]),
    ),
  ).rejects.toThrow(/path/i);
});
it('shows only the folder date after the group count and omits unknown dates', async () => {
  const bank = await scanBank([virtual(path)], 'bank');
  const navigation = (value: Bank) => (
    <BankNavigation
      bank={value}
      paper={undefined}
      index={0}
      onPaper={vi.fn()}
      onQuestion={vi.fn()}
      onBack={vi.fn()}
      onChange={vi.fn()}
      listRef={{ current: null }}
      onScroll={vi.fn()}
    />
  );
  const view = render(
    navigation({ ...bank, papers: [{ ...bank.papers[0], modified: folderDate }] }),
  );
  expect(screen.getByRole('button', { name: /paper/ }).querySelector('small')).toHaveTextContent(
    '1 group · Oct 19, 2026',
  );
  expect(screen.queryByText(/updated/i)).toBeNull();
  for (const modified of [null, NaN, Infinity, 9e15]) {
    view.rerender(navigation({ ...bank, papers: [{ ...bank.papers[0], modified }] }));
    expect(screen.getByRole('button', { name: /paper/ }).querySelector('small')).toHaveTextContent(
      /^1 group$/,
    );
    expect(screen.queryByText(/Date unavailable/i)).toBeNull();
  }
});
