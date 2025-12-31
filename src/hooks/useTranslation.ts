import { useTranslation as useI18nTranslation } from 'react-i18next';

export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const getCurrentLanguage = () => {
    return i18n.language;
  };

  const getAvailableLanguages = () => {
    return ['zh', 'zh-TW', 'en'];
  };

  const getLanguageLabel = (lng: string) => {
    const labels: Record<string, string> = {
      zh: '简体中文',
      'zh-TW': '繁體中文',
      en: 'English'
    };
    return labels[lng] || lng;
  };

  return {
    t,
    changeLanguage,
    getCurrentLanguage,
    getAvailableLanguages,
    getLanguageLabel,
    i18n
  };
};

export default useTranslation;
