import styles from './GlobalHeader.module.css';

interface HeaderProps {
  totalServers: number;
  avgPue: number;
  totalWattageKW: number;
  alertCount: number;
  connected: boolean;
  onPanic: () => void;
  onReset: () => void;
}

export default function GlobalHeader({
  totalServers,
  avgPue,
  totalWattageKW,
  alertCount,
  connected,
  onPanic,
  onReset,
}: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logo}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="24" height="24" rx="4" fill="#76b900" fillOpacity="0.15" stroke="#76b900" strokeWidth="1.5"/>
            <path d="M8 14h12M14 8v12M10 10l8 8M18 10l-8 8" stroke="#76b900" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <div className={styles.title}>OmniCenter AI</div>
          <div className={styles.subtitle}>Blackwell NVL72 Fleet Monitor</div>
        </div>
        <div className={`${styles.statusDot} ${connected ? styles.online : styles.offline}`} />
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <div className={styles.metricValue}>{totalServers}</div>
          <div className={styles.metricLabel}>MACHINES</div>
        </div>
        <div className={styles.divider} />
        <div className={styles.metric}>
          <div className={styles.metricValue}>{avgPue.toFixed(2)}</div>
          <div className={styles.metricLabel}>AVG PUE</div>
        </div>
        <div className={styles.divider} />
        <div className={styles.metric}>
          <div className={`${styles.metricValue} ${styles.power}`}>
            {totalWattageKW.toFixed(1)}
            <span className={styles.unit}> kW</span>
          </div>
          <div className={styles.metricLabel}>TOTAL POWER</div>
        </div>
        <div className={styles.divider} />
        <div className={styles.metric}>
          <div className={`${styles.metricValue} ${alertCount > 0 ? styles.alertActive : ''}`}>
            {alertCount}
          </div>
          <div className={styles.metricLabel}>ALERTS</div>
        </div>
      </div>

      <div className={styles.controls}>
        <button className={styles.panicBtn} onClick={onPanic} title="Trigger panic mode on 5 random servers">
          ⚡ PANIC
        </button>
        <button className={styles.resetBtn} onClick={onReset} title="Reset all servers to normal">
          ↻ RESET
        </button>
      </div>
    </header>
  );
}
