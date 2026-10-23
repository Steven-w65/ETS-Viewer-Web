import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBank } from './hooks/useBank';
import { useTheme } from './hooks/useTheme';
import { ImportScreen } from './components/ImportScreen';
import { BankNavigation } from './components/BankNavigation';
import { Navigation } from './components/Navigation';
import { Reader } from './components/Reader';
import { Warnings } from './components/Warnings';
import { Icon } from './components/Icon';
import type { Paper } from './types';
import { Toast } from './components/Toast';
import { downloadPaper } from './core/exporter';
import { usePresence } from './hooks/useMotion';
import { AnswerPreview } from './components/AnswerPreview';
import { LanguageSettings } from './components/LanguageSettings';
import { questionTypeKey } from './i18n/questionTypeLabels';
export default function App() {
  const { t, i18n } = useTranslation();
  const numbers = new Intl.NumberFormat(i18n.resolvedLanguage);
  const state = useBank(),
    { theme, setTheme } = useTheme();
  const [paperKey, setPaperKey] = useState<string | null>(null),
    [index, setIndex] = useState(0),
    [screen, setScreen] = useState<'papers' | 'questions' | 'reading'>('papers'),
    [collapsed, setCollapsed] = useState(false),
    [settings, setSettings] = useState(false),
    [toastKey, setToastKey] = useState('');
  const settingsPresent = usePresence(settings, 'overlay');
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 720px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 720px)');
    const change = () => setMobile(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  const listRef = useRef<HTMLDivElement>(null),
    readingRef = useRef<HTMLDivElement>(null),
    scrolls = useRef(new Map<string, number>()),
    settingsRef = useRef<HTMLDivElement>(null),
    settingsButton = useRef<HTMLButtonElement>(null);
  const dismissSettings = () => {
    if (settingsRef.current?.querySelector('.settings-menu')?.contains(document.activeElement))
      settingsButton.current?.focus();
    setSettings(false);
  };
  const bank = state.bank,
    paper = bank?.papers.find((p) => p.key === paperKey),
    question = paper?.questions[index];
  useEffect(() => {
    setPaperKey(null);
    setIndex(0);
    setScreen('papers');
    scrolls.current.clear();
  }, [bank]);
  useEffect(() => {
    if (!toastKey) return;
    const id = setTimeout(() => setToastKey(''), 4000);
    return () => clearTimeout(id);
  }, [toastKey]);
  useEffect(() => {
    if (!settings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissSettings();
    };
    const outside = (e: PointerEvent) => {
      if (!settingsRef.current?.contains(e.target as Node)) dismissSettings();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', outside);
    };
  }, [settings]);
  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = scrolls.current.get(paperKey ?? 'all') ?? 0;
  }, [paperKey, screen]);
  useLayoutEffect(() => {
    if (readingRef.current) readingRef.current.scrollTop = 0;
  }, [question?.source]);
  const choosePaper = (p: Paper) => {
    setPaperKey(p.key);
    setIndex(0);
    setScreen('questions');
  };
  const chooseQuestion = (i: number) => {
    if (!paper || i < 0 || i >= paper.questions.length) return;
    setIndex(i);
    setScreen('reading');
  };
  const allPapers = () => {
    setPaperKey(null);
    setIndex(0);
    setScreen('papers');
  };
  const exportPaper = () => {
    if (!paper) return;
    try {
      downloadPaper(paper.id, paper.questions);
      setToastKey('export.ready');
    } catch {
      setToastKey('export.failed');
    }
  };
  return (
    <div
      className={'app ' + (bank ? 'has-bank ' : '') + (collapsed ? 'sidebar-collapsed' : '')}
      data-screen={screen}
    >
      <header className="app-header">
        <div className="brand">
          {bank && (
            <button
              className="icon-button sidebar-toggle"
              aria-label={t(collapsed ? 'header.expandSidebar' : 'header.collapseSidebar')}
              onClick={() => setCollapsed(!collapsed)}
            >
              <Icon name="sidebar" />
            </button>
          )}
          <Icon name="book" size={20} />
          <span>ETS Viewer</span>
          <a
            className="github-link"
            href="https://github.com/Steven-w65/ETS-Viewer-Web"
            target="_blank"
            rel="noopener noreferrer"
            title={t('header.github')}
            aria-label={t('header.github')}
          >
            <Icon name="github" size={18} />
          </a>
          <span className="app-tag">{t('header.web')}</span>
        </div>
        <div className="header-actions">
          {bank && (
            <Warnings
              issues={bank.issues}
              hasQuestions={bank.papers.some((p) => p.questions.length > 0)}
              onOpen={() => setSettings(false)}
            />
          )}
          <div className="settings-wrap" ref={settingsRef}>
            <button
              className="settings-button"
              ref={settingsButton}
              aria-expanded={settings}
              aria-controls="appearance-settings"
              onClick={() => (settings ? dismissSettings() : setSettings(true))}
            >
              <Icon name="settings" size={17} />
              <span>{t('settings.title')}</span>
            </button>
            {settingsPresent && (
              <div
                className={'settings-menu' + (!settings ? ' is-leaving' : '')}
                id="appearance-settings"
                aria-hidden={!settings}
                inert={!settings}
              >
                <LanguageSettings />
                <p>{t('settings.appearance')}</p>
                {(['system', 'light', 'dark'] as const).map((mode) => (
                  <label key={mode}>
                    <input
                      type="radio"
                      name="appearance"
                      value={mode}
                      checked={theme === mode}
                      onChange={() => setTheme(mode)}
                    />
                    <span>{t('settings.theme.' + mode)}</span>
                    {theme === mode && <Icon name="check" size={16} />}
                  </label>
                ))}
                <small>{t('settings.preferencesHelp')}</small>
              </div>
            )}
          </div>
        </div>
      </header>
      {!bank ? (
        <ImportScreen
          onFolder={state.importFolder}
          onZip={state.importZip}
          error={state.error}
          errorDescriptor={state.errorDescriptor}
          progress={state.progress}
          onCancel={state.cancel}
        />
      ) : (
        <div className="bank-layout">
          <BankNavigation
            hidden={collapsed && !mobile}
            bank={bank}
            paper={paper}
            index={index}
            onPaper={choosePaper}
            onQuestion={chooseQuestion}
            onBack={allPapers}
            onChange={state.changeBank}
            listRef={listRef}
            onScroll={(top) => scrolls.current.set(paperKey ?? 'all', top)}
          />
          <main className="workspace">
            {paper && question ? (
              <>
                <div className="reading-header">
                  <div className="reading-heading">
                    <button
                      className="icon-button mobile-back"
                      aria-label={t('navigation.backToQuestions')}
                      onClick={() => setScreen('questions')}
                    >
                      <Icon name="arrow" />
                    </button>
                    <div>
                      <div className="breadcrumb">
                        {paper.id}
                        <span>/</span>
                        {t(questionTypeKey(question.kind))}
                      </div>
                      <h1>{t('header.question', { id: question.id })}</h1>
                    </div>
                  </div>
                  <div className="paper-actions">
                    <AnswerPreview key={paper.key} paper={paper} />
                    <button
                      className="export-button"
                      aria-label={t('export.paper')}
                      title={t('export.paper')}
                      onClick={exportPaper}
                    >
                      <Icon name="download" size={16} />
                      <span>{t('export.paper')}</span>
                    </button>
                  </div>
                </div>
                <div className="reading-scroll" ref={readingRef}>
                  {state.resources && (
                    <Reader
                      key={question.source}
                      question={question}
                      resources={state.resources}
                      active={!mobile || screen === 'reading'}
                    />
                  )}
                </div>
                <Navigation
                  index={index}
                  total={paper.questions.length}
                  onChange={chooseQuestion}
                />
              </>
            ) : (
              <div className="overview-scroll">
                <div className="overview">
                  <div className="overview-symbol">
                    <Icon name="folder" size={20} />
                  </div>
                  <h1>{t(bank.papers.length ? 'statistics.selectPaper' : 'statistics.noExams')}</h1>
                  <p>
                    {t(bank.papers.length ? 'statistics.selectHelp' : 'statistics.noExamsHelp')}
                  </p>
                  <div className="bank-name">{bank.name}</div>
                  <div className="stats">
                    <div>
                      <strong>{numbers.format(bank.papers.length)}</strong>
                      <span>{t('statistics.papers')}</span>
                    </div>
                    <div>
                      <strong>
                        {numbers.format(bank.papers.reduce((n, p) => n + p.questions.length, 0))}
                      </strong>
                      <span>{t('statistics.questionGroups')}</span>
                    </div>
                    <div>
                      <strong>
                        {numbers.format(
                          bank.papers.reduce(
                            (n, p) => n + p.questions.reduce((m, q) => m + q.parts.length, 0),
                            0,
                          ),
                        )}
                      </strong>
                      <span>{t('statistics.subQuestions')}</span>
                    </div>
                  </div>
                  <p className="overview-note">
                    <Icon name="shield" size={16} />
                    {t('statistics.sessionOnly')}
                  </p>
                  {!bank.papers.length && (
                    <button className="outlined-button" onClick={state.changeBank}>
                      {t('navigation.changeBank')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </main>
          <div className="mobile-bank-notes">
            {!bank.papers.length && <p>{t('statistics.noExamsMobile')}</p>}
          </div>
        </div>
      )}
      <Toast message={toastKey ? t(toastKey) : ''} />
    </div>
  );
}
