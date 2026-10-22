import { Icon } from './Icon';
import { useTranslation } from 'react-i18next';
export function Navigation({
  index,
  total,
  onChange,
}: {
  index: number;
  total: number;
  onChange: (index: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const numbers = new Intl.NumberFormat(i18n.resolvedLanguage);
  return (
    <nav className="group-navigation" aria-label={t('navigation.questionGroups')}>
      <button disabled={index <= 0} onClick={() => onChange(index - 1)}>
        <Icon name="arrow" size={16} />
        {t('navigation.previous')}
      </button>
      <span aria-live="polite">
        {t('navigation.position', {
          current: numbers.format(index + 1),
          total: numbers.format(total),
        })}
      </span>
      <button disabled={index >= total - 1} onClick={() => onChange(index + 1)}>
        {t('navigation.next')}
        <span className="flipped">
          <Icon name="arrow" size={16} />
        </span>
      </button>
    </nav>
  );
}
