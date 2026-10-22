import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { AnswerPreview } from '../src/components/AnswerPreview';
import { parseDocument } from '../src/core/parser';
import { ImageResources } from '../src/core/images';
import { downloadPaper } from '../src/core/exporter';
import type { Bank, Paper } from '../src/types';
import { choice, dialogue } from './fixtures';

vi.mock('../src/core/exporter', () => ({ downloadPaper: vi.fn() }));
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
const resources = new ImageResources(new Map());
const questions = [
  parseDocument(choice, 'bank/p/content_1/content.json'),
  parseDocument(dialogue, 'bank/p/content_2/content.json'),
];
const paper: Paper = { id: '中文 Paper', title: '原始试卷', key: 'p', modified: null, questions };
let bank: Bank | null;
beforeEach(() => {
  bank = { name: 'Bank', papers: [paper], issues: [], filesScanned: 2, assets: new Map() };
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.body.style.overflow = '';
});
const choosePaper = () => fireEvent.click(screen.getByRole('button', { name: /中文 Paper/ }));

it('shows the preview immediately before Export in one action group only for a selected paper', () => {
  const view = render(<App />);
  expect(screen.queryByRole('button', { name: 'Preview Answers' })).toBeNull();
  choosePaper();
  const trigger = screen.getByRole('button', { name: 'Preview Answers' });
  expect(trigger.parentElement).toHaveClass('paper-actions');
  expect(trigger.nextElementSibling).toBe(screen.getByRole('button', { name: 'Export Paper' }));
  bank = null;
  view.rerender(<App />);
  expect(screen.queryByRole('button', { name: 'Preview Answers' })).toBeNull();
});
it('previews the entire paper using only primary answers and no question material or downloads', async () => {
  render(<App />);
  choosePaper();
  fireEvent.click(screen.getByRole('button', { name: 'Preview Answers' }));
  const dialog = screen.getByRole('dialog', { name: 'Answer Preview' });
  expect(within(dialog).getByText('原始试卷')).toBeVisible();
  expect(within(dialog).getByRole('heading', { name: 'Multiple Choice · 1–2' })).toBeVisible();
  expect(within(dialog).getByRole('heading', { name: 'Dialogue · 1–2' })).toBeVisible();
  expect(dialog.querySelectorAll('.preview-entry')).toHaveLength(4);
  expect(within(dialog).getByText('B', { exact: true })).toBeVisible();
  expect(within(dialog).getByText('Explicit', { exact: true })).toBeVisible();
  expect(within(dialog).getByText('—', { exact: true })).toBeVisible();
  expect(within(dialog).queryByText('First standard')).toBeNull();
  expect(within(dialog).queryByText('Original prompt')).toBeNull();
  expect(within(dialog).queryByText('Shared transcript')).toBeNull();
  expect(dialog.querySelector('img,audio,video,iframe,script')).toBeNull();
  const box = dialog.querySelector('.preview-choice-box')!;
  expect(box).toHaveTextContent(/^B$/);
  expect(box.previousElementSibling).toHaveTextContent('1.');
  expect(downloadPaper).not.toHaveBeenCalled();
});
it('closes through Close, Escape and backdrop while restoring focus, scroll and expanded Reader state', async () => {
  const user = userEvent.setup();
  document.body.style.overflow = 'auto';
  const view = render(<App />);
  choosePaper();
  const question = screen.getAllByRole('button', { name: /^Question / })[0];
  fireEvent.click(question);
  const reader = view.container.querySelector('.reader');
  const scroll = view.container.querySelector('.reading-scroll')!;
  scroll.scrollTop = 123;
  const trigger = screen.getByRole('button', { name: 'Preview Answers' });
  for (const method of ['close', 'escape', 'backdrop']) {
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(screen.getByRole('button', { name: 'Close answer preview' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    if (method === 'close')
      await user.click(screen.getByRole('button', { name: 'Close answer preview' }));
    else if (method === 'escape') fireEvent(dialog, new Event('cancel', { cancelable: true }));
    else fireEvent.click(dialog);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('auto');
    expect(view.container.querySelector('.reader')).toBe(reader);
    expect(question).toHaveAttribute('aria-expanded', 'true');
    expect(scroll.scrollTop).toBe(123);
  }
});
it('contains keyboard focus and releases scroll lock when the bank is replaced', async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  choosePaper();
  await user.click(screen.getByRole('button', { name: 'Preview Answers' }));
  const close = screen.getByRole('button', { name: 'Close answer preview' });
  const answers = screen.getByRole('region', { name: 'Paper answers' });
  await user.tab();
  expect(answers).toHaveFocus();
  await user.tab();
  expect(close).toHaveFocus();
  await user.tab({ shift: true });
  expect(answers).toHaveFocus();
  await user.tab({ shift: true });
  expect(close).toHaveFocus();
  bank = { ...bank!, name: 'New bank', papers: [] };
  view.rerender(<App />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.style.overflow).not.toBe('hidden');
});
it('preserves unusual answers with local numbering and truthful empty states', () => {
  const q = structuredClone(questions[0]);
  q.parts[0].number = '';
  q.parts[0].answers = [{ text: 'A,B', field: 'std' }];
  q.parts[1].answers = [{ text: '中文\n'.repeat(1000), field: 'std' }];
  const data = { ...paper, questions: [q] };
  const view = render(<AnswerPreview paper={data} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview Answers' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).queryByText('Unnumbered items use display numbers.')).toBeNull();
  expect(within(dialog).getByRole('heading', { name: 'Multiple Choice · 1–2' })).toBeVisible();
  expect(Array.from(dialog.querySelectorAll('.preview-number'), (el) => el.textContent)).toEqual([
    '1.',
    '2.',
  ]);
  expect(within(dialog).getByText('A,B')).not.toHaveClass('is-single-choice');
  expect(dialog.querySelectorAll('.preview-entry')[1]).toHaveTextContent('中文');
  view.unmount();
  render(<AnswerPreview paper={{ ...paper, questions: [] }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview Answers' }));
  expect(within(screen.getByRole('dialog')).getByText('No answers available')).toBeVisible();
});
it('resets repeated groups locally while the regular Reader retains its original numbers', async () => {
  const first = structuredClone(questions[0]);
  first.parts[0].officialNumber = '23';
  first.parts[0].number = '90';
  first.parts[1].number = '25';
  const second = {
    ...structuredClone(first),
    source: 'bank/p/content_3/content.json',
    parts: [structuredClone(first.parts[1])],
  };
  bank = { ...bank!, papers: [{ ...paper, questions: [first, second] }] };
  const view = render(<App />);
  choosePaper();
  const reader = view.container.querySelector('.reader')!;
  expect(within(reader as HTMLElement).getByRole('button', { name: 'Q23' })).toBeVisible();
  expect(within(reader as HTMLElement).getByRole('button', { name: 'Q25' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Preview Answers' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('heading', { name: 'Multiple Choice · 1–2' })).toBeVisible();
  expect(within(dialog).getByRole('heading', { name: 'Multiple Choice · 1' })).toBeVisible();
  expect(Array.from(dialog.querySelectorAll('.preview-number'), (el) => el.textContent)).toEqual([
    '1.',
    '2.',
    '1.',
  ]);
  expect(
    Array.from(dialog.querySelectorAll('.preview-choice-box'), (el) => el.textContent),
  ).toEqual(['B', '—', '—']);
  fireEvent.click(screen.getByRole('button', { name: 'Close answer preview' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(within(reader as HTMLElement).getByRole('button', { name: 'Q23' })).toBeVisible();
  expect(first.parts.map((p) => [p.number, p.officialNumber])).toEqual([
    ['90', '23'],
    ['25', undefined],
  ]);
});
