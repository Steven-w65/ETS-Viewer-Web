import { describe, expect, it } from 'vitest';
import { imageHeader, resolveImage } from '../src/core/images';
import { safeFragment, plainText } from '../src/core/markup';
describe('local images and inert markup', () => {
  it('resolves images beside root-level JSON and in root-level material folders', () => {
    for (const path of ['image.png', 'material/image.png']) {
      expect(resolveImage('image.png', 'content.json', new Map([[path, new Blob(['x'])]]))).toBe(
        path,
      );
    }
  });
  const source = 'bank/paper/content_1/content.json';
  const assets = new Map([
    ['bank/paper/content_1/material/示意 图.png', new Blob(['x'])],
    ['bank/other/content.jpg', new Blob(['decoy'])],
    ['bank/paper/content_1/beside.jpg', new Blob(['x'])],
  ]);
  it('resolves beside JSON and question-local material, including Unicode and native separators', () => {
    expect(resolveImage('beside.jpg', source, assets)).toBe('bank/paper/content_1/beside.jpg');
    expect(resolveImage('./beside.jpg', source, assets)).toBe('bank/paper/content_1/beside.jpg');
    expect(resolveImage('示意 图.png', source, assets)).toBe(
      'bank/paper/content_1/material/示意 图.png',
    );
    expect(resolveImage('material\\示意 图.png', source, assets)).toBe(
      'bank/paper/content_1/material/示意 图.png',
    );
  });
  it.each([
    'content.jpg',
    'https://example.com/x.jpg',
    'file:///C:/x.jpg',
    '../content.jpg',
    '%2e%2e/content.jpg',
    '//host/x.jpg',
    'C:\\x.jpg',
  ])('never borrows or remotely loads %s', (ref) =>
    expect(resolveImage(ref, source, assets)).toBeNull(),
  );
  it('rejects invalid and oversized pixel headers before decoding', async () => {
    await expect(imageHeader(new Blob(['not an image']))).rejects.toThrow();
    const png = new Uint8Array(24);
    png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
    png.set([73, 72, 68, 82], 12);
    const v = new DataView(png.buffer);
    v.setUint32(16, 10000);
    v.setUint32(20, 4001);
    await expect(imageHeader(new Blob([png]))).rejects.toThrow(/dimensions/);
    v.setUint32(16, 64);
    v.setUint32(20, 32);
    expect(await imageHeader(new Blob([png]))).toEqual({
      width: 64,
      height: 32,
      mime: 'image/png',
    });
  });
  it('removes active content, event handlers and remote resource attributes while preserving text and tables', () => {
    const ast = safeFragment(
      '<script>alert(1)</script><style>bad</style><p onclick="bad()">Hello <b>world</b></p><img src="https://evil/x" onerror="bad()"><table style="background:url(https://evil)"><tr><td colspan="2">Value</td></tr></table>',
    );
    const str = JSON.stringify(ast);
    expect(str).not.toContain('alert');
    expect(str).not.toContain('onclick');
    expect(str).not.toContain('background');
    expect(str).toContain('world');
    expect(str).toContain('colspan');
    expect(plainText('A</br>B &amp; <b>C</b>')).toBe('A B & C');
  });
});
