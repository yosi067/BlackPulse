import { useMemo } from 'react';
import type { ServerTelemetry, AIOpsAlert } from '../types';
import styles from './AIOpsPanel.module.css';

interface AIOpsProps {
  rawBatch: ServerTelemetry[] | null;
}

// Generate pseudo-AI predictions based on telemetry anomalies
function generateAlerts(batch: ServerTelemetry[]): AIOpsAlert[] {
  const alerts: AIOpsAlert[] = [];
  const now = Date.now();

  for (const server of batch) {
    const maxTemp = Math.max(...server.thermal.gpuCoreTemps);
    const avgUtil = server.compute.gpuUtilization.reduce((a, b) => a + b, 0) / server.compute.gpuUtilization.length;
    const maxBw = Math.max(...server.compute.nvlinkBandwidth);

    if (maxTemp > 85) {
      const prob = Math.min(99, Math.round(60 + (maxTemp - 85) * 3));
      alerts.push({
        id: `thermal_${server.serverId}`,
        serverId: server.serverId,
        gpuId: server.thermal.gpuCoreTemps.indexOf(maxTemp),
        type: 'thermal_throttle',
        probability: prob,
        timeHorizon: maxTemp > 95 ? '10min' : '1h',
        severity: maxTemp > 90 ? 'critical' : 'warning',
        message: `GPU #${server.thermal.gpuCoreTemps.indexOf(maxTemp)} Thermal Throttle: ${prob}% in ${maxTemp > 95 ? '10min' : '1h'}`,
        timestamp: now,
      });
    }

    if (maxTemp > 80) {
      const fanProb = Math.min(95, Math.round(50 + (maxTemp - 80) * 4));
      alerts.push({
        id: `fan_${server.serverId}`,
        serverId: server.serverId,
        gpuId: server.thermal.gpuCoreTemps.indexOf(maxTemp),
        type: 'fan_failure',
        probability: fanProb,
        timeHorizon: '2h',
        severity: fanProb > 75 ? 'critical' : 'warning',
        message: `Fan Failure Prediction: ${fanProb}% in 2h`,
        timestamp: now,
      });
    }

    if (maxBw > 90) {
      alerts.push({
        id: `nvlink_${server.serverId}`,
        serverId: server.serverId,
        gpuId: 0,
        type: 'nvlink_degraded',
        probability: Math.round(40 + maxBw * 0.4),
        timeHorizon: '30min',
        severity: 'warning',
        message: `NVLink congestion detected, bandwidth at ${Math.round(maxBw)}%`,
        timestamp: now,
      });
    }

    const minPsu = Math.min(...server.power.psuEfficiency);
    if (minPsu < 88) {
      alerts.push({
        id: `psu_${server.serverId}`,
        serverId: server.serverId,
        gpuId: 0,
        type: 'psu_failure',
        probability: Math.round(100 - minPsu),
        timeHorizon: '4h',
        severity: minPsu < 85 ? 'critical' : 'warning',
        message: `PSU efficiency degraded to ${Math.round(minPsu)}%`,
        timestamp: now,
      });
    }
  }

  // Sort by severity (critical first) then probability
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return b.probability - a.probability;
  });

  return alerts.slice(0, 20);
}

export default function AIOpsPanel({ rawBatch }: AIOpsProps) {
  const alerts = useMemo(() => {
    if (!rawBatch) return [];
    return generateAlerts(rawBatch);
  }, [rawBatch]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>🧠</div>
        <div>
          <div className={styles.headerTitle}>AIOps Predictions</div>
          <div className={styles.headerSub}>{alerts.length} active alerts</div>
        </div>
      </div>
      <div className={styles.list}>
        {alerts.length === 0 && (
          <div className={styles.empty}>All systems nominal</div>
        )}
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`${styles.alert} ${alert.severity === 'critical' ? styles.critical : styles.warning}`}
          >
            <div className={styles.alertHeader}>
              <span className={styles.serverTag}>S{String(alert.serverId).padStart(3, '0')}</span>
              <span className={styles.probBadge}>{alert.probability}%</span>
            </div>
            <div className={styles.alertMessage}>{alert.message}</div>
            <div className={styles.alertMeta}>
              <span className={styles.alertType}>{alert.type.replace(/_/g, ' ')}</span>
              <span className={styles.alertTime}>⏱ {alert.timeHorizon}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
