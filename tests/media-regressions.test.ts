import { afterEach, expect, it, vi } from 'vitest';
import { imageHeader, ImageResources, resolveImage } from '../src/core/images';
import { readZip } from '../src/core/importer';
import { zipSync } from 'fflate';
const source = 'bank/resource/u/content.json';
// Minimal EXIF/TIFF orientation 6 + SOF dimensions, sufficient for the header reader.
function jpeg() {
  const b = new Uint8Array(51);
  b.set([
    255, 216, 255, 225, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3,
    0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 255, 192, 0, 11, 8, 0, 20, 0, 40, 1, 1, 17, 0,
  ]);
  return new Blob([b], { type: 'image/jpeg' });
}
afterEach(() => vi.unstubAllGlobals());
it('accepts valid EXIF-rotated JPEG dimensions as displayed by browsers', async () => {
  expect(await imageHeader(jpeg())).toMatchObject({ width: 20, height: 40, mime: 'image/jpeg' });
});
it('does not reject a successfully decoded rotated image or revoke its active URL', async () => {
  const create = vi.fn(() => 'blob:rotated'),
    revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      naturalWidth = 20;
      naturalHeight = 40;
      decode() {
        return Promise.resolve();
      }
    },
  );
  const resources = new ImageResources(new Map([['bank/resource/u/material/photo.jpg', jpeg()]]));
  await expect(resources.load('photo.jpg', source)).resolves.toMatchObject({ url: 'blob:rotated' });
  expect(revoke).not.toHaveBeenCalled();
  resources.dispose();
  expect(revoke).toHaveBeenCalledWith('blob:rotated');
});
it('does not silently select between duplicate image candidates', () => {
  const assets = new Map([
    ['bank/resource/u/a.jpg', new Blob(['x'])],
    ['bank/resource/u/material/a.jpg', new Blob(['y'])],
  ]);
  expect(resolveImage('a.jpg', source, assets)).toBeNull();
});
it('does not accidentally resolve a double material prefix', () => {
  const assets = new Map([['bank/resource/u/material/material/a.jpg', new Blob(['x'])]]);
  expect(resolveImage('material/a.jpg', source, assets)).toBeNull();
});
it('retains referenced playback-capable resources in ZIP import under normal limits', async () => {
  const files = await readZip(
    new Blob([
      zipSync({
        'bank/p/material/a.mp3': new Uint8Array([255, 251, 144, 192]),
        'bank/p/material/v.mp4': new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112]),
      }),
    ]),
  );
  expect(files.map((f) => f.path)).toEqual(['bank/p/material/a.mp3', 'bank/p/material/v.mp4']);
});
