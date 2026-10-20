/** Compatibility entry point. Shared infrastructure lives in core/media. */
import { assetPath } from './media/paths';
import { classifyMedia } from './media/classify';
import { MAX_IMAGE_BYTES } from './media/imageHeader';
export { imageHeader, MAX_IMAGE_BYTES, type ImageHeader } from './media/imageHeader';
export { MediaResources as ImageResources } from './media/resources';
export function resolveImage(
  reference: string,
  source: string,
  assets: Map<string, Blob>,
): string | null {
  try {
    const asset = assetPath(reference, source, assets);
    return classifyMedia(asset.resolvedPath).kind === 'image' && asset.blob.size <= MAX_IMAGE_BYTES
      ? asset.resolvedPath
      : null;
  } catch {
    return null;
  }
}
