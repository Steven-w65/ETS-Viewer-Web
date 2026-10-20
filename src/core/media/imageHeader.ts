export const MAX_IMAGE_BYTES = 16 * 1024 ** 2;
export interface ImageHeader {
  width: number;
  height: number;
  mime: string;
}
function orientation(bytes: Uint8Array): number {
  try {
    if (String.fromCharCode(...bytes.subarray(0, 6)) !== 'Exif\0\0') return 1;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      little = bytes[6] === 73 && bytes[7] === 73;
    if (!little && !(bytes[6] === 77 && bytes[7] === 77)) return 1;
    if (view.getUint16(8, little) !== 42) return 1;
    const ifd = 6 + view.getUint32(10, little),
      entries = Math.min(view.getUint16(ifd, little), 256);
    for (let i = 0; i < entries; i++) {
      const at = ifd + 2 + i * 12;
      if (at + 12 > bytes.length) break;
      if (
        view.getUint16(at, little) === 274 &&
        view.getUint16(at + 2, little) === 3 &&
        view.getUint32(at + 4, little) === 1
      ) {
        const value = view.getUint16(at + 8, little);
        return value >= 1 && value <= 8 ? value : 1;
      }
    }
  } catch {
    /* A malformed optional EXIF block cannot override raster dimensions. */
  }
  return 1;
}
/** Inspect bounded raster/container headers before allocating decoded pixels. */
export async function imageHeader(blob: Blob): Promise<ImageHeader> {
  if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw new Error('Image size limit exceeded');
  const b = new Uint8Array(await blob.slice(0, 256 * 1024).arrayBuffer()),
    v = new DataView(b.buffer);
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  let width = 0,
    height = 0,
    mime = '',
    rotate = 1;
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
      width = v.getUint16(26, true) & 16383;
      height = v.getUint16(28, true) & 16383;
    } else if (ascii(12, 4) === 'VP8L' && b[20] === 47) {
      const bits = v.getUint32(21, true);
      width = (bits & 16383) + 1;
      height = ((bits >>> 14) & 16383) + 1;
    }
  } else if (b[0] === 255 && b[1] === 216) {
    mime = 'image/jpeg';
    let pos = 2,
      exifRead = false;
    const read = async (at: number, n: number) =>
      at + n <= b.length
        ? b.subarray(at, at + n)
        : new Uint8Array(await blob.slice(at, Math.min(at + n, blob.size)).arrayBuffer());
    for (let segments = 0; segments < 2048 && pos + 4 <= blob.size; segments++) {
      const head = await read(pos, 12);
      if (head[0] !== 255) break;
      let skip = 1;
      while (head[skip] === 255) skip++;
      const marker = head[skip];
      pos += skip + 1;
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = (head[skip + 1] << 8) | head[skip + 2];
      if (length < 2 || pos + length > blob.size) break;
      if (marker === 225 && !exifRead) {
        const exif = await read(pos + 2, length - 2);
        if (String.fromCharCode(...exif.subarray(0, 6)) === 'Exif\0\0') {
          rotate = orientation(exif);
          exifRead = true;
        }
      }
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        const size = await read(pos, 7);
        height = (size[3] << 8) | size[4];
        width = (size[5] << 8) | size[6];
        break;
      }
      pos += length;
    }
  }
  if (!width || !height || width * height > 40_000_000 || width > 32768 || height > 32768)
    throw new Error('Image has invalid or excessive dimensions');
  return rotate >= 5 && rotate <= 8
    ? { width: height, height: width, mime }
    : { width, height, mime };
}
