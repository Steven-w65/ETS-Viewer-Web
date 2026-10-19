import { useLayoutEffect, useState } from 'react';
export type Theme = 'system' | 'light' | 'dark';
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('ets-appearance');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* Private browsing may block preferences. */
    }
    return 'system';
  });
  useLayoutEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (query.matches ? 'dark' : 'light') : theme;
    };
    apply();
    query.addEventListener('change', apply);
    try {
      localStorage.setItem('ets-appearance', theme);
    } catch {
      /* Appearance is optional. */
    }
    return () => query.removeEventListener('change', apply);
  }, [theme]);
  return { theme, setTheme };
}
