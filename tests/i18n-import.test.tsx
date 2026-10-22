import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ImportScreen } from '../src/components/ImportScreen';
import { useBank } from '../src/hooks/useBank';
import i18n from '../src/i18n';
import type { Progress } from '../src/types';

const WINDOWS = '%APPDATA%\\ETS';
const ANDROID =
  '/storage/emulated/0/Android/data/com.ets100.secondary/files/Download/ETS_SECONDARY/resource';
const callbacks = { onFolder: vi.fn(), onZip: vi.fn() };
async function language(locale: string) {
  await act(async () => {
    await i18n.changeLanguage(locale);
  });
}
beforeEach(async () => {
  await language('en');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  {
    locale: 'en',
    select: 'Select Folder',
    zip: 'Import ZIP',
    folderInput: 'Select question-bank folder',
    zipInput: 'Select question-bank ZIP',
    guide: 'Where are my question files?',
    copyWindows: 'Copy Windows folder path',
    copyAndroid: 'Copy Android folder path',
    privacy: 'Files stay on your device.',
  },
  {
    locale: 'zh-CN',
    select: '选择文件夹',
    zip: '导入 ZIP',
    folderInput: '选择题库文件夹',
    zipInput: '选择题库 ZIP 文件',
    guide: '题库文件在哪里？',
    copyWindows: '复制 Windows 文件夹路径',
    copyAndroid: '复制 Android 文件夹路径',
    privacy: '文件仅保留在你的设备上。',
  },
])('localizes import controls and copies exact native paths in $locale', async (text) => {
  await language(text.locale);
  const user = userEvent.setup();
  const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  const onFolder = vi.fn(),
    onZip = vi.fn();
  render(<ImportScreen onFolder={onFolder} onZip={onZip} />);
  expect(screen.getByRole('heading', { name: 'ETS Viewer' })).toBeVisible();
  expect(screen.getByRole('button', { name: text.select })).toBeEnabled();
  expect(screen.getByRole('button', { name: text.zip })).toBeEnabled();
  expect(screen.getByText(text.privacy)).toBeVisible();
  const file = new File(['原始题目'], '原始内容.json', { type: 'application/json' });
  const zip = new File(['zip'], '原始题库.zip', { type: 'application/zip' });
  fireEvent.change(screen.getByLabelText(text.folderInput), { target: { files: [file] } });
  fireEvent.change(screen.getByLabelText(text.zipInput), { target: { files: [zip] } });
  expect(onFolder).toHaveBeenCalledExactlyOnceWith([file]);
  expect(onZip).toHaveBeenCalledExactlyOnceWith(zip);
  await user.click(screen.getByRole('button', { name: text.guide }));
  expect(screen.getByRole('tabpanel').querySelector('code')?.textContent).toBe(WINDOWS);
  await user.click(screen.getByRole('button', { name: text.copyWindows }));
  expect(copy).toHaveBeenLastCalledWith(WINDOWS);
  await user.click(screen.getByRole('tab', { name: 'Android' }));
  expect(screen.getByRole('tabpanel').querySelector('code')?.textContent).toBe(ANDROID);
  await user.click(screen.getByRole('button', { name: text.copyAndroid }));
  expect(copy).toHaveBeenLastCalledWith(ANDROID);
});

it('keeps the open guide, selected tab, and pending/successful copy when language changes', async () => {
  const user = userEvent.setup();
  let finish!: () => void;
  const copy = vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<ImportScreen {...callbacks} />);
  const toggle = screen.getByRole('button', { name: 'Where are my question files?' });
  await user.click(toggle);
  await user.click(screen.getByRole('tab', { name: 'Android' }));
  const panel = screen.getByRole('tabpanel');
  await user.click(screen.getByRole('button', { name: 'Copy Android folder path' }));
  await language('zh-CN');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: '题库文件在哪里？' })).toBe(toggle);
  expect(screen.getByRole('tabpanel')).toBe(panel);
  expect(screen.getByRole('tab', { name: 'Android' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('button', { name: '复制 Android 文件夹路径' })).toBeDisabled();
  await act(async () => {
    finish();
  });
  expect(screen.getByRole('status')).toHaveTextContent('路径已复制。');
  expect(screen.getByRole('button', { name: '复制 Android 文件夹路径' })).toHaveTextContent(
    '已复制',
  );
  await language('en');
  expect(screen.getByRole('status')).toHaveTextContent('Path copied.');
  expect(screen.getByRole('tabpanel')).toBe(panel);
  expect(copy).toHaveBeenCalledExactlyOnceWith(ANDROID);
});

