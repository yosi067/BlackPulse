import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './BatchOperations.module.css';

interface BatchOperationsProps {
  batchMode: boolean;
  selectedServers: Set<number>;
  onToggleServer: (id: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onClose: () => void;
}

type BatchAction = 'reboot' | 'firmwareUpdate' | 'coolingBoost' | 'powerCap';

export default function BatchOperations({
  batchMode,
  selectedServers,
  onToggleServer,
  onSelectAll,
  onDeselectAll,
  onClose,
}: BatchOperationsProps) {
  const { t } = useTranslation();
  const [executing, setExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<BatchAction | null>(null);

  const executeAction = useCallback(async (action: BatchAction) => {
    if (selectedServers.size === 0) return;
    setExecuting(true);
    setConfirmAction(null);

    // Simulate operation with delay
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

    setExecuting(false);
    setLastResult(t('batch.success', { count: selectedServers.size }));
    setTimeout(() => setLastResult(null), 3000);
  }, [selectedServers, t]);

  if (!batchMode) return null;

  const actions: { key: BatchAction; icon: string; color: string }[] = [
    { key: 'reboot', icon: '🔄', color: 'var(--accent-blue)' },
    { key: 'firmwareUpdate', icon: '📦', color: 'var(--accent-cyan)' },
    { key: 'coolingBoost', icon: '❄️', color: 'var(--accent-green)' },
    { key: 'powerCap', icon: '⚡', color: 'var(--accent-yellow)' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.icon}>⚙️</span>
          <span className={styles.title}>{t('batch.title')}</span>
          <span className={styles.count}>
            {t('batch.selectedCount', { count: selectedServers.size })}
          </span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.selectBtn} onClick={onSelectAll}>{t('batch.selectAll')}</button>
          <button className={styles.selectBtn} onClick={onDeselectAll}>{t('batch.deselectAll')}</button>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
      </div>

      <div className={styles.actions}>
        {actions.map(({ key, icon, color }) => (
          <button
            key={key}
            className={styles.actionBtn}
            style={{ '--action-color': color } as React.CSSProperties}
            disabled={selectedServers.size === 0 || executing}
            onClick={() => setConfirmAction(key)}
          >
            <span className={styles.actionIcon}>{icon}</span>
            <span>{t(`batch.${key}`)}</span>
          </button>
        ))}
      </div>

      {confirmAction && (
        <div className={styles.confirmBar}>
          <span>{t('batch.confirm', { action: t(`batch.${confirmAction}`), count: selectedServers.size })}</span>
          <button className={styles.confirmYes} onClick={() => executeAction(confirmAction)}>✓</button>
          <button className={styles.confirmNo} onClick={() => setConfirmAction(null)}>✗</button>
        </div>
      )}

      {executing && (
        <div className={styles.executingBar}>
          <div className={styles.spinner} />
          <span>{t('batch.executing')}</span>
        </div>
      )}

      {lastResult && (
        <div className={styles.resultBar}>{lastResult}</div>
      )}

      {selectedServers.size > 0 && (
        <div className={styles.selectedList}>
          {[...selectedServers].sort((a, b) => a - b).map(id => (
            <span key={id} className={styles.serverChip} onClick={() => onToggleServer(id)}>
              S{String(id).padStart(3, '0')} ✕
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
