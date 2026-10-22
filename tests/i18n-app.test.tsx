import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import App from '../src/App';
import { Navigation } from '../src/components/Navigation';
import { LanguageSettings } from '../src/components/LanguageSettings';
import { ImageResources } from '../src/core/images';
import { parseDocument } from '../src/core/parser';
import { downloadPaper } from '../src/core/exporter';
import i18n, { createLocalization } from '../src/i18n';
import { supportedLocales } from '../src/i18n/locales';
import type { Bank, Paper } from '../src/types';
import { choice, dialogue } from './fixtures';

// Keep the imported bank stable while App's actual state and components rerender.
// Import workers and browser downloads are the external boundaries in this test.
vi.mock('../src/hooks/useBank', () => ({
  useBank: () => ({
    bank,
    resources,
    error: '',
    progress: null,
    importFolder: vi.fn(),
    importZip: vi.fn(),
    cancel: vi.fn(),
    changeBank: vi.fn(),
  }),
}));
vi.mock('../src/core/exporter', () => ({ downloadPaper: vi.fn() }));

const resources = new ImageResources(new Map());
const questions = [
  {
    ...parseDocument(choice, '原始题库/p/content_1/content.json'),
    id: '题组α',
    displayTitle: '原始题目标题',
  },
  {
    ...parseDocument(dialogue, '原始题库/p/content_2/content.json'),
    id: '原编号-007',
    displayTitle: 'Original title 日本語',
  },
];
questions[0].parts[0].officialNumber = '23';
const paper: Paper = {
  key: 'paper',
  id: '原始试卷α',
  title: '原始标题',
  modified: new Date(2026, 9, 19, 12).getTime(),
  questions,
};
let bank: Bank;
beforeEach(() => {
  bank = { name: '原始题库', papers: [paper], issues: [], filesScanned: 2, assets: new Map() };
  localStorage.removeItem('ets-appearance');
  vi.mocked(downloadPaper).mockReset();
});

it('switches an open Settings menu live while keeping theme, statistics and imported paper names', async () => {
  const view = render(<App />);
  const before = structuredClone(bank);
  const stats = view.container.querySelector('.stats')!;
  expect(stats).toHaveTextContent('1Papers2Question groups4Sub-questions');
  expect(screen.getByRole('heading', { name: 'Select a paper' })).toBeVisible();
  const paperRow = screen.getByRole('button', { name: /原始试卷α/ });
  expect(paperRow).toHaveTextContent('2 groups · Oct 19, 2026');
  const settings = screen.getByRole('button', { name: 'Settings' });
  fireEvent.click(settings);
  fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
  const selector = screen.getByRole('combobox', { name: 'Language' });
  fireEvent.change(selector, { target: { value: 'zh-CN' } });
  expect(await screen.findByRole('button', { name: '设置' })).toBe(settings);
  expect(settings).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('combobox', { name: '语言' })).toBe(selector);
  expect(selector).toHaveValue('zh-CN');
  expect(screen.getByRole('radio', { name: '深色' })).toBeChecked();
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(screen.getByRole('heading', { name: '选择试卷' })).toBeVisible();
  expect(stats).toHaveTextContent('1试卷2题组4小题');
  expect(paperRow).toHaveTextContent('2 个题组 · 2026年10月19日');
  expect(screen.getByRole('link', { name: '在 GitHub 上查看' })).toHaveAttribute(
    'href',
    'https://github.com/Steven-w65/ETS-Viewer-web',
  );
  expect(screen.getByRole('complementary', { name: '试卷列表' })).toBeVisible();
  expect(bank).toEqual(before);
  expect(localStorage.getItem('ets-appearance')).toBe('dark');
  expect(view.container.querySelector('.brand')).toHaveTextContent('ETS Viewer');
});

