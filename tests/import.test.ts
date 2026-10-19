import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { folderFiles, readZip } from '../src/core/importer';
import { scanBank } from '../src/core/scanner';
import { normalizePath } from '../src/core/paths';
import { choice, dialogue } from './fixtures';
function file(path: string, value = JSON.stringify(choice)) {
  const f = new File([value], path.split('/').at(-1)!);
  Object.defineProperty(f, 'webkitRelativePath', { value: path });
  return f;
}
const archive = (entries: Record<string, string>) =>
  new Blob([zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, strToU8(v)])))]);
describe('folder and ZIP imports', () => {
  it('rejects missing hierarchy instead of silently accepting an incomplete folder', () => {
    expect(() => folderFiles([new File(['{}'], 'content.json')])).toThrow(/Import ZIP/);
    expect(() => folderFiles([file('ETS/a.json'), new File(['{}'], 'b.json')])).toThrow(
      /Import ZIP/,
    );
    expect(() => folderFiles([])).toThrow(/No files/);
  });
  it('preserves nested Unicode paths and rejects mixed roots', () => {
    expect(folderFiles([file('题库 一/试卷/content_1/content.json')])[0].path).toBe(
      '题库 一/试卷/content_1/content.json',
    );
    expect(() => folderFiles([file('a/one.json'), file('b/two.json')])).toThrow();
  });
  it('gives equivalent folder and wrapped ZIP results', async () => {
    const path = '题库 一/试卷/content_1/content.json';
    const folder = await scanBank(folderFiles([file(path)]), '题库 一');
    const zip = await scanBank(
      await readZip(archive({ [path]: JSON.stringify(choice) })),
      '题库 一',
    );
    expect(zip.papers).toEqual(folder.papers);
    expect(zip.papers[0].id).toBe('试卷');
    expect(zip.papers[0].modified).toBeNull();
  });
  it('uses alternate copies once, preserves metadata and retains other valid groups', async () => {
    const entries = folderFiles([
      file('bank/p/content_a/content.json', '{broken'),
      file('bank/p/content_a/content2.json'),
      file('bank/p/content_b/content.json', JSON.stringify(dialogue)),
      file('bank/p/content_c/content.json', '{}'),
    ]);
    const result = await scanBank(entries, 'bank');
    expect(result.papers[0].questions.map((q) => q.id)).toEqual(['synthetic', 'dialogue']);
    expect(result.issues).toHaveLength(2);
    expect(result.papers[0].questions[0].source).toContain('content2.json');
  });
  it('does not merge duplicate IDs from different paper folders', async () => {
    const result = await scanBank(
      folderFiles([
        file('bank/one/content_1/content.json'),
        file('bank/two/content_1/content.json'),
      ]),
      'bank',
    );
    expect(result.papers).toHaveLength(2);
  });
  it('supports UTF-16 BOM and extensionless JSON', async () => {
    const s = JSON.stringify(choice),
      data = new Uint8Array(2 + s.length * 2);
    data.set([255, 254]);
    const view = new DataView(data.buffer);
    for (let i = 0; i < s.length; i++) view.setUint16(2 + i * 2, s.charCodeAt(i), true);
    const b = await scanBank([{ path: 'bank/paper/bank.dat', blob: new Blob([data]) }], 'bank');
    expect(b.papers[0].questions[0].id).toBe('synthetic');
  });
  it.each([
    '../bad.json',
    '/absolute.json',
    'C:/absolute.json',
    'a/../b.json',
    'a//b.json',
    'a/./b.json',
    '\\\\host\\x.json',
  ])('rejects unsafe paths %s', (p) => expect(() => normalizePath(p)).toThrow());
  it('rejects malformed and unsafe ZIPs', async () => {
    await expect(readZip(new Blob(['not a zip']))).rejects.toThrow(/ZIP/);
    await expect(readZip(archive({ '../escape.json': '{}' }))).rejects.toThrow(/path/i);
  });
  it('rejects corrupt CRC and configured entry, file and total limits', async () => {
    const good = new Uint8Array(
      await archive({ 'p/content.json': JSON.stringify(choice) }).arrayBuffer(),
    );
    // Modify the advertised CRC in both headers; payload stays intact.
    const view = new DataView(good.buffer);
    view.setUint32(14, 123, true);
    for (let i = 0; i < good.length - 46; i++)
      if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 16, 123, true);
    await expect(readZip(new Blob([good]))).rejects.toThrow(/CRC|corrupt/i);
    await expect(
      readZip(archive({ 'a.json': '{}', 'b.json': '{}' }), undefined, { entries: 1 }),
    ).rejects.toThrow(/limit/i);
    await expect(
      readZip(archive({ 'a.json': 'x'.repeat(1000) }), undefined, { fileBytes: 10 }),
    ).rejects.toThrow(/limit/i);
    await expect(
      readZip(archive({ 'a.json': 'x'.repeat(1000) }), undefined, { totalBytes: 10 }),
    ).rejects.toThrow(/limit/i);
  });
  it('stops actual inflation when an archive lies about its uncompressed size', async () => {
    const bytes = new Uint8Array(
        await archive({ 'p/content.json': 'x'.repeat(100_000) }).arrayBuffer(),
      ),
      view = new DataView(bytes.buffer);
    view.setUint32(22, 1, true);
    for (let i = 0; i < bytes.length - 46; i++)
      if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, 1, true);
    await expect(readZip(new Blob([bytes]))).rejects.toThrow(/actual decompression limit/);
  });
  it('rejects duplicate normalized archive paths', async () => {
    await expect(
      readZip(archive({ 'p/content.json': '{}', 'p\\content.json': '{}' })),
    ).rejects.toThrow(/duplicate path/);
  });
  it('warns about corrupt metadata without losing explicit answers', async () => {
    const bank = await scanBank(
      folderFiles([
        file('bank/p/content_1/content.json'),
        file('bank/p/content_1/info.json', '[{"code_id":"answer","code_json_array":"broken"}]'),
      ]),
      'bank',
    );
    expect(bank.papers[0].questions[0].parts[0].answers[0].text).toBe('B');
    expect(bank.issues[0].message).toContain('metadata');
  });
  it('reports unsupported databases and ignores template support files', async () => {
    const result = await scanBank(
      folderFiles([
        file('bank/store.db', 'SQLite format 3\0'),
        file('bank/template_x/info.json', '{}'),
      ]),
      'bank',
    );
    expect(result.papers).toHaveLength(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('SQLite');
  });
});
