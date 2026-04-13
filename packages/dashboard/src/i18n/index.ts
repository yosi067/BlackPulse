import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import zhTW from './locales/zh-TW';
import ja from './locales/ja';

const savedLang = localStorage.getItem('omnicenter-lang') || 'en';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, 'zh-TW': { translation: zhTW }, ja: { translation: ja } },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;

export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
] as const;
