import type { SupportedLocale } from './locales';
export function canonicalLocale(value: string): string | undefined {
  try {
    return Intl.getCanonicalLocales(value.trim().replaceAll('_', '-'))[0];
  } catch {
    return;
  }
}
/** Ordered lookup: exact/alias first, then same language and compatible maximized script. */
export function resolveLanguage(
  preferences: readonly string[],
  locales: readonly SupportedLocale[],
  fallback: string,
): string {
  for (const value of preferences) {
    const code = canonicalLocale(value);
    if (!code) continue;
    const exact = locales.find((locale) => canonicalLocale(locale.code) === code);
    if (exact) return exact.code;
    const alias = locales.find((locale) =>
      locale.aliases?.some((alias) => canonicalLocale(alias) === code),
    );
    if (alias) return alias.code;
    const wanted = new Intl.Locale(code),
      expanded = wanted.maximize();
    const candidates = locales.flatMap((locale, index) => {
      const canonical = canonicalLocale(locale.code);
      if (!canonical) return [];
      const candidate = new Intl.Locale(canonical),
        maximal = candidate.maximize();
      if (wanted.language !== candidate.language || expanded.script !== maximal.script) return [];
      return [
        {
          locale,
          index,
          score:
            (wanted.region && wanted.region === candidate.region ? 4 : 0) +
            (!candidate.region ? 2 : 0) +
            (wanted.script === candidate.script ? 1 : 0),
        },
      ];
    });
    candidates.sort((a, b) => b.score - a.score || a.index - b.index);
    if (candidates.length) return candidates[0].locale.code;
  }
  return locales.find((locale) => locale.code === fallback)?.code ?? locales[0]?.code ?? fallback;
}
