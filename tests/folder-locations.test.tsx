import { afterEach, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportScreen } from '../src/components/ImportScreen';
const WINDOWS = '%APPDATA%\\ETS';
const ANDROID =
  '/storage/emulated/0/Android/data/com.ets100.secondary/files/Download/ETS_SECONDARY/resource';
const title = 'Where are my question files?';
function setup() {
  const user = userEvent.setup();
  const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  const onFolder = vi.fn(),
    onZip = vi.fn();
  const view = render(<ImportScreen onFolder={onFolder} onZip={onZip} />);
  return { user, copy, onFolder, onZip, ...view };
}
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: title }));
}
afterEach(() => vi.restoreAllMocks());
it('starts with a compact collapsed disclosure between import controls and the privacy note', () => {
  setup();
  const toggle = screen.getByRole('button', { name: title });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('tab')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Import ZIP' }).compareDocumentPosition(toggle) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    toggle.compareDocumentPosition(screen.getByText('Files stay on your device.')) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
it('defaults to the exact Windows path and switches to the exact Android path and instructions', async () => {
  const { user } = setup();
  await open(user);
  expect(screen.getByRole('tab', { name: 'Windows' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel').querySelector('code')?.textContent).toBe(WINDOWS);
  expect(screen.getByText('Press Win + R, paste the path, and press Enter.')).toBeVisible();
  expect(screen.getByRole('tabpanel')).not.toHaveTextContent('Roaming');
  await user.click(screen.getByRole('tab', { name: 'Android' }));
  expect(screen.getByRole('tabpanel').querySelector('code')?.textContent).toBe(ANDROID);
  expect(
    screen.getByText(
      'Android may restrict access to this folder. If necessary, import an accessible copy or ZIP archive.',
    ),
  ).toBeVisible();
  expect(screen.getByText('Locations may vary by app version and device.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: title }));
  await open(user);
  expect(screen.getByRole('tab', { name: 'Android' })).toHaveAttribute('aria-selected', 'true');
});
it.each([
  ['Windows', WINDOWS],
  ['Android', ANDROID],
])(
  'copies only the exact %s path and announces success after it completes',
  async (platform, path) => {
    const { user, copy } = setup();
    await open(user);
    await user.click(screen.getByRole('tab', { name: platform }));
    let finish!: () => void;
    copy.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await user.click(screen.getByRole('button', { name: `Copy ${platform} folder path` }));
    expect(copy).toHaveBeenCalledExactlyOnceWith(path);
    expect(screen.queryByText('Copied')).toBeNull();
    await act(async () => finish());
    expect(await screen.findByText('Copied')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Path copied.');
  },
);
it('shows manual-copy guidance when clipboard access fails and allows retry', async () => {
  const { user, copy } = setup();
  await open(user);
  copy.mockRejectedValueOnce(new Error('denied'));
  await user.click(screen.getByRole('button', { name: 'Copy Windows folder path' }));
  expect(
    await screen.findByText('Could not copy. Select the path and copy it manually.'),
  ).toBeVisible();
  expect(screen.queryByText('Copied')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Copy Windows folder path' }));
  expect(await screen.findByText('Copied')).toBeVisible();
});
it('handles a missing Clipboard API without claiming success', async () => {
  const { user } = setup();
  await open(user);
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  try {
    await user.click(screen.getByRole('button', { name: 'Copy Windows folder path' }));
    expect(
      await screen.findByText('Could not copy. Select the path and copy it manually.'),
    ).toBeVisible();
    expect(screen.queryByText('Copied')).toBeNull();
  } finally {
    if (previous) Object.defineProperty(navigator, 'clipboard', previous);
  }
});
it('does not show a stale Windows copy result after switching to Android', async () => {
  const { user, copy } = setup();
  await open(user);
  let finish!: () => void;
  copy.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await user.click(screen.getByRole('button', { name: 'Copy Windows folder path' }));
  await user.click(screen.getByRole('tab', { name: 'Android' }));
  await act(async () => finish());
  expect(screen.queryByText('Copied')).toBeNull();
  expect(screen.getByRole('button', { name: 'Copy Android folder path' })).toBeEnabled();
});
it('supports disclosure keyboard activation and roving tab keyboard selection', async () => {
  const { user } = setup();
  const toggle = screen.getByRole('button', { name: title });
  toggle.focus();
  await user.keyboard('{Enter}');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await user.tab();
  expect(screen.getByRole('tab', { name: 'Windows' })).toHaveFocus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Android' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: 'Android' })).toHaveAttribute('aria-selected', 'true');
  await user.keyboard('{Home}');
  expect(screen.getByRole('tab', { name: 'Windows' })).toHaveFocus();
  await user.keyboard('{End}');
  expect(screen.getByRole('tab', { name: 'Android' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Copy Android folder path' })).toHaveFocus();
  toggle.focus();
  await user.keyboard(' ');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
it('keeps existing file selection callbacks and disabled import behavior intact', async () => {
  const { user, onFolder, onZip, rerender } = setup();
  await open(user);
  await user.click(screen.getByRole('tab', { name: 'Android' }));
  const f = new File(['{}'], 'content.json', { type: 'application/json' }),
    z = new File(['zip'], 'bank.zip', { type: 'application/zip' });
  await user.upload(screen.getByLabelText('Select question-bank folder'), [f]);
  await user.upload(screen.getByLabelText('Select question-bank ZIP'), z);
  expect(onFolder).toHaveBeenCalledExactlyOnceWith([f]);
  expect(onZip).toHaveBeenCalledExactlyOnceWith(z);
  rerender(
    <ImportScreen
      onFolder={onFolder}
      onZip={onZip}
      progress={{ phase: 'Parsing questions...', completed: 1, total: 2 }}
    />,
  );
  expect(screen.getByRole('button', { name: 'Select Folder' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Import ZIP' })).toBeDisabled();
  expect(within(screen.getByRole('tablist')).getAllByRole('tab')).toHaveLength(2);
});
