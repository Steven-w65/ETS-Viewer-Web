import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useTheme } from '../src/hooks/useTheme';
it('persists only appearance and applies a saved mode before paint', () => {
  localStorage.clear();
  localStorage.setItem('ets-appearance', 'dark');
  const { result } = renderHook(useTheme);
  expect(document.documentElement.dataset.theme).toBe('dark');
  act(() => result.current.setTheme('light'));
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(localStorage.length).toBe(1);
  expect(localStorage.getItem('ets-appearance')).toBe('light');
});
it('tracks system appearance changes and removes the listener', () => {
  localStorage.clear();
  let listener = () => {};
  const query = {
    matches: true,
    media: '',
    addEventListener: vi.fn((_event: string, fn: () => void) => (listener = fn)),
    removeEventListener: vi.fn(),
  };
  vi.mocked(window.matchMedia).mockReturnValueOnce(query as unknown as MediaQueryList);
  const { unmount } = renderHook(useTheme);
  expect(document.documentElement.dataset.theme).toBe('dark');
  query.matches = false;
  act(() => listener());
  expect(document.documentElement.dataset.theme).toBe('light');
  unmount();
  expect(query.removeEventListener).toHaveBeenCalled();
});
