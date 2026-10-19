import { useState, type ReactNode } from 'react';
import type { Question } from '../types';
import type { ImageResources } from '../core/images';
import { plainText } from '../core/markup';
import { LocalImage, RichText } from './RichText';
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
  return (
    <div className={'collapse-card ' + (open ? 'is-open' : '')}>
      <button
        className="collapse-toggle"
        aria-label={[label, preview, count].filter(Boolean).join(' ')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="collapse-label">
          {label}
          {preview && <span className="collapse-preview">{preview}</span>}
        </span>
        {count && <span className="count-label">{count}</span>}
        <Icon name="chevron" size={16} />
      </button>
      {open && <div className="collapse-content">{children}</div>}
    </div>
  );
}
export function Reader({
  question: q,
  resources,
}: {
  question: Question;
  resources: ImageResources;
}) {
  const rich = (value: string, dialogue = false) => (
    <RichText value={value} source={q.source} resources={resources} dialogue={dialogue} />
  );
  const imgs = (refs: string[]) =>
    refs.map((r, i) => (
      <LocalImage key={i} reference={r} source={q.source} resources={resources} />
    ));
  const label = (i: number) => 'Q' + (q.parts[i].number || i + 1);
  return (
    <article className="reader" aria-label="Question and reference answers">
      {q.parts.length > 1 && (
        <nav className="part-nav" aria-label="Sub-questions">
          <span>Jump to</span>
          {q.parts.map((_, i) => (
            <button
              key={i}
              onClick={() =>
                document
                  .getElementById('part-' + i)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              {label(i)}
            </button>
          ))}
        </nav>
      )}
      {q.topic && <div className="group-topic">{rich(q.topic)}</div>}
      {(q.context || q.instructions || q.images.length > 0) && (
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
            {imgs(q.images)}
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
            {p.options.length > 0 && (
              <section>
                <h3>Options</h3>
                <div className="options">
                  {p.options.map((o, j) => (
                    <div className="option" key={j}>
                      <span className="option-label">{plainText(o.label)}.</span>
                      {rich(o.text)}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </Collapse>
          <div className={'answer-card ' + (!p.answers.length ? 'answer-missing' : '')}>
            <h3>{p.answers.length > 0 && <Icon name="check" size={16} />}REFERENCE ANSWER</h3>
            {p.answers.length ? rich(p.answers[0].text) : <p>Answer not found</p>}
          </div>
          {p.answers.length > 1 && (
            <Collapse label="Additional Reference Answers" count={`${p.answers.length - 1} more`}>
              <div className="additional-answers">
                {p.answers.slice(1).map((a, j) => (
                  <div key={j}>{rich(a.text)}</div>
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
      <p className="reader-footnote">Reference answers are shown exactly as stored in your bank.</p>
    </article>
  );
}
