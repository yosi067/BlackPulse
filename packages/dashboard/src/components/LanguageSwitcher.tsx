import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n';
import styles from './LanguageSwitcher.module.css';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const handleChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('omnicenter-lang', code);
  };

  return (
    <div className={styles.container}>
      {LANGUAGES.map(lang => (
        <button
          key={lang.code}
          className={`${styles.btn} ${i18n.language === lang.code ? styles.active : ''}`}
          onClick={() => handleChange(lang.code)}
          title={lang.label}
        >
          {lang.flag}
        </button>
      ))}
    </div>
  );
}
