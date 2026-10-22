import { describe, expect, it, vi } from 'vitest';
import { resolveLanguage } from '../src/i18n/languageMatching';
import { createLocalization } from '../src/i18n';
import { supportedLocales, type SupportedLocale } from '../src/i18n/locales';
import { validateResources } from '../src/i18n/validateResources';

const locale = (code: string, nativeName = code): SupportedLocale => ({
  code,
  nativeName,
  resources: { 'test.message': 'Hello {{name}}' },
});
describe('registry-driven language matching', () => {
  const initial = [locale('en'), locale('zh-CN')];
  it('matches exact, canonical and regional locales while exhausting ordered preferences', () => {
    expect(resolveLanguage(['zh-cn'], initial, 'en')).toBe('zh-CN');
    expect(resolveLanguage(['en-GB'], initial, 'en')).toBe('en');
    expect(resolveLanguage(['ja-JP', 'fr-FR', 'zh-SG'], initial, 'en')).toBe('zh-CN');
    expect(resolveLanguage(['fr-FR', 'en-US'], initial, 'en')).toBe('en');
  });
  it('rejects incompatible scripts instead of forcing every regional variant into one resource', () => {
    expect(resolveLanguage(['zh-TW', 'en-US'], initial, 'en')).toBe('en');
    expect(resolveLanguage(['zh-Hant'], initial, 'en')).toBe('en');
    expect(resolveLanguage(['sr-Latn'], [locale('sr-Cyrl'), locale('en')], 'en')).toBe('en');
    expect(resolveLanguage(['zh-Hant-HK'], [...initial, locale('zh-TW')], 'en')).toBe('zh-TW');
  });
  it('supports arbitrary future registrations and explicit aliases without changing the matcher', () => {
    expect(resolveLanguage(['ja-JP', 'fr-FR', 'en-US'], initial, 'en')).toBe('en');
    expect(resolveLanguage(['ja-JP', 'fr-FR', 'en-US'], [...initial, locale('fr')], 'en')).toBe(
      'fr',
    );
    expect(
      resolveLanguage(['ja-JP', 'fr-FR'], [...initial, locale('fr'), locale('ja')], 'en'),
    ).toBe('ja');
    expect(
      resolveLanguage(['de-AT'], [{ ...locale('de'), aliases: ['de-AT'] }, ...initial], 'en'),
    ).toBe('de');
  });
  it('prefers an exact registered locale over an earlier broad alias', () => {
    expect(
      resolveLanguage(
        ['no'],
        [locale('en'), { ...locale('nb'), aliases: ['no'] }, locale('no')],
        'en',
      ),
    ).toBe('no');
    expect(
      resolveLanguage(
        ['fr-CA'],
        [locale('en'), { ...locale('fr'), aliases: ['fr-CA'] }, locale('fr-CA')],
        'en',
      ),
    ).toBe('fr-CA');
  });
  it('handles empty, invalid and unsupported preferences with a configurable fallback', () => {
    expect(resolveLanguage([], initial, 'en')).toBe('en');
    expect(resolveLanguage(['%%%', 'not a locale', 'xx-XX'], initial, 'zh-CN')).toBe('zh-CN');
  });
});
describe('language preference and resource handling', () => {
  it('gets the complete ordered browser list through the real detector, ignoring stale caches', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP', 'fr-FR', 'zh-CN']);
    localStorage.setItem('i18nextLng', 'en');
    const runtime = createLocalization(supportedLocales);
    expect(runtime.i18n.resolvedLanguage).toBe('zh-CN');
    vi.restoreAllMocks();
  });
  it('keeps Auto distinct, ignores stale detector caches and applies current browser preferences', async () => {
    const storage = new Map([['i18nextLng', 'en']]);
    const runtime = createLocalization(supportedLocales, {
      storage: {
        getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => {
          storage.set(k, v);
        },
      },
      detect: () => ['zh-CN'],
    });
    expect(runtime.preferences.getSnapshot()).toBe('auto');
    expect(runtime.i18n.resolvedLanguage).toBe('zh-CN');
    await runtime.preferences.setPreference('en');
    expect(runtime.i18n.resolvedLanguage).toBe('en');
    await runtime.preferences.setPreference('auto');
    expect(runtime.i18n.resolvedLanguage).toBe('zh-CN');
    expect(storage.get('ets-language')).toBe('auto');
  });
  it('restores supported manual preferences and safely handles removed locales and blocked storage', () => {
    const runtime = createLocalization(supportedLocales, {
      storage: { getItem: () => 'en', setItem: () => {} },
      detect: () => ['zh-CN'],
    });
    expect(runtime.preferences.getSnapshot()).toBe('en');
    expect(runtime.i18n.resolvedLanguage).toBe('en');
    const removed = createLocalization(supportedLocales, {
      storage: { getItem: () => 'fr', setItem: () => {} },
      detect: () => ['zh-CN'],
    });
    expect(removed.preferences.getSnapshot()).toBe('auto');
    const blocked = createLocalization(supportedLocales, {
      storage: {
        getItem: () => {
          throw Error('blocked');
        },
        setItem: () => {
          throw Error('blocked');
        },
      },
      detect: () => ['en'],
    });
    expect(() => blocked.preferences.setPreference('zh-CN')).not.toThrow();
    expect(blocked.i18n.resolvedLanguage).toBe('zh-CN');
  });
  it('validates every registry resource and reports missing/unexpected keys and interpolation errors', () => {
    expect(validateResources(supportedLocales, 'en')).toEqual([]);
    const broken = [locale('en'), { ...locale('fr'), resources: { 'test.other': 'Other' } }];
    expect(validateResources(broken, 'en').join(' ')).toMatch(/missing/i);
    expect(validateResources(broken, 'en').join(' ')).toMatch(/unexpected/i);
    expect(
      validateResources(
        [locale('en'), { ...locale('fr'), resources: { 'test.message': 'Salut {{other}}' } }],
        'en',
      ).join(' '),
    ).toMatch(/parameter/i);
    expect(
      validateResources(
        [locale('en'), { ...locale('fr'), resources: { 'test.message': null } }],
        'en',
      ).join(' '),
    ).toMatch(/invalid/i);
  });
  it('detects a missing interpolation parameter in an individual plural form', () => {
    const packs: SupportedLocale[] = [
      {
        ...locale('en'),
        resources: { items_one: '{{count}} item', items_other: '{{count}} items' },
      },
      {
        ...locale('fr'),
        resources: {
          items_one: '{{count}} élément',
          items_many: '{{count}} éléments',
          items_other: 'éléments',
        },
      },
    ];
    expect(validateResources(packs, 'en').join(' ')).toMatch(/parameter/i);
  });
  it('rejects plural-only replacements for ordinary interface keys', () => {
    const packs: SupportedLocale[] = [
      { ...locale('en'), resources: { 'settings.language': 'Language' } },
      { ...locale('fr'), resources: { 'settings.language_other': 'Langue' } },
    ];
    expect(validateResources(packs, 'en').join(' ')).toMatch(/missing.*settings\.language/i);
    expect(validateResources(packs, 'en').join(' ')).toMatch(
      /unexpected.*settings\.language_other/i,
    );
  });
});
