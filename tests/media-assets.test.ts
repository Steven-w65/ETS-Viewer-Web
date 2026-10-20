import { expect, it } from 'vitest';
import { classifyMedia } from '../src/core/media/classify';
import { resolveMedia } from '../src/core/media/resolve';
import { assetPath } from '../src/core/media/paths';
const source = 'bank/resource/u/content2.json';
const png = () => {
  const b = new Uint8Array(24);
  b.set([137, 80, 78, 71, 13, 10, 26, 10]);
  b.set([73, 72, 68, 82], 12);
  new DataView(b.buffer).setUint32(16, 16);
  new DataView(b.buffer).setUint32(20, 8);
  return new Blob([b]);
};
const mp3 = () => new Blob([new Uint8Array([255, 251, 144, 192, 0, 0, 0, 0])]);
const mp4 = () =>
  new Blob([
    new Uint8Array([
      0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 109, 112, 52, 50,
    ]),
  ]);
it.each([
  ['a.jpg', 'image'],
  ['a.PNG', 'image'],
  ['a.mp3', 'audio'],
  ['a.wav', 'audio'],
  ['a.ogg', 'audio'],
  ['a.m4a', 'audio'],
  ['a.mp4', 'video'],
  ['a.webm', 'video'],
  ['a.json', 'data'],
  ['a.bin', 'unknown'],
])('classifies %s as %s', (path, kind) => expect(classifyMedia(path).kind).toBe(kind));
it('uses MIME for initial classification of extensionless assets', () =>
  expect(classifyMedia('clip', 'audio/mpeg').kind).toBe('audio'));
it('validates bounded content signatures and corrects an inaccurate image MIME', async () => {
  const b = new Blob([await png().arrayBuffer()], { type: 'audio/mpeg' });
  const r = await resolveMedia('a.png', source, new Map([['bank/resource/u/material/a.png', b]]));
  expect(r.kind).toBe('image');
  expect(r.mimeType).toBe('image/png');
  expect(r.diagnostics.some((d) => d.category === 'type_mismatch')).toBe(true);
});
it('rejects conflicting extensions/content rather than using the wrong renderer', async () => {
  await expect(
    resolveMedia('a.jpg', source, new Map([['bank/resource/u/a.jpg', mp3()]])),
  ).rejects.toMatchObject({ diagnostic: { category: 'type_mismatch' } });
});
it('resolves local MP3 and MP4 to typed media, not images', async () => {
  const assets = new Map([
    ['bank/resource/u/material/a.mp3', mp3()],
    ['bank/resource/u/material/v.mp4', mp4()],
  ]);
  expect(await resolveMedia('a.mp3', source, assets)).toMatchObject({
    kind: 'audio',
    mimeType: 'audio/mpeg',
    resolvedPath: 'bank/resource/u/material/a.mp3',
  });
  expect(await resolveMedia('material/v.mp4', source, assets)).toMatchObject({
    kind: 'video',
    mimeType: 'video/mp4',
  });
});
it.each([
  'material/图 片.png',
  'material\\图 片.png',
  'material/%E5%9B%BE%20%E7%89%87.png',
  './material/图 片.png',
])('resolves scoped Unicode/encoded %s', (ref) => {
  expect(
    assetPath(ref, source, new Map([['bank/resource/u/material/图 片.png', png()]])),
  ).toMatchObject({ resolvedPath: 'bank/resource/u/material/图 片.png' });
});
it('resolves nested and root-level paths without duplicate material prefixes', () => {
  expect(
    assetPath('nested/a.mp3', 'content.json', new Map([['material/nested/a.mp3', mp3()]])),
  ).toMatchObject({ resolvedPath: 'material/nested/a.mp3' });
});
it.each([
  '../x.mp3',
  '%2e%2e/x.mp4',
  'https://evil/x.mp4',
  '//evil/x.mp3',
  'file:///C:/x.jpg',
  'C:\\x.jpg',
])('rejects unsafe %s', async (reference) => {
  await expect(resolveMedia(reference, source, new Map())).rejects.toMatchObject({
    diagnostic: { category: 'unsafe_path' },
  });
});
it('distinguishes missing references, missing files and unsupported resources', async () => {
  await expect(resolveMedia('', source, new Map())).rejects.toMatchObject({
    diagnostic: { category: 'missing_reference' },
  });
  await expect(resolveMedia('a.png', source, new Map())).rejects.toMatchObject({
    diagnostic: {
      category: 'file_not_found',
      candidates: ['bank/resource/u/a.png', 'bank/resource/u/material/a.png'],
    },
  });
  await expect(
    resolveMedia('a.json', source, new Map([['bank/resource/u/a.json', new Blob(['{}'])]])),
  ).rejects.toMatchObject({ diagnostic: { category: 'unsupported_type' } });
});
it('never borrows unrelated or differently cased basenames and rejects ambiguous encoded matches', async () => {
  await expect(
    resolveMedia(
      'a.mp3',
      source,
      new Map([
        ['bank/resource/v/a.mp3', mp3()],
        ['bank/resource/u/A.mp3', mp3()],
      ]),
    ),
  ).rejects.toMatchObject({ diagnostic: { category: 'file_not_found' } });
  await expect(
    resolveMedia(
      'a%20b.mp3',
      source,
      new Map([
        ['bank/resource/u/a%20b.mp3', mp3()],
        ['bank/resource/u/a b.mp3', mp3()],
      ]),
    ),
  ).rejects.toMatchObject({ diagnostic: { category: 'ambiguous_path' } });
});
it('reports a local audio read failure without calling it an image decode failure', async () => {
  const blob = new Blob([new Uint8Array([255, 251, 144, 192])]);
  Object.defineProperty(blob, 'slice', {
    value: () => ({ arrayBuffer: () => Promise.reject(new Error('unreadable')) }),
  });
  await expect(
    resolveMedia('a.mp3', source, new Map([['bank/resource/u/a.mp3', blob]])),
  ).rejects.toMatchObject({
    diagnostic: {
      category: 'file_read',
      mediaKind: 'audio',
      resolvedPath: 'bank/resource/u/a.mp3',
    },
  });
});
