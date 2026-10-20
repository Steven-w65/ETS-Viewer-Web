import { expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { scanBank } from '../src/core/scanner';
import { readZip } from '../src/core/importer';
const source = 'bank/p/content_1/content.json';
function fixture() {
  return {
    structure_type: 'collector.role',
    info: {
      stid: 'g',
      question: [
        { xh: '1', ask: '<img src="a.jpg">', askimg: 'a.jpg', std: [{ value: 'Stored answer' }] },
        {
          xh: '2',
          ask: 'Prompt',
          askimg: '图 片.png',
          askaudio: 'sound.mp3',
          askvideo: 'lesson.mp4',
        },
      ],
    },
  };
}
it('preserves actual missing JPG/PNG/MP3/MP4 references and source paths in classified warning messages', async () => {
  const bank = await scanBank(
    [{ path: source, blob: new Blob([JSON.stringify(fixture())]) }],
    'bank',
  );
  expect(bank.issues.map((i) => i.message)).toEqual([
    'Image not found: a.jpg',
    'Audio not found: sound.mp3',
    'Video not found: lesson.mp4',
    'Image not found: 图 片.png',
  ]);
  expect(bank.issues.every((i) => i.path === source && i.category === 'file_not_found')).toBe(true);
  expect(bank.issues.map((i) => i.reference)).toEqual([
    'a.jpg',
    'sound.mp3',
    'lesson.mp4',
    '图 片.png',
  ]);
  expect(bank.papers[0].questions[0].parts[0].answers[0].text).toBe('Stored answer');
  expect(bank.issues[0].candidates).toEqual([
    'bank/p/content_1/a.jpg',
    'bank/p/content_1/material/a.jpg',
  ]);
});
it('keeps different unknown media references distinguishable without inventing filenames', async () => {
  const bank = await scanBank(
    [
      {
        path: source,
        blob: new Blob([
          JSON.stringify({
            structure_type: 'collector.role',
            info: {
              stid: 'g',
              audio: { bad: true },
              video: { bad: true },
              question: [{ xh: '1', ask: 'Prompt' }],
            },
          }),
        ]),
      },
    ],
    'bank',
  );
  expect(
    bank.issues
      .filter((i) => i.category === 'missing_reference')
      .map((i) => ({ message: i.message, reference: i.reference, kind: i.mediaKind })),
  ).toEqual([
    { message: 'Audio reference is missing', reference: '', kind: 'audio' },
    { message: 'Video reference is missing', reference: '', kind: 'video' },
  ]);
});
it('keeps folder and ZIP diagnostic details equivalent while distinguishing different source records', async () => {
  const records = Object.fromEntries(
    [source, source.replace('content_1', 'content_2')].map((path) => [
      path,
      strToU8(JSON.stringify(fixture())),
    ]),
  );
  const a = await scanBank(
    Object.entries(records).map(([path, bytes]) => ({ path, blob: new Blob([bytes]) })),
    'bank',
  );
  const b = await scanBank(await readZip(new Blob([zipSync(records)])), 'bank');
  expect(a.issues).toEqual(b.issues);
  expect(a.issues).toHaveLength(8);
  expect(new Set(a.issues.map((i) => i.path)).size).toBe(2);
});
