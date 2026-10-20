import { useEffect, useState, type ReactNode } from 'react';
import type { Question, MediaReference } from '../types';
import type { ImageResources } from '../core/images';
import { plainText } from '../core/markup';
import { RichText } from './RichText';
import { LocalMedia } from './LocalMedia';
import { MediaVisibility } from './MediaVisibility';
import { Icon } from './Icon';
function Collapse({
  label,
  preview,
  count,
  children,
}: {
  label: string;
  preview?: string;
  count?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  useEffect(() => {
    if (open || !present) return;
    const timer = setTimeout(() => setPresent(false), 200);
    return () => clearTimeout(timer);
  }, [open, present]);
  const toggle = () => {
    if (!open) setPresent(true);
    else if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPresent(false);
    setOpen((value) => !value);
  };
  return (
    <div className={'collapse-card ' + (open ? 'is-open' : '')}>
      <button
        className="collapse-toggle"
        aria-label={[label, preview, count].filter(Boolean).join(' ')}
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="collapse-label">
          {label}
          {preview && <span className="collapse-preview">{preview}</span>}
        </span>
        {count && <span className="count-label">{count}</span>}
        <Icon name="chevron" size={16} />
      </button>
      <div className="collapse-shell" aria-hidden={!open} inert={!open}>
        <div className="collapse-inner">
          <MediaVisibility active={open} retain>
            {present && <div className="collapse-content">{children}</div>}
          </MediaVisibility>
        </div>
      </div>
    </div>
  );
}
export function Reader({
  question: q,
  resources,
  active = true,
}: {
  question: Question;
  resources: ImageResources;
  active?: boolean;
}) {
  const rich = (value: string, dialogue = false) => (
    <RichText value={value} source={q.source} resources={resources} dialogue={dialogue} />
  );
  const imgs = (refs: string[]) =>
    refs.map((r, i) => (
      <LocalMedia
        key={i}
        reference={r}
        source={q.source}
        resources={resources}
        fallbackKind="image"
      />
    ));
  const media = (refs: MediaReference[] = []) =>
    refs.map((m, i) => (
      <LocalMedia
        key={m.field + '-' + i}
        reference={m.reference}
        source={q.source}
        resources={resources}
        fallbackKind={m.kind}
      />
    ));
  const label = (i: number) => 'Q' + (q.parts[i].officialNumber || q.parts[i].number || i + 1);
  return (
    <MediaVisibility active={active}>
      <article className="reader" aria-label="Question and reference answers">
        {q.parts.length > 1 && (
          <nav className="part-nav" aria-label="Sub-questions">
            <span>Jump to</span>
            {q.parts.map((_, i) => (
              <button
                key={i}
                onClick={() =>
                  document.getElementById('part-' + i)?.scrollIntoView({
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'instant'
                      : 'smooth',
                    block: 'start',
                  })
                }
              >
                {label(i)}
              </button>
            ))}
          </nav>
        )}
        {q.topic && <div className="group-topic">{rich(q.topic)}</div>}
        {(q.context ||
          q.instructions ||
          q.images.length > 0 ||
          !!q.sharedMaterials?.length ||
          !!q.media?.length) && (
          <div className="shared-material">
            <Collapse
              label="Shared Material"
              preview={
                q.context
                  ? 'Passage, transcript & context'
                  : q.images.length
                    ? 'Images & context'
                    : 'Instructions'
              }
            >
              {q.instructions && (
                <section>
                  <h3>Instructions</h3>
                  {rich(q.instructions)}
                </section>
              )}
              {q.context && rich(q.context, true)}
              {q.sharedMaterials?.map((material, i) => (
                <section key={i}>
                  <h3>{material.label}</h3>
                  {rich(material.text, true)}
                  {imgs(material.images || [])}
                  {media(material.media)}
                </section>
              ))}
              {imgs(q.images)}
              {media(q.media)}
            </Collapse>
          </div>
        )}
        {q.parts.map((p, i) => (
          <section
            className={
              'part-section' +
              (i === q.parts.length - 1 && (q.keyPoints || q.explanation)
                ? ' has-group-supplements'
                : '')
            }
            id={'part-' + i}
            key={i}
            aria-labelledby={'part-label-' + i}
          >
            <h2 id={'part-label-' + i}>
              {label(i)}
              <span> / {q.parts.length}</span>
            </h2>
            <Collapse
              label="Question"
              preview={plainText(p.prompt || p.context).slice(0, 240) || 'View original question'}
            >
              {p.prompt && rich(p.prompt)}
              {p.context && (
                <section className="transcript">
                  <h3>Transcript</h3>
                  {rich(p.context, true)}
                </section>
              )}
              {imgs(p.images)}
              {media(p.media)}
              {p.supplements?.map((supplement, j) => (
                <section key={j}>
                  <h3>{supplement.label}</h3>
                  {rich(supplement.text)}
                  {imgs(supplement.images || [])}
                  {media(supplement.media)}
                </section>
              ))}
              {p.options.length > 0 && (
                <section>
                  <h3>Options</h3>
                  <div className="options">
                    {p.options.map((o, j) => (
                      <div className="option" key={j}>
                        <span className="option-label">{plainText(o.label)}.</span>
                        <div className="option-content">
                          {o.text && rich(o.text)}
                          {imgs(o.images || [])}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </Collapse>
            <div className={'answer-card ' + (!p.answers.length ? 'answer-missing' : '')}>
              <h3>{p.answers.length > 0 && <Icon name="check" size={16} />}REFERENCE ANSWER</h3>
              {p.answers.length ? rich(p.answers[0].text) : <p>Answer not found</p>}
              {p.answers.length > 0 && media(p.answers[0].media)}
            </div>
            {p.answers.length > 1 && (
              <Collapse label="Additional Reference Answers" count={`${p.answers.length - 1} more`}>
                <div className="additional-answers">
                  {p.answers.slice(1).map((a, j) => (
                    <div key={j}>
                      {rich(a.text)}
                      {media(a.media)}
                    </div>
                  ))}
                </div>
              </Collapse>
            )}
            {p.translation && (
              <div className="supplement">
                <h3>Translation</h3>
                {rich(p.translation)}
              </div>
            )}
            {p.explanation && <Collapse label="Explanation">{rich(p.explanation)}</Collapse>}
          </section>
        ))}
        {(q.keyPoints || q.explanation) && (
          <div className="group-supplements">
            {q.keyPoints && <Collapse label="Key Points">{rich(q.keyPoints)}</Collapse>}
            {q.explanation && <Collapse label="Explanation">{rich(q.explanation)}</Collapse>}
          </div>
        )}
        <p className="reader-footnote">
          Reference answers are shown exactly as stored in your bank.
        </p>
      </article>
    </MediaVisibility>
  );
}
