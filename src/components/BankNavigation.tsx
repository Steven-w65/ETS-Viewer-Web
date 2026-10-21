import type { Bank, Paper } from '../types';
import { questionKindLabel } from '../types';
import { questionTitle } from '../core/parser';
import { Icon } from './Icon';
import type { RefObject } from 'react';
import { validTimestamp } from '../core/dates';
export function BankNavigation({
  bank,
  paper,
  index,
  onPaper,
  onQuestion,
  onBack,
  onChange,
  listRef,
  onScroll,
  hidden = false,
}: {
  bank: Bank;
  paper: Paper | undefined;
  index: number;
  onPaper: (p: Paper) => void;
  onQuestion: (i: number) => void;
  onBack: () => void;
  onChange: () => void;
  listRef: RefObject<HTMLDivElement | null>;
  onScroll: (top: number) => void;
  hidden?: boolean;
}) {
  return (
    <aside
      className="sidebar"
      aria-label={paper ? 'Questions within paper' : 'Paper list'}
      aria-hidden={hidden || undefined}
      inert={hidden}
    >
      <div className="sidebar-heading">
        {paper ? (
          <>
            <button className="back-button" onClick={onBack}>
              <Icon name="arrow" size={16} />
              All Papers
            </button>
            <h2 title={paper.id}>{paper.id}</h2>
            <p>{paper.questions.length} question groups</p>
          </>
        ) : (
          <>
            <h2>
              All Papers<span className="badge">{bank.papers.length}</span>
            </h2>
            <p>Select a paper to explore</p>
          </>
        )}
      </div>
      <div
        className="nav-list"
        key={paper?.key || 'papers'}
        ref={listRef}
        onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
      >
        {paper
          ? paper.questions.map((q, i) => (
              <button
                className={'nav-row question-row ' + (index === i ? 'selected' : '')}
                key={q.source}
                aria-current={index === i ? 'true' : undefined}
                onClick={() => onQuestion(i)}
              >
                <span className="row-top">
                  <strong>{q.id}</strong>
                  <span>{questionKindLabel(q)}</span>
                </span>
                <span className="row-preview">{questionTitle(q).slice(0, 240)}</span>
              </button>
            ))
          : bank.papers.map((p) => {
              const modified = validTimestamp(p.modified);
              return (
                <button className="nav-row paper-row" key={p.key} onClick={() => onPaper(p)}>
                  <Icon name="folder" size={18} />
                  <span>
                    <strong>{p.id}</strong>
                    <small>
                      {p.questions.length} groups
                      {modified !== null && (
                        <>
                          {' '}
                          ·{' '}
                          {new Date(modified).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </>
                      )}
                    </small>
                  </span>
                  <span className="row-arrow">›</span>
                </button>
              );
            })}
        {!bank.papers.length && <p className="list-empty">No supported papers found.</p>}
      </div>
      <div className="sidebar-footer">
        <p title={bank.name}>
          <span className="local-dot" />
          {bank.name}
        </p>
        <button className="change-button" onClick={onChange}>
          <Icon name="folder" size={16} />
          Change Bank
        </button>
        <small>Local files · This session only</small>
      </div>
    </aside>
  );
}
