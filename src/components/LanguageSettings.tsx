import { useTranslation } from 'react-i18next';
import { languagePreferences } from '../i18n';
import { useLanguagePreference, type LanguagePreferences } from '../i18n/languagePreference';
export function LanguageSettings({
  manager = languagePreferences,
}: {
  manager?: LanguagePreferences;
}) {
  const { t } = useTranslation(),
    { preference, setPreference, locales } = useLanguagePreference(manager);
  return (
    <div className="language-setting">
      <label>
        <span>{t('settings.language')}</span>
        <select
          aria-label={t('settings.language')}
          value={preference}
          onChange={(event) => void setPreference(event.target.value)}
        >
          <option value="auto">{t('settings.auto')}</option>
          {locales.map((locale) => (
            <option key={locale.code} value={locale.code} lang={locale.code}>
              {locale.nativeName}
            </option>
          ))}
        </select>
      </label>
      <small>{t('settings.languageHelp')}</small>
    </div>
  );
}
