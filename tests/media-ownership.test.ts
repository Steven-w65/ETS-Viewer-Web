import { expect, it } from 'vitest';
import { parseDocument } from '../src/core/parser';
import { scanBank } from '../src/core/scanner';
import { folderFiles, readZip } from '../src/core/importer';
import { zipSync, strToU8 } from 'fflate';
import { safeFragment } from '../src/core/markup';
const source = 'bank/resource/u/content2.json';
const content = {
  structure_type: 'collector.role',
  info: {
    stid: 'g',
    audio: 'shared.mp3',
    video: 'shared.mp4',
    unrelated: 'ignore.mp3',
    question: [
      {
        xh: '1',
        ask: 'Original',
        askaudio: 'ask.mp3',
        askvideo: 'ask.mp4',
        std: [{ value: 'Original answer', audio: 'answer.mp3' }],
      },
    ],
  },
};
it('preserves verified shared, question and answer media ownership without guessing unrelated strings', () => {
  const q = parseDocument(content, source);
  expect(q.media).toEqual([
    { kind: 'audio', reference: 'shared.mp3', field: 'info.audio' },
    { kind: 'video', reference: 'shared.mp4', field: 'info.video' },
  ]);
  expect(q.parts[0].media).toEqual([
    { kind: 'audio', reference: 'ask.mp3', field: 'info.question[0].askaudio' },
    { kind: 'video', reference: 'ask.mp4', field: 'info.question[0].askvideo' },
  ]);
  expect(q.parts[0].answers[0].media).toEqual([
    { kind: 'audio', reference: 'answer.mp3', field: 'info.question[0].std[0].audio' },
  ]);
  expect(JSON.stringify(q.media)).not.toContain('ignore');
});
it('retains choice xt_wj as question media and does not change answer extraction', () => {
  const q = parseDocument(
    {
      structure_type: 'collector.choose',
      info: { stid: 'g', xtlist: [{ xt_xh: '1', xt_nr: 'Prompt', xt_wj: 'ask.mp3', answer: 'B' }] },
    },
    source,
  );
  expect(q.parts[0].media).toContainEqual({
    kind: 'audio',
    reference: 'ask.mp3',
    field: 'info.xtlist[0].xt_wj',
  });
  expect(q.parts[0].answers[0].text).toBe('B');
});
it.each(['picture', 'read', 'word', 'fill', 'dialogue', '3q5a'])(
  'preserves shared media through %s without changing the registry',
  (kind) => {
    const q = parseDocument(
      {
        structure_type: 'collector.' + kind,
        info: {
          stid: 'g',
          audio: 'shared.mp3',
          value: 'Original',
          std: [{ xth: '1', value: 'Stored' }],
          question: [{ ask: 'Original' }],
        },
      },
      source,
    );
    expect(q.media).toContainEqual({ kind: 'audio', reference: 'shared.mp3', field: 'info.audio' });
  },
);
it('parses only explicit safe HTML media references and never imported playback/script attributes', () => {
  const ast = safeFragment(
    '<audio autoplay loop src="a.mp3" onplay="bad()"></audio><video poster="https://evil/p.jpg"><source src="material/v.mp4" type="video/mp4"><track src="https://evil/t"></video>',
  );
  expect(ast).toContainEqual({ type: 'media', kind: 'audio', references: ['a.mp3'] });
  expect(ast).toContainEqual({ type: 'media', kind: 'video', references: ['material/v.mp4'] });
  expect(JSON.stringify(ast)).not.toMatch(/autoplay|onplay|poster|evil/);
});
it('preserves media consistently through folder and ZIP import, with explicit references only', async () => {
  const entries: Record<string, Uint8Array> = {
    'bank/p/content_1/content.json': strToU8(JSON.stringify(content)),
    'bank/p/content_1/material/ask.mp3': new Uint8Array([255, 251, 144, 192, 0]),
    'bank/p/content_1/material/ask.mp4': new Uint8Array([
      0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 109, 112, 52, 50,
    ]),
    'bank/p/content_1/material/unreferenced.mp3': new Uint8Array([255, 251, 144, 192, 0]),
  };
  const folder = Object.entries(entries).map(([path, bytes]) => {
    const file = new File([new Uint8Array(bytes)], path.split('/').at(-1)!);
    Object.defineProperty(file, 'webkitRelativePath', { value: path });
    return file;
  });
  const a = await scanBank(folderFiles(folder), 'bank'),
    b = await scanBank(await readZip(new Blob([zipSync(entries)])), 'bank');
  expect(a.papers).toEqual(b.papers);
  expect([...a.assets.keys()]).toEqual([...b.assets.keys()]);
  expect(a.assets.has('bank/p/content_1/material/ask.mp4')).toBe(true);
  expect(JSON.stringify(a.papers)).not.toContain('unreferenced');
  expect(
    a.diagnostics?.some((d) => d.category === 'file_not_found' && d.reference === 'shared.mp3'),
  ).toBe(true);
});
it('does not discard valid questions or answers when optional media fields are malformed', () => {
  const q = parseDocument(
    {
      structure_type: 'collector.role',
      info: {
        stid: 'g',
        audio: { bad: true },
        question: [
          {
            ask: 'Prompt',
            askaudio: false,
            std: [{ value: 'Stored answer', audio: { bad: true } }],
          },
        ],
      },
    },
    source,
  );
  expect(q.parts[0].answers[0].text).toBe('Stored answer');
  expect(q.media?.[0].reference).toBe('');
  expect(q.parts[0].answers[0].media?.[0].reference).toBe('');
});
it('preserves explicit media-only questions and stored answers in source order', () => {
  const q = parseDocument(
    {
      structure_type: 'collector.role',
      info: {
        stid: 'g',
        question: [
          {
            askaudio: 'ask.mp3',
            std: [
              { value: '', audio: 'answer.mp3' },
              { value: '<audio src="inline.mp3"></audio>' },
              { value: 'Written answer' },
              { value: '' },
            ],
          },
          { askvideo: 'ask.mp4' },
        ],
      },
    },
    source,
  );
  expect(q.parts).toHaveLength(2);
  expect(q.parts[0].media?.[0].reference).toBe('ask.mp3');
  expect(q.parts[1].media?.[0].reference).toBe('ask.mp4');
  expect(q.parts[0].answers.map((a) => a.text)).toEqual([
    '',
    '<audio src="inline.mp3"></audio>',
    'Written answer',
  ]);
  expect(q.parts[0].answers[0].media?.[0].reference).toBe('answer.mp3');
});
it('retains explicit fill-answer audio and media-only reference rows', () => {
  const q = parseDocument(
    {
      structure_type: 'collector.fill',
      info: {
        stid: 'g',
        value: 'Prompt',
        std: [
          { xth: '1', value: 'Answer', audio: 'answer.mp3' },
          { xth: '2', value: '', audio: 'spoken.mp3' },
        ],
      },
    },
    source,
  );
  expect(q.parts[0].answers[0]).toMatchObject({
    text: 'Answer',
    media: [{ reference: 'answer.mp3', field: 'info.std[0].audio' }],
  });
  expect(q.parts[1].answers[0]).toMatchObject({ text: '', media: [{ reference: 'spoken.mp3' }] });
});
it.each(['read', 'word', 'picture'])(
  'retains a %s group whose only explicit question content is local media',
  (kind) => {
    const q = parseDocument(
      { structure_type: 'collector.' + kind, info: { stid: 'g', audio: 'shared.mp3' } },
      source,
    );
    expect(q.media?.[0].reference).toBe('shared.mp3');
    expect(q.parts).toHaveLength(1);
  },
);
