import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { classifyMedia } from '../core/media/classify';
import { MediaError, mediaError, type MediaKind } from '../core/media/types';
import { MediaResources, type MediaLease } from '../core/media/resources';
import { useMediaVisible } from './MediaVisibility';
function stop(element: HTMLMediaElement | null) {
  if (!element) return;
  element.pause();
  element.removeAttribute('src');
  element.load();
}
export function LocalMedia({
  reference,
  alternatives,
  source,
  resources,
  fallbackKind = 'image',
}: {
  reference: string;
  alternatives?: string[];
  source: string;
  resources: MediaResources;
  fallbackKind?: MediaKind;
}) {
  const { t } = useTranslation();
  const { active, present } = useMediaVisible(),
    [lease, setLease] = useState<MediaLease | null>(null),
    [failed, setFailed] = useState<{ kind: MediaKind; unsupported?: boolean } | null>(null),
    [attempt, setAttempt] = useState(0);
  const element = useRef<HTMLMediaElement | null>(null);
  const ref = attempt === 0 ? reference : alternatives?.[attempt - 1] || reference;
  const count = alternatives?.length || 0;
  useEffect(() => {
    setAttempt(0);
  }, [reference, source]);
  useEffect(() => {
    let cancelled = false,
      held: MediaLease | undefined;
    setLease(null);
    setFailed(null);
    if (!present) return;
    resources.acquire(ref, source).then(
      (value) => {
        if (cancelled) {
          value.release();
          return;
        }
        held = value;
        setLease(value);
      },
      (error) => {
        if (cancelled) return;
        if (attempt < count) {
          setAttempt((n) => n + 1);
          return;
        }
        const kind = classifyMedia(ref).kind;
        setFailed({ kind: kind === 'data' || kind === 'unknown' ? fallbackKind : kind });
        if (!(error instanceof MediaError))
          resources.report(mediaError('blob_lifecycle', ref, source, fallbackKind).diagnostic);
      },
    );
    return () => {
      cancelled = true;
      stop(element.current);
      element.current = null;
      held?.release();
    };
  }, [ref, source, resources, present, attempt, count, fallbackKind]);
  useEffect(() => {
    if (!active) element.current?.pause();
  }, [active, lease]);
  useEffect(() => {
    const node = element.current;
    if (!node || !lease) return;
    const hidden = () => {
      if (document.hidden) node.pause();
    };
    document.addEventListener('visibilitychange', hidden);
    if (!node.canPlayType(lease.mimeType)) {
      resources.report(
        mediaError('unsupported_type', ref, source, lease.kind, [], lease.resolvedPath).diagnostic,
      );
      stop(node);
      lease.release();
      if (attempt < count) setAttempt((n) => n + 1);
      else setFailed({ kind: lease.kind, unsupported: true });
    }
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [lease, resources, ref, source, attempt, count]);
  if (!present) return null;
  const showFilename = ref.length <= 120 && !/[\\/:]/.test(ref) && !ref.startsWith('..');
  if (failed) {
    const kind = failed.kind === 'unknown' ? fallbackKind : failed.kind;
    return (
      <span className="image-fallback media-fallback" role="status">
        {failed.unsupported
          ? t('media.unsupported', { kind: t('diagnostics.kindLower.' + kind) })
          : t(showFilename ? 'media.unavailableWithName' : 'media.unavailable', {
              kind: t('diagnostics.kind.' + kind),
              filename: ref,
            })}
      </span>
    );
  }
  if (!lease)
    return (
      <span className="image-fallback" role="status">
        {t('media.loading')}
      </span>
    );
  const onError = () => {
    const errorCode = element.current?.error?.code;
    const category =
      errorCode === 4
        ? 'unsupported_type'
        : lease.kind === 'image'
          ? 'image_decode'
          : lease.kind === 'audio'
            ? 'audio_playback'
            : 'video_playback';
    resources.report(
      mediaError(category, ref, source, lease.kind, [], lease.resolvedPath).diagnostic,
    );
    stop(element.current);
    lease.release();
    if (attempt < count) {
      setAttempt((n) => n + 1);
      return;
    }
    setFailed({ kind: lease.kind, unsupported: lease.kind !== 'image' && errorCode === 4 });
  };
  if (lease.kind === 'image')
    return (
      <img
        className="source-image"
        src={lease.url}
        width={lease.header!.width}
        height={lease.header!.height}
        alt={reference}
        onError={onError}
      />
    );
  const props = {
    className: 'source-media',
    src: lease.url,
    controls: true,
    preload: 'metadata' as const,
    onError,
    'aria-label': t('media.label', {
      kind: t('diagnostics.kind.' + lease.kind),
      filename: reference,
    }),
    ref: (node: HTMLMediaElement | null) => {
      if (node) element.current = node;
    },
  };
  return lease.kind === 'audio' ? <audio {...props} /> : <video {...props} playsInline />;
}
