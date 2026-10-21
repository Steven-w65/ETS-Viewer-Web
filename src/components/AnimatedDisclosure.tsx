import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { restoreDisclosureFocus, usePresence } from '../hooks/useMotion';
import { Icon } from './Icon';
import { MediaVisibility } from './MediaVisibility';

export function AnimatedPanel({
  open,
  id,
  className = '',
  innerClassName = '',
  children,
}: {
  open: boolean;
  id: string;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const observed = typeof ResizeObserver !== 'undefined';
  useLayoutEffect(() => {
    if (!observed) return;
    const node = inner.current!;
    setHeight(node.getBoundingClientRect().height);
    // The inner flow never depends on the animated outer height. Observe only
    // intrinsic changes (media, text wrapping, tabs), not animation frames.
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [observed]);
  return (
    <div
      id={id}
      className={'animated-panel ' + className + (observed ? '' : ' is-unmeasured')}
      aria-hidden={!open}
      inert={!open}
      style={observed ? { height: open ? height : 0 } : undefined}
    >
      <div ref={inner} className={'animated-panel-inner ' + innerClassName}>
        {children}
      </div>
    </div>
  );
}

export function AnimatedDisclosure({
  label,
  preview,
  count,
  children,
  variant = 'card',
}: {
  label: string;
  preview?: string;
  count?: string;
  children: ReactNode;
  variant?: 'card' | 'technical';
}) {
  const [open, setOpen] = useState(false);
  const present = usePresence(open),
    id = useId(),
    trigger = useRef<HTMLButtonElement>(null);
  const technical = variant === 'technical';
  return (
    <div className={(technical ? 'warning-technical' : 'collapse-card') + (open ? ' is-open' : '')}>
      <button
        type="button"
        ref={trigger}
        className={(technical ? 'technical-toggle' : 'collapse-toggle') + ' disclosure-toggle'}
        aria-label={[label, preview, count].filter(Boolean).join(' ')}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          if (open) restoreDisclosureFocus(id, trigger.current);
          setOpen(!open);
        }}
      >
        <span className={technical ? undefined : 'collapse-label'}>
          {label}
          {preview && <span className="collapse-preview">{preview}</span>}
        </span>
        {count && <span className="count-label">{count}</span>}
        <Icon name="chevron" size={16} />
      </button>
      <AnimatedPanel open={open} id={id} className="collapse-shell" innerClassName="collapse-inner">
        <MediaVisibility active={open} retain>
          {present && (technical ? children : <div className="collapse-content">{children}</div>)}
        </MediaVisibility>
      </AnimatedPanel>
    </div>
  );
}
