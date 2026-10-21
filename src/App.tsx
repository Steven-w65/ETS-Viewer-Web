import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBank } from './hooks/useBank';
import { useTheme } from './hooks/useTheme';
import { ImportScreen } from './components/ImportScreen';
import { BankNavigation } from './components/BankNavigation';
import { Navigation } from './components/Navigation';
import { Reader } from './components/Reader';
import { Warnings } from './components/Warnings';
import { Icon } from './components/Icon';
import { questionKindLabel, type Paper } from './types';
import { Toast } from './components/Toast';
import { downloadPaper } from './core/exporter';
import { usePresence } from './hooks/useMotion';
export default function App() {
  const state = useBank(),
    { theme, setTheme } = useTheme();
  const [paperKey, setPaperKey] = useState<string | null>(null),
    [index, setIndex] = useState(0),
    [screen, setScreen] = useState<'papers' | 'questions' | 'reading'>('papers'),
    [collapsed, setCollapsed] = useState(false),
    [settings, setSettings] = useState(false),
    [toast, setToast] = useState('');
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
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(id);
  }, [toast]);
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
      setToast('Paper export ready. Your browser will save the file.');
    } catch {
      setToast('Export failed. Please try again.');
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
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed(!collapsed)}
            >
              <Icon name="sidebar" />
            </button>
          )}
          <Icon name="book" size={20} />
          <span>ETS Viewer</span>
          <a
            className="github-link"
            href="https://github.com/Steven-w65/ETS-Viewer-web"
            target="_blank"
            rel="noopener noreferrer"
            title="View on GitHub"
            aria-label="View on GitHub"
          >
            <Icon name="github" size={18} />
          </a>
          <span className="app-tag">WEB</span>
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
              <span>Settings</span>
            </button>
            {settingsPresent && (
              <div
                className={'settings-menu' + (!settings ? ' is-leaving' : '')}
                id="appearance-settings"
                aria-hidden={!settings}
                inert={!settings}
              >
                <p>Appearance</p>
                {(['system', 'light', 'dark'] as const).map((mode) => (
                  <label key={mode}>
                    <input
                      type="radio"
                      name="appearance"
                      value={mode}
                      checked={theme === mode}
                      onChange={() => setTheme(mode)}
                    />
                    <span>{mode[0].toUpperCase() + mode.slice(1)}</span>
                    {theme === mode && <Icon name="check" size={16} />}
                  </label>
                ))}
                <small>Only your appearance preference is saved.</small>
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
                      aria-label="Back to question list"
                      onClick={() => setScreen('questions')}
                    >
                      <Icon name="arrow" />
                    </button>
                    <div>
                      <div className="breadcrumb">
                        {paper.id}
                        <span>/</span>
                        {questionKindLabel(question)}
                      </div>
                      <h1>Question {question.id}</h1>
                    </div>
                  </div>
                  <button className="export-button" aria-label="Export Paper" onClick={exportPaper}>
                    <Icon name="download" size={16} />
                    <span>Export Paper</span>
                  </button>
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
                  <h1>{bank.papers.length ? 'Select a paper' : 'No Exams Found'}</h1>
                  <p>
                    {bank.papers.length
                      ? 'Choose a paper from the sidebar to view answers.'
                      : 'No supported ETS papers were found. Review the import warnings or select another bank.'}
                  </p>
                  <div className="bank-name">{bank.name}</div>
                  <div className="stats">
                    <div>
                      <strong>{bank.papers.length}</strong>
                      <span>Papers</span>
                    </div>
                    <div>
                      <strong>{bank.papers.reduce((n, p) => n + p.questions.length, 0)}</strong>
                      <span>Question groups</span>
                    </div>
                    <div>
                      <strong>
                        {bank.papers.reduce(
                          (n, p) => n + p.questions.reduce((m, q) => m + q.parts.length, 0),
                          0,
                        )}
                      </strong>
                      <span>Sub-questions</span>
                    </div>
                  </div>
                  <p className="overview-note">
                    <Icon name="shield" size={16} />
                    Available for this session. Refreshing clears your bank.
                  </p>
                  {!bank.papers.length && (
                    <button className="outlined-button" onClick={state.changeBank}>
                      Change Bank
                    </button>
                  )}
                </div>
              </div>
            )}
          </main>
          <div className="mobile-bank-notes">
            {!bank.papers.length && <p>No Exams Found. No supported ETS papers were found.</p>}
          </div>
        </div>
      )}
      <Toast message={toast} />
    </div>
  );
}
