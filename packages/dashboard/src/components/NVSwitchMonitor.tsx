import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { NvSwitchSummary } from '../types';
import styles from './NVSwitchMonitor.module.css';

interface NVSwitchMonitorProps {
  nvswitchData: NvSwitchSummary[];
  selectedServer?: number | null;
}

export default function NVSwitchMonitor({ nvswitchData, selectedServer }: NVSwitchMonitorProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [detailServer, setDetailServer] = useState<number | null>(null);

  const targetServer = detailServer ?? selectedServer;

  // Fleet-level aggregation
  const fleetStats = useMemo(() => {
    if (nvswitchData.length === 0) return null;
    return {
      totalThroughputTB: nvswitchData.reduce((s, n) => s + n.summary.totalThroughputTB, 0),
      totalFatalErrors: nvswitchData.reduce((s, n) => s + n.summary.totalFatalErrors, 0),
      totalDegradedLinks: nvswitchData.reduce((s, n) => s + n.summary.degradedLinks, 0),
      maxSwitchTemp: Math.max(...nvswitchData.map(n => n.summary.maxTemperature)),
      totalSwitchPower: nvswitchData.reduce((s, n) => s + n.summary.totalPower, 0),
    };
  }, [nvswitchData]);

  // Per-server detail
  const serverDetail = useMemo(() => {
    if (targetServer === null || targetServer === undefined) return null;
    return nvswitchData.find(n => n.serverId === targetServer) ?? null;
  }, [nvswitchData, targetServer]);

  // Top problematic servers
  const topServers = useMemo(() => {
    return [...nvswitchData]
      .sort((a, b) => {
        const scoreA = a.summary.totalFatalErrors * 100 + a.summary.degradedLinks * 10 + a.summary.maxTemperature;
        const scoreB = b.summary.totalFatalErrors * 100 + b.summary.degradedLinks * 10 + b.summary.maxTemperature;
        return scoreB - scoreA;
      })
      .slice(0, 8);
  }, [nvswitchData]);

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <span className={styles.icon}>🔀</span>
        <span className={styles.title}>{t('nvswitch.title')}</span>
        {fleetStats && fleetStats.totalFatalErrors > 0 && (
          <span className={styles.errorBadge}>{fleetStats.totalFatalErrors} fatal</span>
        )}
        <span className={styles.chevron}>{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className={styles.body}>
          {/* Fleet stats */}
          {fleetStats && (
            <div className={styles.fleetStats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{fleetStats.totalThroughputTB.toFixed(1)}</span>
                <span className={styles.statUnit}>TB/s</span>
                <span className={styles.statLabel}>{t('nvswitch.totalBw')}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{fleetStats.maxSwitchTemp.toFixed(0)}</span>
                <span className={styles.statUnit}>°C</span>
                <span className={styles.statLabel}>{t('nvswitch.maxTemp')}</span>
              </div>
              <div className={`${styles.stat} ${fleetStats.totalDegradedLinks > 5 ? styles.warn : ''}`}>
                <span className={styles.statValue}>{fleetStats.totalDegradedLinks}</span>
                <span className={styles.statLabel}>{t('nvswitch.degradedLinks')}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{(fleetStats.totalSwitchPower / 1000).toFixed(1)}</span>
                <span className={styles.statUnit}>kW</span>
                <span className={styles.statLabel}>{t('nvswitch.totalPower')}</span>
              </div>
            </div>
          )}

          {/* Server-level detail */}
          {serverDetail && (
            <div className={styles.serverDetail}>
              <div className={styles.detailTitle}>
                S{String(targetServer).padStart(3, '0')} — NVSwitch {t('nvswitch.detail')}
              </div>
              {serverDetail.switches.map(sw => (
                <div key={sw.id} className={styles.switchCard}>
                  <div className={styles.switchHeader}>
                    <span className={styles.switchName}>NVSwitch {sw.id}</span>
                    <span className={styles.switchTemp}>{sw.temperature}°C</span>
                    <span className={styles.switchPower}>{sw.power.toFixed(0)}W</span>
                  </div>
                  {/* Port status bar */}
                  <div className={styles.portBar}>
                    {Array.from({ length: sw.totalPorts }, (_, p) => {
                      const isActive = p < sw.activePortCount;
                      const isDegraded = p >= sw.activePortCount && p < sw.activePortCount + sw.degradedPortCount;
                      return (
                        <div
                          key={p}
                          className={`${styles.port} ${isActive ? styles.portActive : isDegraded ? styles.portDegraded : styles.portDown}`}
                          title={`Port ${p}: ${isActive ? 'Active' : isDegraded ? 'Degraded' : 'Down'}`}
                        />
                      );
                    })}
                  </div>
                  <div className={styles.switchStats}>
                    <span>TX: {sw.throughputTxGBs.toFixed(0)} GB/s</span>
                    <span>RX: {sw.throughputRxGBs.toFixed(0)} GB/s</span>
                    <span>Latency: {sw.avgLatencyNs.toFixed(0)}ns</span>
                    <span>CRC: {sw.crcErrors}</span>
                    <span className={sw.fatalErrors > 0 ? styles.valDanger : ''}>
                      Fatal: {sw.fatalErrors}
                    </span>
                  </div>
                  {sw.topLinkErrors.length > 0 && (
                    <div className={styles.linkErrors}>
                      {sw.topLinkErrors.map(le => (
                        <span key={le.port} className={styles.linkError}>
                          P{le.port}: {le.errors} err
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Top servers table */}
          {!serverDetail && (
            <div className={styles.topServers}>
              <div className={styles.tableTitle}>{t('nvswitch.topServers')}</div>
              {topServers.map(server => (
                <div
                  key={server.serverId}
                  className={styles.serverRow}
                  onClick={() => setDetailServer(server.serverId)}
                >
                  <span className={styles.serverName}>
                    S{String(server.serverId).padStart(3, '0')}
                  </span>
                  <span className={styles.bw}>
                    {server.summary.totalThroughputTB.toFixed(2)} TB/s
                  </span>
                  <span className={styles.temp}>{server.summary.maxTemperature.toFixed(0)}°C</span>
                  <span className={`${styles.links} ${server.summary.degradedLinks > 0 ? styles.valWarn : ''}`}>
                    {server.summary.degradedLinks} deg
                  </span>
                  <span className={`${styles.fatal} ${server.summary.totalFatalErrors > 0 ? styles.valDanger : ''}`}>
                    {server.summary.totalFatalErrors} fatal
                  </span>
                </div>
              ))}
            </div>
          )}

          {serverDetail && (
            <button className={styles.backBtn} onClick={() => setDetailServer(null)}>
              ← {t('nvswitch.backToFleet')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
