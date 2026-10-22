import type { Bank, Paper, Question } from '../types';
import { useTranslation } from 'react-i18next';
import { plainText } from '../core/markup';
import { questionTypeKey } from '../i18n/questionTypeLabels';
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
  const { t, i18n } = useTranslation();
  const numbers = new Intl.NumberFormat(i18n.resolvedLanguage);
  const groupCount = (count: number, key: string) =>
    t(key, { count, formattedCount: numbers.format(count) });
  const preview = (q: Question) =>
    plainText(
      q.displayTitle ||
        q.topic ||
        q.parts.find((part) => part.prompt || part.context)?.prompt ||
        q.parts.find((part) => part.prompt || part.context)?.context ||
        q.context,
    ) || t(questionTypeKey(q.kind));
  return (
    <aside
      className="sidebar"
      aria-label={t(paper ? 'navigation.questionsWithinPaper' : 'navigation.paperList')}
      aria-hidden={hidden || undefined}
      inert={hidden}
    >
      <div className="sidebar-heading">
        {paper ? (
          <>
            <button className="back-button" onClick={onBack}>
              <Icon name="arrow" size={16} />
              {t('navigation.allPapers')}
            </button>
            <h2 title={paper.id}>{paper.id}</h2>
            <p>{groupCount(paper.questions.length, 'navigation.questionGroupCount')}</p>
          </>
        ) : (
          <>
            <h2>
              {t('navigation.allPapers')}
              <span className="badge">{numbers.format(bank.papers.length)}</span>
            </h2>
            <p>{t('navigation.selectPaper')}</p>
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
                  <span>{t(questionTypeKey(q.kind))}</span>
                </span>
                <span className="row-preview">{preview(q).slice(0, 240)}</span>
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
                      {groupCount(p.questions.length, 'navigation.groupCount')}
                      {modified !== null && (
                        <>
                          {' '}
                          ·{' '}
                          {new Date(modified).toLocaleDateString(i18n.resolvedLanguage, {
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
        {!bank.papers.length && <p className="list-empty">{t('navigation.noPapers')}</p>}
      </div>
      <div className="sidebar-footer">
        <p title={bank.name}>
          <span className="local-dot" />
          {bank.name}
        </p>
        <button className="change-button" onClick={onChange}>
          <Icon name="folder" size={16} />
          {t('navigation.changeBank')}
        </button>
        <small>{t('navigation.sessionOnly')}</small>
      </div>
    </aside>
  );
}
