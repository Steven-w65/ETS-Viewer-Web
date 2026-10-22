import type { SupportedLocale } from './locales';
const plural = /_(zero|one|two|few|many|other)$/;
const params = (value: string) =>
  [...value.matchAll(/{{\s*-?\s*([\w.]+)(?:,[^}]*)?\s*}}/g)].map((match) => match[1]);
function families(locale: SupportedLocale, errors: string[]) {
  const result = new Map<string, { params: Set<string>; forms: Set<string> }>();
  for (const [key, value] of Object.entries(locale.resources)) {
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${locale.code}: invalid resource ${key}`);
      continue;
    }
    const base = key.replace(plural, ''),
      family = result.get(base) ?? { params: new Set<string>(), forms: new Set<string>() };
    params(value).forEach((param) => family.params.add(param));
    family.forms.add(key.match(plural)?.[1] ?? 'plain');
    result.set(base, family);
  }
  return result;
}
export function validateResources(locales: readonly SupportedLocale[], fallback: string): string[] {
  const errors: string[] = [],
    baseline = locales.find((locale) => locale.code === fallback);
  if (!baseline) return ['Missing fallback locale'];
  const expected = families(baseline, errors);
  for (const locale of locales) {
    try {
      Intl.getCanonicalLocales(locale.code);
    } catch {
      errors.push(`${locale.code}: invalid locale identifier`);
      continue;
    }
    const actual = families(locale, errors);
    for (const [key, want] of expected) {
      const got = actual.get(key);
      if (!got) {
        errors.push(`${locale.code}: missing key ${key}`);
        continue;
      }
      if (want.forms.has('plain') && !got.forms.has('plain'))
        errors.push(`${locale.code}: missing key ${key}`);
      if (want.forms.has('plain'))
        for (const form of got.forms)
          if (form !== 'plain' && !want.forms.has(form))
            errors.push(`${locale.code}: unexpected key ${key}_${form}`);
      if ([...want.params].sort().join('|') !== [...got.params].sort().join('|'))
        errors.push(`${locale.code}: parameters differ for ${key}`);
      if (!want.forms.has('plain'))
        for (const category of new Intl.PluralRules(locale.code).resolvedOptions().pluralCategories)
          if (!got.forms.has(category))
            errors.push(`${locale.code}: missing plural ${key}_${category}`);
    }
    for (const [key, value] of Object.entries(locale.resources)) {
      if (typeof value !== 'string') continue;
      const base = key.replace(plural, ''),
        family = expected.get(base);
      if (!family) continue;
      const reference =
        baseline.resources[key] ?? baseline.resources[`${base}_other`] ?? baseline.resources[base];
      if (
        typeof reference === 'string' &&
        [...new Set(params(value))].sort().join('|') !==
          [...new Set(params(reference))].sort().join('|')
      )
        errors.push(`${locale.code}: parameters differ for variant ${key}`);
    }
    for (const key of actual.keys())
      if (!expected.has(key)) errors.push(`${locale.code}: unexpected key ${key}`);
  }
  return errors;
}
