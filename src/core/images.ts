import { normalizePath, parentPath } from './paths';
export const MAX_IMAGE_BYTES = 16 * 1024 ** 2;
/** Only the owning question and its material/ fallback are legitimate candidates. */
export function resolveImage(
  reference: string,
  source: string,
  assets: Map<string, Blob>,
): string | null {
  const variants = [reference];
  try {
    const decoded = decodeURIComponent(reference);
    if (decoded !== reference) variants.push(decoded);
  } catch {
    /* Literal percent filenames remain valid. */
  }
  for (const ref of variants) {
    let path: string;
    try {
      // A same-directory dot is normal in source HTML. Parent traversal remains
      // forbidden; archive entry validation uses the stricter path contract.
      path = normalizePath(
        ref
          .replace(/\\/g, '/')
          .split('/')
          .filter((segment) => segment !== '.')
          .join('/'),
      );
    } catch {
      continue;
    }
    const directory = parentPath(source);
    const prefix = directory ? directory + '/' : '';
    for (const candidate of [prefix + path, prefix + 'material/' + path]) {
      const blob = assets.get(candidate);
      if (blob && blob.size <= MAX_IMAGE_BYTES && /\.(png|jpe?g|gif|bmp|webp)$/i.test(candidate))
        return candidate;
    }
  }
  return null;
}
export interface ImageHeader {
  width: number;
  height: number;
  mime: string;
}
/** Read dimensions before any browser pixel decoder can allocate a bitmap. */
export async function imageHeader(blob: Blob): Promise<ImageHeader> {
  if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw new Error('Image size limit exceeded');
  const b = new Uint8Array(await blob.slice(0, 256 * 1024).arrayBuffer()),
    v = new DataView(b.buffer);
  let width = 0,
    height = 0,
    mime = '';
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (b.length >= 24 && b[0] === 137 && ascii(1, 3) === 'PNG' && ascii(12, 4) === 'IHDR') {
    width = v.getUint32(16);
    height = v.getUint32(20);
    mime = 'image/png';
  } else if (b.length >= 10 && /^GIF8[79]a$/.test(ascii(0, 6))) {
    width = v.getUint16(6, true);
    height = v.getUint16(8, true);
    mime = 'image/gif';
  } else if (b.length >= 26 && ascii(0, 2) === 'BM') {
    width = Math.abs(v.getInt32(18, true));
    height = Math.abs(v.getInt32(22, true));
    mime = 'image/bmp';
  } else if (b.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    mime = 'image/webp';
    if (ascii(12, 4) === 'VP8X') {
      width = 1 + b[24] + (b[25] << 8) + (b[26] << 16);
      height = 1 + b[27] + (b[28] << 8) + (b[29] << 16);
    } else if (ascii(12, 4) === 'VP8 ' && b[23] === 157 && b[24] === 1 && b[25] === 42) {
      width = v.getUint16(26, true) & 0x3fff;
      height = v.getUint16(28, true) & 0x3fff;
    } else if (ascii(12, 4) === 'VP8L' && b[20] === 47) {
      const bits = v.getUint32(21, true);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }
  } else if (b[0] === 255 && b[1] === 216) {
    mime = 'image/jpeg';
    let p = 2;
    while (p + 8 < b.length) {
      if (b[p++] !== 255) break;
      while (b[p] === 255) p++;
      const marker = b[p++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const len = v.getUint16(p);
      if (len < 2) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        height = v.getUint16(p + 3);
        width = v.getUint16(p + 5);
        break;
      }
      p += len;
    }
  }
  if (!width || !height || width * height > 40_000_000 || width > 32768 || height > 32768)
    throw new Error('Image has invalid or excessive dimensions');
  return { width, height, mime };
}
/** Bank-scoped URL cache; all URLs and Blob references are released on replacement. */
export class ImageResources {
  private disposed = false;
  private urls = new Set<string>();
  private cache = new Map<string, Promise<{ url: string; header: ImageHeader }>>();
  constructor(private assets: Map<string, Blob>) {}
  load(reference: string, source: string) {
    const path = resolveImage(reference, source, this.assets);
    if (!path || this.disposed) return Promise.reject(new Error('Image unavailable'));
    if (!this.cache.has(path)) this.cache.set(path, this.create(this.assets.get(path)!));
    return this.cache.get(path)!;
  }
  private async create(blob: Blob) {
    const header = await imageHeader(blob);
    if (this.disposed) throw new Error('Bank released');
    const url = URL.createObjectURL(blob.slice(0, blob.size, header.mime));
    this.urls.add(url);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (this.disposed || img.naturalWidth !== header.width || img.naturalHeight !== header.height)
        throw new Error('Image unavailable');
      return { url, header };
    } catch (error) {
      URL.revokeObjectURL(url);
      this.urls.delete(url);
      throw error;
    }
  }
  dispose() {
    this.disposed = true;
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
    this.cache.clear();
    this.assets = new Map();
  }
}
