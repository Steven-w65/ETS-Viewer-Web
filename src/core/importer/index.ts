import { Inflate, strFromU8 } from 'fflate';
import type { Progress, VirtualFile } from '../../types';
import { baseName, normalizePath } from '../paths';
export const LIMITS = {
  entries: 20_000,
  archiveBytes: 128 * 1024 ** 2,
  totalBytes: 256 * 1024 ** 2,
  fileBytes: 32 * 1024 ** 2,
};
type Limits = typeof LIMITS;
export const isRaster = (path: string) => /\.(png|jpe?g|gif|bmp|webp)$/i.test(path);
export function supportAsset(path: string): boolean {
  const name = baseName(path);
  return (
    /\.(mp3|wav|mp4|png|jpe?g|gif|bmp|webp|css|js|html?|svg|ico|woff2?|ttf)$/i.test(path) ||
    ['pc_xst_dict.json', 'worddict_data.json'].includes(name) ||
    (path.split('/').some((p) => p.startsWith('template_')) &&
      ['ctrl.json', 'ctrl_check.json', 'res.json', 'info.json'].includes(name)) ||
    /(^|\/)common\/config$/.test(path) ||
    /(^|\/)(__MACOSX|\.DS_Store)(\/|$)/.test(path)
  );
}
export function folderFiles(files: readonly File[]): VirtualFile[] {
  if (!files.length)
    throw new Error('No files were returned. Select a question-bank folder or Import ZIP.');
  if (files.length > LIMITS.entries)
    throw new Error('Folder entry limit exceeded. Import a smaller bank.');
  const result: VirtualFile[] = [],
    seen = new Set<string>();
  let root = '',
    total = 0;
  for (const file of files) {
    const relative = file.webkitRelativePath;
    if (!relative || !relative.includes('/'))
      throw new Error(
        'This browser did not return folder-relative paths. Use Import ZIP to preserve the complete bank.',
      );
    const path = normalizePath(relative);
    if (baseName(path) !== file.name)
      throw new Error('Folder paths are incomplete. Use Import ZIP.');
    const first = path.split('/')[0];
    if (root && first !== root)
      throw new Error('Folder paths have inconsistent roots. Use Import ZIP.');
    root = first;
    if (seen.has(path)) throw new Error('Duplicate folder path: ' + path);
    seen.add(path);
    total += file.size;
    // Files remain browser-backed Blobs. Audio/video are never copied or decoded.
    if (total > 1024 * 1024 ** 2)
      throw new Error('Folder size limit (1 GiB) exceeded. Select a smaller bank.');
    result.push({ path, blob: file });
  }
  return result;
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/** Central-directory preflight plus bounded streaming inflation, on the import worker.
 * ZIP64, encrypted/multi-volume archives and symlinks are intentionally unsupported.
 * Actual inflated byte counts and CRC are checked, not just advertised sizes.
 */
export async function readZip(
  blob: Blob,
  progress?: (p: Progress) => void,
  overrides: Partial<Limits> = {},
): Promise<VirtualFile[]> {
  const limits = { ...LIMITS, ...overrides };
  if (blob.size > limits.archiveBytes)
    throw new Error('ZIP compressed-size limit (128 MiB) exceeded.');
  const data = new Uint8Array(await blob.arrayBuffer()),
    v = new DataView(data.buffer);
  const fail = (why: string): never => {
    throw new Error('Invalid ZIP: ' + why);
  };
  const u16 = (i: number) =>
    i >= 0 && i + 2 <= data.length ? v.getUint16(i, true) : fail('truncated archive');
  const u32 = (i: number) =>
    i >= 0 && i + 4 <= data.length ? v.getUint32(i, true) : fail('truncated archive');
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--)
    if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === data.length) {
      end = i;
      break;
    }
  if (end < 0) fail('missing end directory');
  if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== u16(end + 10))
    fail('multi-volume archives are unsupported');
  const count = u16(end + 10),
    size = u32(end + 12),
    start = u32(end + 16);
  if (count === 65535 || size === 0xffffffff || start === 0xffffffff)
    fail('ZIP64 archives are unsupported');
  if (count > limits.entries) fail('entry-count limit exceeded');
  if (start + size !== end) fail('invalid directory bounds');
  const seen = new Set<string>();
  let pos = start,
    total = 0;
  const records: {
    path: string;
    offset: number;
    compressed: number;
    original: number;
    method: number;
    crc: number;
  }[] = [];
  for (let i = 0; i < count; i++) {
    if (u32(pos) !== 0x02014b50) fail('corrupt directory');
    const flags = u16(pos + 8),
      method = u16(pos + 10),
      crc = u32(pos + 16),
      compressed = u32(pos + 20),
      original = u32(pos + 24);
    const n = u16(pos + 28),
      extra = u16(pos + 30),
      comment = u16(pos + 32),
      offset = u32(pos + 42),
      mode = u32(pos + 38) >>> 16;
    if (pos + 46 + n + extra + comment > end) fail('truncated directory entry');
    const nameBytes = data.subarray(pos + 46, pos + 46 + n);
    let raw: string;
    try {
      raw = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
    } catch {
      fail('filename encoding must be UTF-8; re-create the ZIP with Unicode filenames');
    }
    if (flags & 1 || ![0, 8].includes(method)) fail('encrypted or unsupported compression');
    if ((mode & 0xf000) === 0xa000) fail('symbolic links are unsupported');
    const directory = raw!.endsWith('/'),
      path = normalizePath(directory ? raw!.slice(0, -1) : raw!);
    if (seen.has(path)) fail('duplicate path');
    seen.add(path);
    total += original;
    if (total > limits.totalBytes) fail('uncompressed-size limit exceeded');
    if (!directory && original > limits.fileBytes && (!supportAsset(path) || isRaster(path)))
      fail('file-size limit exceeded');
    if (u32(offset) !== 0x04034b50) fail('missing local header');
    const localFlags = u16(offset + 6),
      localMethod = u16(offset + 8),
      localN = u16(offset + 26),
      localExtra = u16(offset + 28);
    const localName = data.subarray(offset + 30, offset + 30 + localN);
    if (localFlags !== flags || localMethod !== method || strFromU8(localName) !== raw!)
      fail('local header mismatch');
    const payload = offset + 30 + localN + localExtra;
    if (payload + compressed > start || payload < offset) fail('invalid entry bounds');
    if (
      !(flags & 8) &&
      (u32(offset + 14) !== crc || u32(offset + 18) !== compressed || u32(offset + 22) !== original)
    )
      fail('local size or CRC mismatch');
    if (!directory && (!supportAsset(path) || isRaster(path)))
      records.push({ path, offset: payload, compressed, original, method, crc });
    pos += 46 + n + extra + comment;
  }
  if (pos !== start + size) fail('directory size mismatch');
  const results: VirtualFile[] = [];
  let extracted = 0;
  for (const [index, r] of records.entries()) {
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let actual = 0;
    const receive = (chunk: Uint8Array) => {
      actual += chunk.length;
      extracted += chunk.length;
      if (actual > r.original || actual > limits.fileBytes || extracted > limits.totalBytes)
        fail('actual decompression limit exceeded');
      chunks.push(new Uint8Array(chunk));
    };
    if (r.method === 0) receive(data.subarray(r.offset, r.offset + r.compressed));
    else {
      const inflate = new Inflate((chunk) => receive(chunk));
      if (!r.compressed) fail('empty deflate stream');
      // A small compressed chunk bounds individual inflation allocations even for a bomb.
      for (let j = 0; j < r.compressed; j += 1024)
        inflate.push(
          data.subarray(r.offset + j, r.offset + Math.min(j + 1024, r.compressed)),
          j + 1024 >= r.compressed,
        );
    }
    if (actual !== r.original) fail('corrupt uncompressed size');
    const bytes = new Uint8Array(actual);
    let cursor = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, cursor);
      cursor += chunk.length;
    }
    if (crc32(bytes) !== r.crc) fail('corrupt CRC');
    results.push({ path: r.path, blob: new Blob([bytes]) });
    progress?.({ phase: 'Reading files...', completed: index + 1, total: records.length });
    if (index % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return results;
}