it('keeps the selected group, expanded Reader, original numbers and scroll through live switching', async () => {
  const view = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /原始试卷α/ }));
  const reader = view.container.querySelector('.reader')!;
  const questionCard = within(reader as HTMLElement).getAllByRole('button', {
    name: /^Question /,
  })[0];
  fireEvent.click(questionCard);
  const scroll = view.container.querySelector('.reading-scroll')!;
  scroll.scrollTop = 157;
  const selected = view.container.querySelector('.question-row.selected');
  expect(screen.getByRole('heading', { name: 'Question 题组α' })).toBeVisible();
  await act(() => i18n.changeLanguage('zh-CN'));
  expect(view.container.querySelector('.reader')).toBe(reader);
  expect(view.container.querySelector('.question-row.selected')).toBe(selected);
  expect(questionCard).toHaveAttribute('aria-expanded', 'true');
  expect(scroll.scrollTop).toBe(157);
  expect(screen.getByRole('heading', { name: '题目 题组α' })).toBeVisible();
  expect(view.container.querySelector('.breadcrumb')).toHaveTextContent('原始试卷α/选择题');
  expect(screen.getByText('原始题目标题')).toBeVisible();
  expect(within(reader as HTMLElement).getByRole('button', { name: 'Q23' })).toBeVisible();
  const navigation = screen.getByRole('navigation', { name: '题组导航' });
  expect(within(navigation).getByRole('button', { name: '上一组' })).toBeDisabled();
  fireEvent.click(within(navigation).getByRole('button', { name: '下一组' }));
  expect(screen.getByRole('heading', { name: '题目 原编号-007' })).toBeVisible();
  expect(view.container.querySelector('.breadcrumb')).toHaveTextContent('原始试卷α/对话');
  expect(within(navigation).getByRole('button', { name: '下一组' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '返回题组列表' })).toBeInTheDocument();
  expect(questions[0].parts[0].officialNumber).toBe('23');
});

it('retranslates an existing export toast and keeps the original export arguments', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /原始试卷α/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Export Paper' }));
  expect(screen.getByRole('status')).toHaveTextContent(
    'Paper export ready. Your browser will save the file.',
  );
  expect(downloadPaper).toHaveBeenLastCalledWith('原始试卷α', paper.questions);
  await act(() => i18n.changeLanguage('zh-CN'));
  expect(screen.getByRole('status')).toHaveTextContent('试卷已准备导出，浏览器将保存文件。');
  const exportButton = screen.getByRole('button', { name: '导出试卷' });
  expect(exportButton).toHaveAttribute('title', '导出试卷');
  expect(exportButton.previousElementSibling).toHaveClass('preview-button');
  vi.mocked(downloadPaper).mockImplementationOnce(() => {
    throw new Error('download failed');
  });
  fireEvent.click(exportButton);
  expect(screen.getByRole('status')).toHaveTextContent('导出失败，请重试。');
  await act(() => i18n.changeLanguage('en'));
  expect(screen.getByRole('status')).toHaveTextContent('Export failed. Please try again.');
});

it('localizes the empty bank while retaining the zero statistics and bank name', async () => {
  bank = { ...bank, papers: [] };
  const view = render(<App />);
  await act(() => i18n.changeLanguage('zh-CN'));
  expect(screen.getByRole('heading', { name: '未找到试卷' })).toBeVisible();
  expect(screen.getByText('未找到支持的 ETS 试卷。请查看导入警告或选择其他题库。')).toBeVisible();
  expect(screen.getByText('未找到支持的试卷。')).toBeVisible();
  expect(screen.getAllByRole('button', { name: '更换题库' })).toHaveLength(2);
  expect(view.container.querySelector('.stats')).toHaveTextContent('0试卷0题组0小题');
  expect(view.container.querySelector('.bank-name')).toHaveTextContent('原始题库');
});

it('shows and applies an arbitrary future locale from its registry without selector changes', async () => {
  const runtime = createLocalization(
    [
      ...supportedLocales,
      {
        code: 'fr',
        nativeName: 'Français',
        resources: {
          ...supportedLocales[0].resources,
          'settings.language': 'Langue',
          'settings.auto': 'Automatique (langue du navigateur)',
          'navigation.previous': 'Précédent',
          'navigation.next': 'Suivant',
          'navigation.questionGroups': 'Groupes de questions',
        },
      },
    ],
    { detect: () => ['en'] },
  );
  render(
    <I18nextProvider i18n={runtime.i18n}>
      <LanguageSettings manager={runtime.preferences} />
      <Navigation index={0} total={1234} onChange={() => {}} />
    </I18nextProvider>,
  );
  const selector = screen.getByRole('combobox', { name: 'Language' });
  expect(
    within(selector)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['Auto (Browser language)', 'English', '简体中文', 'Français']);
  expect(within(selector).queryByRole('option', { name: '日本語' })).toBeNull();
  fireEvent.change(selector, { target: { value: 'fr' } });
  expect(await screen.findByRole('combobox', { name: 'Langue' })).toBe(selector);
  expect(selector).toHaveValue('fr');
  expect(screen.getByRole('navigation', { name: 'Groupes de questions' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Suivant' })).toBeEnabled();
  expect(
    screen.getByRole('navigation', { name: 'Groupes de questions' }).querySelector('[aria-live]')
      ?.textContent,
  ).toBe('1 / 1\u202f234');
});
