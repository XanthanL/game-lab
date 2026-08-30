import { useLanguage } from '../contexts/LanguageContext';
import { translate, type TranslationKey } from '../i18n/translations';

export function useTranslation() {
  const { language } = useLanguage();

  function t(key: TranslationKey): string {
    return translate(language, key);
  }

  return { t, language };
}
