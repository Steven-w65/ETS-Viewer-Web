import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import i18n from '../src/i18n';
import { Warnings } from '../src/components/Warnings';
import type { Issue } from '../src/types';
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
it('translates media categories and parser diagnostics live without closing or altering paths', async () => {
  const source = '题库/原始/content.json';
  const issues: Issue[] = [
    {
      path: source,
      reference: '图 片.png',
      message: 'file not found',
      category: 'file_not_found',
      mediaKind: 'image',
      code: 'missing_media',
    },
    {
      path: source,
      reference: 'content.mp3',
      message: 'file not found',
      category: 'file_not_found',
      mediaKind: 'audio',
      code: 'missing_media',
    },
    {
      path: source,
      reference: 'lesson.mp4',
      message: 'unsupported type',
      category: 'unsupported_type',
      mediaKind: 'video',
      code: 'media_unsupported_type',
    },
    { path: source, message: 'Unexpected token X', code: 'invalid_json' },
    { path: source, message: 'Partial question', code: 'partial_record' },
  ];
  const original = structuredClone(issues);
  render(<Warnings issues={issues} hasQuestions />);
  fireEvent.click(screen.getByRole('button', { name: 'View 5 import warnings' }));
  const dialog = screen.getByRole('dialog');
  await act(() => i18n.changeLanguage('zh-CN'));
  expect(screen.getByRole('dialog', { name: '导入警告' })).toBe(dialog);
  expect(within(dialog).getByRole('heading', { name: '找不到图片' })).toBeVisible();
  expect(within(dialog).getByRole('heading', { name: '找不到音频' })).toBeVisible();
  expect(within(dialog).getByRole('heading', { name: '不支持的视频格式' })).toBeVisible();
  expect(within(dialog).getByRole('heading', { name: 'JSON 数据无效' })).toBeVisible();
  expect(within(dialog).getByRole('heading', { name: '该题组的部分内容未能加载' })).toBeVisible();
  expect(within(dialog).getByText('图 片.png', { exact: true })).toBeVisible();
  expect(within(dialog).getAllByText(source, { exact: true })).toHaveLength(5);
  expect(screen.getByRole('button', { name: '关闭导入警告' })).toHaveFocus();
  expect(issues).toEqual(original);
});
it('uses locale-aware warning plural forms and preserves truthful unknown-diagnostic fallbacks', async () => {
  render(
    <Warnings
      issues={[
        {
          path: 'bank/content.json',
          message: 'Unknown new internal diagnostic',
          code: 'future_code',
        },
      ]}
      hasQuestions={false}
    />,
  );
  expect(screen.getByRole('button', { name: 'View 1 import warning' })).toBeVisible();
  await act(() => i18n.changeLanguage('zh-CN'));
  fireEvent.click(screen.getByRole('button', { name: '查看 1 条导入警告' }));
  expect(screen.getByRole('heading', { name: '该记录未能完整加载' })).toBeVisible();
  expect(screen.getByText('1 条警告')).toBeVisible();
  expect(screen.queryByText(/Other questions/)).toBeNull();
});
