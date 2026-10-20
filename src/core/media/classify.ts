import type { AssetKind } from './types';
const extensions: Record<string, [AssetKind, string]> = {
  jpg: ['image', 'image/jpeg'],
  jpeg: ['image', 'image/jpeg'],
  png: ['image', 'image/png'],
  webp: ['image', 'image/webp'],
  gif: ['image', 'image/gif'],
  bmp: ['image', 'image/bmp'],
  mp3: ['audio', 'audio/mpeg'],
  wav: ['audio', 'audio/wav'],
  ogg: ['audio', 'audio/ogg'],
  m4a: ['audio', 'audio/mp4'],
  mp4: ['video', 'video/mp4'],
  webm: ['video', 'video/webm'],
  json: ['data', 'application/json'],
};
export function classifyMedia(path: string, mime = ''): { kind: AssetKind; mimeType: string } {
  const ext = path
    .replaceAll('\\', '/')
    .split('/')
    .at(-1)
    ?.match(/\.([^.]+)$/)?.[1]
    .toLowerCase();
  if (ext && extensions[ext]) return { kind: extensions[ext][0], mimeType: extensions[ext][1] };
  const type = mime.toLowerCase().split(';')[0].trim();
  if (
    !ext &&
    /^(image\/(jpeg|png|webp|gif|bmp)|audio\/(mpeg|wav|ogg|mp4)|video\/(mp4|webm))$/.test(type)
  )
    return { kind: type.split('/')[0] as AssetKind, mimeType: type };
  return { kind: 'unknown', mimeType: 'application/octet-stream' };
}
export const isMediaPath = (path: string) =>
  ['image', 'audio', 'video'].includes(classifyMedia(path).kind);
/** Bounded container recognition. Playback support is still determined by the browser. */
export async function sniffMedia(
  blob: Blob,
  path: string,
): Promise<{ kind: AssetKind; mimeType: string }> {
  let bytes = new Uint8Array(await blob.slice(0, 4096).arrayBuffer());
  const ascii = (start: number, n: number) =>
    String.fromCharCode(...bytes.subarray(start, start + n));
  if (bytes[0] === 137 && ascii(1, 3) === 'PNG') return { kind: 'image', mimeType: 'image/png' };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return { kind: 'image', mimeType: 'image/jpeg' };
  if (/^GIF8[79]a$/.test(ascii(0, 6))) return { kind: 'image', mimeType: 'image/gif' };
  if (ascii(0, 2) === 'BM') return { kind: 'image', mimeType: 'image/bmp' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP')
    return { kind: 'image', mimeType: 'image/webp' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE')
    return { kind: 'audio', mimeType: 'audio/wav' };
  if (
    ascii(0, 4) === 'OggS' &&
    (ascii(0, 4096).includes('OpusHead') || ascii(0, 4096).includes('vorbis'))
  )
    return { kind: 'audio', mimeType: 'audio/ogg' };
  if (bytes.length >= 12 && ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4),
      hint = classifyMedia(path);
    if (/^(?:M4A |M4B )$/.test(brand) || hint.mimeType === 'audio/mp4')
      return { kind: 'audio', mimeType: 'audio/mp4' };
    if (/^(?:isom|iso[2-9]|mp4[12]|avc1|dash|M4V |MSNV)$/.test(brand))
      return { kind: 'video', mimeType: 'video/mp4' };
  }
  if (
    bytes[0] === 26 &&
    bytes[1] === 69 &&
    bytes[2] === 223 &&
    bytes[3] === 163 &&
    ascii(0, 4096).includes('webm')
  )
    return { kind: 'video', mimeType: 'video/webm' };
  if (ascii(0, 3) === 'ID3' && bytes.length >= 10) {
    if ([...bytes.subarray(6, 10)].some((b) => b > 127)) return { kind: 'unknown', mimeType: '' };
    const length =
      10 +
      (bytes[6] << 21) +
      (bytes[7] << 14) +
      (bytes[8] << 7) +
      bytes[9] +
      (bytes[5] & 16 ? 10 : 0);
    if (length >= blob.size) return { kind: 'unknown', mimeType: '' };
    bytes = new Uint8Array(await blob.slice(length, length + 4096).arrayBuffer());
  }
  for (let i = 0; i < Math.min(bytes.length - 3, 512); i++)
    if (
      bytes[i] === 255 &&
      (bytes[i + 1] & 224) === 224 &&
      (bytes[i + 1] & 24) !== 8 &&
      (bytes[i + 1] & 6) === 2 &&
      (bytes[i + 2] & 240) !== 0 &&
      (bytes[i + 2] & 240) !== 240 &&
      (bytes[i + 2] & 12) !== 12
    )
      return { kind: 'audio', mimeType: 'audio/mpeg' };
  return { kind: 'unknown', mimeType: 'application/octet-stream' };
}
