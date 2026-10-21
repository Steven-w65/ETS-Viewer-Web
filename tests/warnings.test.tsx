import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Warnings } from '../src/components/Warnings';
import type { Issue } from '../src/types';
const source = 'bank/p/content_1/content.json';
const missing = (reference: string, kind: Issue['mediaKind'] = 'image'): Issue => ({
  path: source,
  message: 'Old generic message',
  severity: 'warning',
  category: 'file_not_found',
  code: 'missing_media',
  mediaKind: kind,
  reference,
  candidates: ['bank/p/content_1/' + reference, 'bank/p/content_1/material/' + reference],
});
beforeEach(() => {
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
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
it('hides the header indicator for zero or informational-only warnings', () => {
  const v = render(<Warnings issues={[]} hasQuestions />);
  expect(screen.queryByRole('button')).toBeNull();
  v.rerender(
    <Warnings issues={[{ path: source, message: 'Variant', severity: 'info' }]} hasQuestions />,
  );
  expect(screen.queryByRole('button')).toBeNull();
});
it('counts distinct failures, not duplicate diagnostic events, and separates resource paths from source JSON', async () => {
  const user = userEvent.setup(),
    a = missing('a.jpg');
  render(
    <Warnings
      issues={[
        a,
        { ...a },
        missing('图 片.png'),
        missing('sound.mp3', 'audio'),
        missing('lesson.mp4', 'video'),
      ]}
      hasQuestions
    />,
  );
  await user.click(screen.getByRole('button', { name: 'View 4 import warnings' }));
  const dialog = screen.getByRole('dialog', { name: /Import warnings/ });
  expect(within(dialog).getAllByRole('listitem')).toHaveLength(4);
  expect(within(dialog).getAllByRole('heading', { name: 'Image not found' })).toHaveLength(2);
  expect(within(dialog).getByRole('heading', { name: 'Audio not found' })).toBeVisible();
  expect(within(dialog).getByRole('heading', { name: 'Video not found' })).toBeVisible();
  expect(within(dialog).getByText('a.jpg', { exact: true })).toBeVisible();
  expect(within(dialog).getByText('图 片.png', { exact: true })).toBeVisible();
  expect(within(dialog).getAllByText(source, { exact: true })).toHaveLength(4);
  expect(
    within(dialog).getByText(
      'Some resources could not be loaded. Other questions remain available.',
    ),
  ).toBeVisible();
  const details = within(dialog).getAllByRole('button', { name: 'Technical details' })[0];
  expect(details).toHaveAttribute('aria-expanded', 'false');
});
it('distinguishes media failures, keeps missing names truthful, and does not claim an empty bank has valid questions', async () => {
  const user = userEvent.setup();
  render(
    <Warnings
      hasQuestions={false}
      issues={[
        { ...missing('picture.jpg'), category: 'image_decode' },
        { ...missing('lesson.mp4', 'video'), category: 'unsupported_type' },
        { ...missing('sound.mp3', 'audio'), category: 'audio_playback' },
        { ...missing('', 'image'), category: 'missing_reference' },
      ]}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'View 4 import warnings' }));
  expect(screen.getByRole('heading', { name: 'Image could not be decoded' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Unsupported video format' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Audio playback failed' })).toBeVisible();
  expect(screen.getByText('The referenced resource could not be identified.')).toBeVisible();
  expect(screen.queryByText(/Other questions remain available/)).toBeNull();
});
it('closes by button, cancel/Escape, and backdrop, restores focus and restores scroll locking', async () => {
  const user = userEvent.setup();
  document.body.style.overflow = 'auto';
  render(<Warnings issues={[missing('a.jpg')]} hasQuestions />);
  const trigger = screen.getByRole('button', { name: 'View 1 import warning' });
  for (const method of ['button', 'cancel', 'backdrop']) {
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(screen.getByRole('button', { name: 'Close import warnings' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    if (method === 'button')
      await user.click(screen.getByRole('button', { name: 'Close import warnings' }));
    else if (method === 'cancel') fireEvent(dialog, new Event('cancel', { cancelable: true }));
    else fireEvent.click(dialog);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('auto');
  }
  document.body.style.overflow = '';
});
it('preserves warnings across ordinary rerenders, replaces them for another bank, and clears on unmount', async () => {
  const user = userEvent.setup(),
    issues = [missing('a.jpg')];
  const v = render(<Warnings issues={issues} hasQuestions />);
  await user.click(screen.getByRole('button', { name: 'View 1 import warning' }));
  v.rerender(<Warnings issues={issues} hasQuestions />);
  expect(screen.getByRole('dialog')).toBeVisible();
  v.rerender(<Warnings issues={[missing('new.mp4', 'video')]} hasQuestions />);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await user.click(screen.getByRole('button', { name: 'View 1 import warning' }));
  expect(screen.getByText('new.mp4', { exact: true })).toBeVisible();
  expect(screen.queryByText('a.jpg', { exact: true })).toBeNull();
  v.unmount();
  expect(document.body.style.overflow).not.toBe('hidden');
});
it('cycles Tab and Shift+Tab at the dialog focus boundaries', async () => {
  const user = userEvent.setup();
  render(<Warnings issues={[missing('a.jpg'), missing('b.jpg')]} hasQuestions />);
  await user.click(screen.getByRole('button', { name: 'View 2 import warnings' }));
  const close = screen.getByRole('button', { name: 'Close import warnings' }),
    last = screen.getAllByRole('button', { name: 'Technical details' }).at(-1)!;
  last.focus();
  await user.tab();
  expect(close).toHaveFocus();
  await user.tab({ shift: true });
  expect(last).toHaveFocus();
});