it('translates a clipboard failure already on screen without retrying the operation', async () => {
  const user = userEvent.setup();
  const copy = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
  render(<ImportScreen {...callbacks} />);
  await user.click(screen.getByRole('button', { name: 'Where are my question files?' }));
  await user.click(screen.getByRole('button', { name: 'Copy Windows folder path' }));
  expect(screen.getByRole('status')).toHaveTextContent(
    'Could not copy. Select the path and copy it manually.',
  );
  await language('zh-CN');
  expect(screen.getByRole('status')).toHaveTextContent('无法复制。请选择路径并手动复制。');
  expect(copy).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('tabpanel').querySelector('code')?.textContent).toBe(WINDOWS);
});

it.each([
  ['Reading files...', 'Reading files...', '正在读取文件…'],
  ['Parsing questions...', 'Parsing questions...', '正在解析题目…'],
  ['Processing images...', 'Processing images...', '正在处理图片…'],
  ['Processing media...', 'Processing media...', '正在处理媒体…'],
  ['Ready', 'Ready', '导入完成'],
] as const)(
  'translates the active %s phase and preserves the same progress element',
  async (phase, english, chinese) => {
    const cancel = vi.fn();
    const progress: Progress = { phase, completed: 1234, total: 5678 };
    render(<ImportScreen {...callbacks} progress={progress} onCancel={cancel} />);
    const bar = screen.getByRole('progressbar');
    expect(screen.getByRole('status')).toHaveTextContent(english);
    expect(screen.getByRole('status')).toHaveTextContent('1,234 / 5,678');
    await language('zh-CN');
    expect(screen.getByRole('status')).toHaveTextContent(chinese);
    expect(screen.getByRole('progressbar', { name: '导入进度' })).toBe(bar);
    expect(bar).toHaveAttribute('value', '1234');
    expect(bar).toHaveAttribute('max', '5678');
    expect(screen.getByRole('button', { name: '选择文件夹' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '取消导入' }));
    expect(cancel).toHaveBeenCalledTimes(1);
  },
);

it.each([
  [
    'This browser did not return folder-relative paths. Use Import ZIP to preserve the complete bank.',
    '浏览器未提供文件夹相对路径。请使用“导入 ZIP”保留完整题库。',
  ],
  ['Invalid ZIP: missing end directory', 'ZIP 文件无效：缺少结束目录。'],
  [
    'Folder size limit (1 GiB) exceeded. Select a smaller bank.',
    '文件夹大小超过 1 GiB 限制。请选择较小的题库。',
  ],
  [
    'The import worker could not complete. Try a smaller bank or a current browser.',
    '导入处理未能完成。请尝试较小的题库或使用新版浏览器。',
  ],
  [
    'This browser could not start local processing. Try a current browser.',
    '此浏览器无法启动本地处理。请使用新版浏览器。',
  ],
])('translates an existing import failure live: %s', async (error, chinese) => {
  render(<ImportScreen {...callbacks} error={error} />);
  expect(screen.getByRole('alert')).toHaveTextContent(error);
  await language('zh-CN');
  expect(screen.getByRole('alert')).toHaveTextContent(chinese);
});

it('keeps original relative filenames in known errors and hides unknown operating-system details', async () => {
  const { rerender } = render(
    <ImportScreen {...callbacks} error="Duplicate folder path: 题库/原始内容.json" />,
  );
  await language('zh-CN');
  expect(screen.getByRole('alert')).toHaveTextContent('文件夹中存在重复路径：题库/原始内容.json');
  rerender(
    <ImportScreen {...callbacks} error={'EACCES: C:\\Users\\private\\personal-bank.json'} />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('无法导入此题库。请检查文件后重试。');
  expect(screen.getByRole('alert')).not.toHaveTextContent('private');
  await language('en');
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Unable to import this bank. Check the files and try again.',
  );
});

class ImportWorker {
  static current: ImportWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    ImportWorker.current = this;
  }
  postMessage() {}
  terminate() {}
}
it('retains raw hook errors and supplies a structured error for live rendering', async () => {
  vi.stubGlobal('Worker', ImportWorker);
  const { result } = renderHook(useBank);
  act(() => result.current.importZip(new File(['zip'], 'bank.zip')));
  act(() =>
    ImportWorker.current.onmessage?.({
      data: { type: 'error', message: 'Invalid ZIP: corrupt CRC' },
    }),
  );
  expect(result.current.error).toBe('Invalid ZIP: corrupt CRC');
  expect(result.current).toHaveProperty('errorDescriptor', { key: 'import.errors.zip.crc' });
  render(<ImportScreen {...callbacks} error={result.current.error} />);
  await language('zh-CN');
  expect(screen.getByRole('alert')).toHaveTextContent('ZIP 文件无效：CRC 校验失败。');
  expect(result.current.error).toBe('Invalid ZIP: corrupt CRC');
  expect(result.current.progress).toBeNull();
});
