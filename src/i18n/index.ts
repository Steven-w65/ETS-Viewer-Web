import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { fallbackLocale, supportedLocales, type SupportedLocale } from './locales';
import { LanguagePreferences, type PreferenceStorage } from './languagePreference';
export interface LocalizationOptions {
  storage?: PreferenceStorage;
  detect?: () => readonly string[];
  fallback?: string;
  react?: boolean;
}
export function createLocalization(
  locales: readonly SupportedLocale[] = supportedLocales,
  options: LocalizationOptions = {},
) {
  const engine = createInstance(),
    detector = new LanguageDetector();
  engine.use(detector);
  if (options.react) engine.use(initReactI18next);
  const detect =
    options.detect ??
    (() => {
      const found = detector.detect(['navigator']);
      return Array.isArray(found) ? found : found ? [found] : [];
    });
  void engine.init({
    resources: Object.fromEntries(
      locales.map((locale) => [locale.code, { translation: locale.resources }]),
    ),
    lng: options.fallback ?? fallbackLocale,
    fallbackLng: options.fallback ?? fallbackLocale,
    supportedLngs: locales.map((locale) => locale.code),
    load: 'currentOnly',
    keySeparator: false,
    initAsync: false,
    returnNull: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: { order: ['navigator'], caches: [] },
  });
  // i18next initializes the detector's public service. Negotiate only afterwards
  // so its detect() API returns all ordered navigator preferences.
  const preferences = new LanguagePreferences(
    engine,
    locales,
    options.fallback ?? fallbackLocale,
    detect,
    options.storage,
  );
  void engine.changeLanguage(preferences.resolve());
  return { i18n: engine, preferences };
}
function browserStorage(): PreferenceStorage | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return;
  }
}
const runtime = createLocalization(supportedLocales, { storage: browserStorage(), react: true });
export const languagePreferences = runtime.preferences;
export const i18n = runtime.i18n;
const applyMetadata = () => {
  if (typeof document === 'undefined') return;
  const locale = supportedLocales.find((locale) => locale.code === i18n.resolvedLanguage);
  document.documentElement.lang = locale?.code ?? fallbackLocale;
  document.documentElement.dir = locale?.dir ?? i18n.dir(locale?.code);
};
i18n.on('languageChanged', applyMetadata);
applyMetadata();
if (typeof window !== 'undefined')
  window.addEventListener('languagechange', languagePreferences.refreshAuto);
export default i18n;
