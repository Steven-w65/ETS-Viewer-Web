import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Issue } from '../types';
import { diagnosticReference, importWarnings, issueTitle } from '../core/diagnostics';
import { Icon } from './Icon';
import { AnimatedDisclosure } from './AnimatedDisclosure';
import { motionDuration, useReducedMotion } from '../hooks/useMotion';
export function Warnings({
  issues,
  hasQuestions,
  onOpen,
}: {
  issues: Issue[];
  hasQuestions: boolean;
  onOpen?: () => void;
}) {
  const warnings = useMemo(() => importWarnings(issues), [issues]);
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed'),
    [limit, setLimit] = useState(100);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    close = useRef<HTMLButtonElement>(null),
    id = useId();
  const visible = phase !== 'closed';
  const reduced = useReducedMotion();
  useEffect(() => {
    setPhase('closed');
    setLimit(100);
  }, [issues]);
  useEffect(() => {
    if (!visible) return;
    const node = dialog.current!,
      button = trigger.current,
      previous = document.body.style.overflow;
    node.showModal();
    close.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      if (node.open) node.close();
      document.body.style.overflow = previous;
      if (button?.isConnected) button.focus();
    };
  }, [visible]);
  useEffect(() => {
    if (phase !== 'closing') return;
    const timer = setTimeout(() => setPhase('closed'), motionDuration('overlay'));
    return () => clearTimeout(timer);
  }, [phase, reduced]);
  if (!warnings.length) return null;
  const count = warnings.length.toLocaleString(),
    noun = warnings.length === 1 ? 'warning' : 'warnings';
  const dismiss = () => setPhase('closing');
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className="warnings-button"
        aria-label={`View ${count} import ${noun}`}
        aria-haspopup="dialog"
        aria-controls={id}
        onClick={() => {
          onOpen?.();
          setPhase('open');
        }}
      >
        <Icon name="warning" size={16} />
        <span>{count}</span>
      </button>
      <dialog
        ref={dialog}
        id={id}
        className={'warning-dialog' + (phase === 'closing' ? ' is-leaving' : '')}
        aria-labelledby={id + '-title'}
        aria-describedby={hasQuestions ? id + '-intro' : undefined}
        onCancel={(event) => {
          event.preventDefault();
          dismiss();
        }}
        onClose={() => setPhase('closed')}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const targets = [
            ...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), summary'),
          ];
          const first = targets[0],
            last = targets.at(-1);
          if (document.activeElement === (event.shiftKey ? first : last)) {
            event.preventDefault();
            (event.shiftKey ? last : first)?.focus();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dismiss();
        }}
      >
        <div className="warning-dialog-header">
          <div>
            <h2 id={id + '-title'}>Import warnings</h2>
            <p>
              {count} {noun}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            ref={close}
            aria-label="Close import warnings"
            onClick={dismiss}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="warning-dialog-body">
          {hasQuestions && (
            <p id={id + '-intro'} className="warning-dialog-intro">
              Some resources could not be loaded. Other questions remain available.
            </p>
          )}
          <ul className="warning-list" aria-label="Import warning details">
            {warnings.slice(0, limit).map((issue, i) => {
              const reference = diagnosticReference(issue);
              return (
                <li key={i}>
                  <Icon name="warning" size={16} />
                  <div className="warning-entry">
                    <h3>{issueTitle(issue)}</h3>
                    <dl>
                      {reference && (
                        <>
                          <dt>
                            {issue.category === 'file_not_found' ? 'Missing file' : 'Resource'}
                          </dt>
                          <dd>
                            <code>{reference}</code>
                          </dd>
                        </>
                      )}
                      {!reference && issue.category && (
                        <>
                          <dt>Resource</dt>
                          <dd>
                            {issue.category === 'unsafe_path'
                              ? 'The unsafe reference was withheld.'
                              : 'The referenced resource could not be identified.'}
                          </dd>
                        </>
                      )}
                      <dt>Source</dt>
                      <dd>
                        <code>{issue.path || 'Source record unavailable'}</code>
                      </dd>
                    </dl>
                    {(!!issue.candidates?.length ||
                      issue.resolvedPath ||
                      issue.field ||
                      issue.code) && (
                      <AnimatedDisclosure variant="technical" label="Technical details">
                        <dl>
                          {issue.code && (
                            <>
                              <dt>Code</dt>
                              <dd>
                                <code>{issue.code}</code>
                              </dd>
                            </>
                          )}
                          {issue.field && (
                            <>
                              <dt>Source field</dt>
                              <dd>
                                <code>{issue.field}</code>
                              </dd>
                            </>
                          )}
                          {issue.resolvedPath && (
                            <>
                              <dt>Resolved file</dt>
                              <dd>
                                <code>{issue.resolvedPath}</code>
                              </dd>
                            </>
                          )}
                          {!!issue.candidates?.length && (
                            <>
                              <dt>Attempted paths</dt>
                              <dd className="warning-candidates">
                                {issue.candidates.map((path) => (
                                  <code key={path}>{path}</code>
                                ))}
                              </dd>
                            </>
                          )}
                        </dl>
                      </AnimatedDisclosure>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {limit < warnings.length && (
            <>
              <p className="warning-dialog-intro">
                Showing {limit.toLocaleString()} of {count} warnings.
              </p>
              <button type="button" onClick={() => setLimit((n) => n + 100)}>
                Show more warnings
              </button>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
