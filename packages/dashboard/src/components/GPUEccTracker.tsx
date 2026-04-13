import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { EccSummary } from '../types';
import styles from './GPUEccTracker.module.css';

interface GPUEccTrackerProps {
  eccData: EccSummary[];
}

export default function GPUEccTracker({ eccData }: GPUEccTrackerProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [sortBy, setSortBy] = useState<'ue' | 'ce' | 'retired' | 'xid'>('ue');
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);

  const sortedData = useMemo(() => {
    let data = [...eccData];
    if (showOnlyErrors) {
      data = data.filter(e =>
        e.summary.totalSramUE > 0 || e.summary.totalDramUE > 0 ||
        e.summary.gpusWithXidErrors > 0 || e.summary.totalRetiredPages > 5
      );
    }
    switch (sortBy) {
      case 'ue':
        data.sort((a, b) => (b.summary.totalSramUE + b.summary.totalDramUE) - (a.summary.totalSramUE + a.summary.totalDramUE));
        break;
      case 'ce':
        data.sort((a, b) => (b.summary.totalSramCE + b.summary.totalDramCE) - (a.summary.totalSramCE + a.summary.totalDramCE));
        break;
      case 'retired':
        data.sort((a, b) => b.summary.totalRetiredPages - a.summary.totalRetiredPages);
        break;
      case 'xid':
        data.sort((a, b) => b.summary.gpusWithXidErrors - a.summary.gpusWithXidErrors);
        break;
    }
    return data.slice(0, 20); // Show top 20
  }, [eccData, sortBy, showOnlyErrors]);

  const fleetSummary = useMemo(() => {
    if (eccData.length === 0) return null;
    return {
      totalUE: eccData.reduce((s, e) => s + e.summary.totalSramUE + e.summary.totalDramUE, 0),
      totalCE: eccData.reduce((s, e) => s + e.summary.totalSramCE + e.summary.totalDramCE, 0),
      serverWithUE: eccData.filter(e => e.summary.gpusWithUncorrectable > 0).length,
      totalRetiredPages: eccData.reduce((s, e) => s + e.summary.totalRetiredPages, 0),
      totalXidServers: eccData.filter(e => e.summary.gpusWithXidErrors > 0).length,
    };
  }, [eccData]);

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <span className={styles.icon}>💾</span>
        <span className={styles.title}>{t('ecc.title')}</span>
        {fleetSummary && fleetSummary.totalUE > 0 && (
          <span className={styles.ueBadge}>{fleetSummary.totalUE} UE</span>
        )}
        <span className={styles.chevron}>{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className={styles.body}>
          {/* Fleet-level summary */}
          {fleetSummary && (
            <div className={styles.fleetStats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{fleetSummary.totalCE.toLocaleString()}</span>
                <span className={styles.statLabel}>{t('ecc.correctableErrors')}</span>
              </div>
              <div className={`${styles.stat} ${fleetSummary.totalUE > 0 ? styles.danger : ''}`}>
                <span className={styles.statValue}>{fleetSummary.totalUE}</span>
                <span className={styles.statLabel}>{t('ecc.uncorrectableErrors')}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{fleetSummary.totalRetiredPages}</span>
                <span className={styles.statLabel}>{t('ecc.retiredPages')}</span>
              </div>
              <div className={`${styles.stat} ${fleetSummary.totalXidServers > 0 ? styles.danger : ''}`}>
                <span className={styles.statValue}>{fleetSummary.totalXidServers}</span>
                <span className={styles.statLabel}>{t('ecc.xidServers')}</span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className={styles.controls}>
            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
            >
              <option value="ue">{t('ecc.sortUE')}</option>
              <option value="ce">{t('ecc.sortCE')}</option>
              <option value="retired">{t('ecc.sortRetired')}</option>
              <option value="xid">{t('ecc.sortXid')}</option>
            </select>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={showOnlyErrors}
                onChange={e => setShowOnlyErrors(e.target.checked)}
              />
              {t('ecc.onlyErrors')}
            </label>
          </div>

          {/* Server list */}
          <div className={styles.serverList}>
            <div className={styles.listHeader}>
              <span className={styles.colServer}>{t('ecc.server')}</span>
              <span className={styles.col}>SRAM CE</span>
              <span className={styles.col}>SRAM UE</span>
              <span className={styles.col}>DRAM CE</span>
              <span className={styles.col}>DRAM UE</span>
              <span className={styles.col}>{t('ecc.retired')}</span>
              <span className={styles.col}>XID</span>
            </div>
            {sortedData.map(server => {
              const s = server.summary;
              const hasUE = s.totalSramUE > 0 || s.totalDramUE > 0;
              return (
                <div key={server.serverId} className={`${styles.row} ${hasUE ? styles.rowDanger : ''}`}>
                  <span className={styles.colServer}>
                    S{String(server.serverId).padStart(3, '0')}
                  </span>
                  <span className={styles.col}>{s.totalSramCE}</span>
                  <span className={`${styles.col} ${s.totalSramUE > 0 ? styles.valDanger : ''}`}>
                    {s.totalSramUE}
                  </span>
                  <span className={styles.col}>{s.totalDramCE}</span>
                  <span className={`${styles.col} ${s.totalDramUE > 0 ? styles.valDanger : ''}`}>
                    {s.totalDramUE}
                  </span>
                  <span className={`${styles.col} ${s.totalRetiredPages > 10 ? styles.valWarn : ''}`}>
                    {s.totalRetiredPages}
                  </span>
                  <span className={`${styles.col} ${s.gpusWithXidErrors > 0 ? styles.valDanger : ''}`}>
                    {s.gpusWithXidErrors}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={styles.note}>
            ⚠ {t('ecc.demoNote')}
          </div>
        </div>
      )}
    </div>
  );
}
