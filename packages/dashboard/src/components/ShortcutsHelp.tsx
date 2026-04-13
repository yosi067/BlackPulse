import { useTranslation } from 'react-i18next';
import styles from './ShortcutsHelp.module.css';

interface ShortcutsHelpProps {
  onClose: () => void;
}

export default function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>⌨️ {t('shortcuts.title')}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.list}>
          {[
            { key: '↑ ↓ ← →', desc: t('shortcuts.arrows') },
            { key: 'Enter', desc: t('shortcuts.enter') },
            { key: 'Esc', desc: t('shortcuts.escape') },
            { key: 'P', desc: t('shortcuts.p') },
            { key: 'R', desc: t('shortcuts.r') },
            { key: 'B', desc: t('shortcuts.b') },
            { key: '?', desc: t('shortcuts.questionMark') },
          ].map(s => (
            <div key={s.key} className={styles.row}>
              <kbd className={styles.kbd}>{s.key}</kbd>
              <span className={styles.desc}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
