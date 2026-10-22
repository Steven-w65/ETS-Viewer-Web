import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { Paper } from '../types';
import { previewAnswerText, selectAnswerPreview } from '../core/answerPreview';
import { usePresence } from '../hooks/useMotion';
import { Icon } from './Icon';

export function AnswerPreview({ paper }: { paper: Paper }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const present = usePresence(open, 'overlay');
  const trigger = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    close = useRef<HTMLButtonElement>(null),
    body = useRef<HTMLDivElement>(null),
    id = useId();
  const groups = useMemo(
    () =>
      present
        ? selectAnswerPreview(paper).map((group) => ({
            ...group,
            entries: group.entries.map((entry) => ({
              ...entry,
              text: previewAnswerText(entry.answer ?? '') || '—',
            })),
          }))
        : [],
    [present, paper],
  );
  useEffect(() => {
    if (!present) return;
    const node = dialog.current!,
      button = trigger.current,
      previous = document.body.style.overflow;
    node.showModal();
    close.current?.focus({ preventScroll: true });
    document.body.style.overflow = 'hidden';
    return () => {
      if (node.open) node.close();
      document.body.style.overflow = previous;
      if (button?.isConnected) button.focus({ preventScroll: true });
    };
  }, [present]);
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className="export-button preview-button"
        aria-label={t('preview.open')}
        aria-haspopup="dialog"
        aria-controls={id}
        title={t('preview.openDescription', { paper: paper.title || paper.id })}
        onClick={() => setOpen(true)}
      >
        <Icon name="eye" size={16} />
        <span>{t('preview.open')}</span>
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          id={id}
          className={'answer-preview-dialog' + (!open ? ' is-leaving' : '')}
          aria-labelledby={id + '-title'}
          onCancel={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Tab') {
              event.preventDefault();
              const next = document.activeElement === close.current ? body.current : close.current;
              next?.focus({ preventScroll: true });
            }
          }}
        >
          <div className="answer-preview-header">
            <div>
              <h2 id={id + '-title'}>{t('preview.title')}</h2>
              <p>{paper.title || paper.id}</p>
            </div>
            <button
              type="button"
              className="icon-button"
              ref={close}
              aria-label={t('preview.close')}
              title={t('common.close')}
              onClick={() => setOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <div
            ref={body}
            className="answer-preview-body"
            tabIndex={0}
            role="region"
            aria-label={t('preview.region')}
          >
            {!groups.length && <p className="preview-empty">{t('preview.empty')}</p>}
            {groups.map((group, index) => (
              <section
                className="preview-group"
                key={group.id}
                aria-labelledby={id + '-group-' + index}
              >
                <h3 id={id + '-group-' + index}>
                  {t(group.label)}
                  {group.numberLabel && <> · {group.numberLabel}</>}
                </h3>
                {!group.entries.length && <p className="preview-empty">{t('preview.empty')}</p>}
                <div className={group.isMultipleChoice ? 'preview-choices' : 'preview-text-list'}>
                  {group.entries.map((entry) => (
                    <div className="preview-entry" key={entry.id}>
                      <span className="preview-number">{entry.number}.</span>
                      <span
                        className={
                          group.isMultipleChoice
                            ? 'preview-choice-box' +
                              (/^[a-z]$/i.test(entry.text) ? ' is-single-choice' : '')
                            : 'preview-answer'
                        }
                      >
                        {entry.text}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </dialog>,
        document.body,
      )}
    </>
  );
}
