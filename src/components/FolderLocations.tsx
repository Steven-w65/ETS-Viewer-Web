import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon';
import { AnimatedPanel } from './AnimatedDisclosure';
import { restoreDisclosureFocus } from '../hooks/useMotion';
const locations = {
  Windows: {
    path: '%APPDATA%\\ETS',
    instruction: 'Press Win + R, paste the path, and press Enter.',
  },
  Android: {
    path: '/storage/emulated/0/Android/data/com.ets100.secondary/files/Download/ETS_SECONDARY/resource',
    instruction:
      'Android may restrict access to this folder. If necessary, import an accessible copy or ZIP archive.',
  },
};
const platforms = ['Windows', 'Android'] as const;
type Platform = (typeof platforms)[number];
export function FolderLocations() {
  const [open, setOpen] = useState(false),
    [platform, setPlatform] = useState<Platform>('Windows'),
    [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    request = useRef(0),
    tabs = useRef<Partial<Record<Platform, HTMLButtonElement | null>>>({});
  const location = locations[platform];
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  useEffect(() => {
    if (copyState !== 'copied') return;
    const timer = setTimeout(() => setCopyState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copyState]);
  function select(next: Platform, focus = false) {
    request.current++;
    setCopyState('idle');
    setPlatform(next);
    if (focus) tabs.current[next]?.focus();
  }
  function move(event: KeyboardEvent<HTMLButtonElement>) {
    let next: Platform;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      next = platform === 'Windows' ? 'Android' : 'Windows';
    else if (event.key === 'Home') next = 'Windows';
    else if (event.key === 'End') next = 'Android';
    else return;
    event.preventDefault();
    select(next, true);
  }
  async function copy() {
    const current = ++request.current;
    setCopyState('copying');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(location.path);
      if (request.current === current) setCopyState('copied');
    } catch {
      if (request.current === current) setCopyState('failed');
    }
  }
  return (
    <section className={'folder-guide' + (open ? ' is-open' : '')}>
      <button
        type="button"
        className="folder-guide-toggle disclosure-toggle"
        ref={trigger}
        aria-expanded={open}
        aria-controls={id + '-body'}
        onClick={() => {
          request.current++;
          setCopyState('idle');
          if (open) restoreDisclosureFocus(id + '-body', trigger.current);
          setOpen(!open);
        }}
      >
        <Icon name="folder" size={16} />
        <span>Where are my question files?</span>
        <Icon name="chevron" size={16} />
      </button>
      <AnimatedPanel
        className="folder-guide-shell"
        innerClassName="folder-guide-inner"
        id={id + '-body'}
        open={open}
      >
        <div className="folder-guide-content">
          <div className="folder-guide-tabs" role="tablist" aria-label="Question bank platform">
            {platforms.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                id={id + '-' + name}
                aria-selected={platform === name}
                aria-controls={id + '-panel'}
                tabIndex={platform === name ? 0 : -1}
                ref={(node) => {
                  tabs.current[name] = node;
                }}
                onClick={() => select(name)}
                onKeyDown={move}
              >
                {name}
              </button>
            ))}
          </div>
          <div
            key={platform}
            className="platform-panel"
            role="tabpanel"
            id={id + '-panel'}
            aria-labelledby={id + '-' + platform}
          >
            <div className="folder-guide-path">
              <code>{location.path}</code>
              <button
                type="button"
                className="folder-guide-copy"
                aria-label={`Copy ${platform} folder path`}
                disabled={copyState === 'copying'}
                onClick={copy}
              >
                {copyState === 'copied' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="folder-guide-instruction">{location.instruction}</p>
          </div>
          <p
            className={'folder-guide-feedback' + (copyState === 'failed' ? ' is-error' : '')}
            role="status"
          >
            {copyState === 'copied'
              ? 'Path copied.'
              : copyState === 'failed'
                ? 'Could not copy. Select the path and copy it manually.'
                : ''}
          </p>
          <p className="folder-guide-disclaimer">Locations may vary by app version and device.</p>
        </div>
      </AnimatedPanel>
    </section>
  );
}
