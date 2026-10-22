import { useSyncExternalStore } from 'react';
import type { i18n } from 'i18next';
import type { SupportedLocale } from './locales';
import { resolveLanguage } from './languageMatching';
export const languageStorageKey = 'ets-language';
export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
export class LanguagePreferences {
  private preference = 'auto';
  private listeners = new Set<() => void>();
  constructor(
    private engine: i18n,
    public readonly locales: readonly SupportedLocale[],
    private fallback: string,
    private detect: () => readonly string[],
    private storage?: PreferenceStorage,
  ) {
    try {
      const saved = storage?.getItem(languageStorageKey);
      if (saved && (saved === 'auto' || locales.some((locale) => locale.code === saved)))
        this.preference = saved;
    } catch {
      /* Optional UI preference. */
    }
  }
  getSnapshot = () => this.preference;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  resolve = () =>
    this.preference === 'auto'
      ? resolveLanguage(this.detect(), this.locales, this.fallback)
      : this.preference;
  setPreference = (value: string) => {
    this.preference =
      value === 'auto' || this.locales.some((locale) => locale.code === value) ? value : 'auto';
    try {
      this.storage?.setItem(languageStorageKey, this.preference);
    } catch {
      /* Storage can be blocked. */
    }
    const pending = this.engine.changeLanguage(this.resolve());
    this.listeners.forEach((listener) => listener());
    return pending;
  };
  refreshAuto = () => {
    if (this.preference === 'auto') void this.engine.changeLanguage(this.resolve());
  };
}
export function useLanguagePreference(manager: LanguagePreferences) {
  const preference = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot,
  );
  return { preference, setPreference: manager.setPreference, locales: manager.locales };
}
