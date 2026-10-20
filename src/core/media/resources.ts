import { resolveMedia } from './resolve';
import { mediaError, MediaError, type MediaDiagnostic, type ResolvedMedia } from './types';
export interface MediaLease extends ResolvedMedia {
  url: string;
  release(): void;
}
interface URLRecord {
  url: string;
  users: number;
  decoded?: Promise<void>;
}
/** A bank owns bytes; mounted consumers own URL leases. Validation never decodes video. */
export class MediaResources {
  readonly diagnostics: MediaDiagnostic[] = [];
  private disposed = false;
  private validation = new Map<string, Promise<ResolvedMedia>>();
  private urls = new Map<string, URLRecord>();
  private legacy = new Map<string, Promise<MediaLease>>();
  private legacyHeld = new Set<MediaLease>();
  constructor(private assets: Map<string, Blob>) {}
  report(diagnostic: MediaDiagnostic) {
    if (
      !this.diagnostics.some(
        (d) =>
          d.path === diagnostic.path &&
          d.reference === diagnostic.reference &&
          d.category === diagnostic.category &&
          d.resolvedPath === diagnostic.resolvedPath,
      )
    )
      this.diagnostics.push(diagnostic);
  }
  async acquire(reference: string, source: string): Promise<MediaLease> {
    if (this.disposed) throw mediaError('blob_lifecycle', reference, source, 'unknown');
    const key = JSON.stringify([source, reference]);
    try {
      if (!this.validation.has(key))
        this.validation.set(key, resolveMedia(reference, source, this.assets));
      const media = await this.validation.get(key)!;
      if (this.disposed)
        throw mediaError('blob_lifecycle', reference, source, media.kind, [], media.resolvedPath);
      media.diagnostics.forEach((d) => this.report(d));
      let record = this.urls.get(media.resolvedPath);
      if (!record) {
        let url: string;
        try {
          url = URL.createObjectURL(media.blob.slice(0, media.blob.size, media.mimeType));
        } catch {
          throw mediaError('blob_lifecycle', reference, source, media.kind, [], media.resolvedPath);
        }
        record = { url, users: 0 };
        this.urls.set(media.resolvedPath, record);
      }
      record.users++;
      let released = false;
      const held = record;
      const release = () => {
        if (released) return;
        released = true;
        held.users--;
        if (held.users === 0) {
          URL.revokeObjectURL(held.url);
          if (this.urls.get(media.resolvedPath) === held) this.urls.delete(media.resolvedPath);
        }
      };
      try {
        if (media.kind === 'image') {
          if (!held.decoded)
            held.decoded = (async () => {
              const image = new Image();
              image.src = held.url;
              await image.decode();
              if (
                image.naturalWidth !== media.header!.width ||
                image.naturalHeight !== media.header!.height
              )
                throw mediaError(
                  'image_decode',
                  reference,
                  source,
                  'image',
                  [],
                  media.resolvedPath,
                );
            })();
          await held.decoded;
        }
        if (this.disposed)
          throw mediaError('blob_lifecycle', reference, source, media.kind, [], media.resolvedPath);
        return { ...media, url: held.url, release };
      } catch (error) {
        release();
        throw error instanceof MediaError
          ? error
          : mediaError('image_decode', reference, source, media.kind, [], media.resolvedPath);
      }
    } catch (error) {
      if (error instanceof MediaError) this.report(error.diagnostic);
      throw error;
    }
  }
  /** Compatibility for callers of the previous bank-scoped image loader. UI uses leases. */
  async load(reference: string, source: string) {
    const key = JSON.stringify([source, reference]);
    if (!this.legacy.has(key)) this.legacy.set(key, this.acquire(reference, source));
    const lease = await this.legacy.get(key)!;
    if (lease.kind !== 'image') {
      lease.release();
      throw mediaError('type_mismatch', reference, source, lease.kind, [], lease.resolvedPath);
    }
    this.legacyHeld.add(lease);
    return { url: lease.url, header: lease.header! };
  }
  dispose() {
    this.disposed = true;
    for (const lease of this.legacyHeld) lease.release();
    this.legacyHeld.clear();
    for (const lease of this.legacy.values())
      void lease.then(
        (value) => value.release(),
        () => {},
      );
    this.legacy.clear();
    this.validation.clear();
    this.assets = new Map();
    // Active UI leases remain valid until their owners pause/detach and release.
  }
}
