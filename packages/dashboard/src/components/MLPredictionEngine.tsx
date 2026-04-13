import { useMemo, useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServerTelemetry } from '../types';
import styles from './MLPredictionEngine.module.css';

interface MLPredictionEngineProps {
  rawBatch: ServerTelemetry[] | null;
}

// Simulated ML models for demonstration
class ThermalPredictor {
  // Simple ARIMA-like forecast using exponential smoothing
  static forecast(history: number[], steps: number): number[] {
    if (history.length < 2) return new Array(steps).fill(history[0] || 50);
    const alpha = 0.3;
    const beta = 0.1;
    let level = history[0];
    let trend = history[1] - history[0];

    for (const val of history) {
      const prevLevel = level;
      level = alpha * val + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }

    const result: number[] = [];
    for (let i = 1; i <= steps; i++) {
      result.push(Math.round((level + trend * i + (Math.random() - 0.5) * 3) * 10) / 10);
    }
    return result;
  }
}

class FailurePredictor {
  // Weibull distribution-inspired failure probability
  static predict(server: ServerTelemetry): {
    component: string;
    probability: number;
    hoursToFailure: number;
    confidence: number;
  }[] {
    const maxTemp = Math.max(...server.thermal.gpuCoreTemps);
    const avgUtil = server.compute.gpuUtilization.reduce((a, b) => a + b, 0) / server.compute.gpuUtilization.length;
    const minPsu = Math.min(...server.power.psuEfficiency);

    const predictions = [];

    // GPU thermal failure
    const tempStress = Math.max(0, (maxTemp - 70) / 35);
    const gpuFailProb = Math.round(1 - Math.exp(-Math.pow(tempStress, 2.5)) * 100) / 100;
    predictions.push({
      component: 'GPU Module',
      probability: Math.min(99, Math.round(gpuFailProb * 100)),
      hoursToFailure: Math.max(1, Math.round(720 * (1 - tempStress) + Math.random() * 48)),
      confidence: 85 + Math.round(Math.random() * 10),
    });

    // PSU degradation
    const psuStress = Math.max(0, (95 - minPsu) / 15);
    predictions.push({
      component: 'PSU',
      probability: Math.min(95, Math.round(psuStress * 60)),
      hoursToFailure: Math.max(2, Math.round(1440 * (1 - psuStress * 0.8) + Math.random() * 72)),
      confidence: 78 + Math.round(Math.random() * 15),
    });

    // NVLink degradation
    const maxBw = Math.max(...server.compute.nvlinkBandwidth);
    const nvStress = Math.max(0, (maxBw - 70) / 30);
    predictions.push({
      component: 'NVLink',
      probability: Math.min(80, Math.round(nvStress * 40)),
      hoursToFailure: Math.max(4, Math.round(2160 * (1 - nvStress * 0.5) + Math.random() * 96)),
      confidence: 72 + Math.round(Math.random() * 18),
    });

    // Coolant pump
    const flowStress = Math.max(0, 1 - server.thermal.liquidCoolingFlowRate / 15);
    predictions.push({
      component: 'Coolant Pump',
      probability: Math.min(70, Math.round(flowStress * 50)),
      hoursToFailure: Math.max(6, Math.round(4320 * (1 - flowStress * 0.6) + Math.random() * 120)),
      confidence: 68 + Math.round(Math.random() * 20),
    });

    return predictions.sort((a, b) => b.probability - a.probability);
  }
}

class CapacityPlanner {
  static analyze(batch: ServerTelemetry[]): {
    currentUtil: number;
    projectedUtil72h: number;
    maxCapacityETA: string;
    recommendation: string;
  } {
    const avgUtil = batch.reduce((sum, s) => {
      const u = s.compute.gpuUtilization.reduce((a, b) => a + b, 0) / s.compute.gpuUtilization.length;
      return sum + u;
    }, 0) / batch.length;

    const growthRate = 0.15 + Math.random() * 0.1; // % per day simulated
    const projected72h = Math.min(100, avgUtil + growthRate * 3);
    const daysToMax = avgUtil > 10 ? (100 - avgUtil) / growthRate : 999;

    let rec = 'Fleet operating within normal capacity.';
    if (projected72h > 85) rec = 'CRITICAL: Projected capacity overflow in 72h. Scale out recommended.';
    else if (projected72h > 70) rec = 'WARNING: Approaching capacity limits. Monitor closely.';

    return {
      currentUtil: Math.round(avgUtil * 10) / 10,
      projectedUtil72h: Math.round(projected72h * 10) / 10,
      maxCapacityETA: daysToMax > 365 ? '> 1 year' : `~${Math.round(daysToMax)} days`,
      recommendation: rec,
    };
  }
}

// Mini sparkline component for ML panel
function MiniChart({ data, color, width = 180, height = 40 }: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`
  ).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className={styles.chart}>
      <defs>
        <linearGradient id={`grad_${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad_${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
      {/* Forecast zone */}
      {data.length > 12 && (
        <line
          x1={(12 / (data.length - 1)) * width}
          y1="0"
          x2={(12 / (data.length - 1)) * width}
          y2={height}
          stroke={color}
          strokeWidth="0.5"
          strokeDasharray="3,3"
          opacity="0.5"
        />
      )}
    </svg>
  );
}

export default function MLPredictionEngine({ rawBatch }: MLPredictionEngineProps) {
  const { t } = useTranslation();
  const [thermalHistory, setThermalHistory] = useState<number[]>([]);
  const tickRef = useRef(0);

  // Collect thermal history
  useEffect(() => {
    if (!rawBatch || rawBatch.length === 0) return;
    const avgFleetTemp = rawBatch.reduce((sum, s) => {
      return sum + s.thermal.gpuCoreTemps.reduce((a, b) => a + b, 0) / s.thermal.gpuCoreTemps.length;
    }, 0) / rawBatch.length;

    setThermalHistory(prev => {
      const next = [...prev, avgFleetTemp];
      return next.length > 60 ? next.slice(-60) : next;
    });
    tickRef.current++;
  }, [rawBatch]);

  // Thermal forecast
  const thermalForecast = useMemo(() => {
    if (thermalHistory.length < 5) return thermalHistory;
    const forecast = ThermalPredictor.forecast(thermalHistory, 12);
    return [...thermalHistory.slice(-12), ...forecast];
  }, [thermalHistory]);

  // Failure predictions for top 5 hottest servers
  const failurePredictions = useMemo(() => {
    if (!rawBatch || rawBatch.length === 0) return [];
    const sorted = [...rawBatch].sort((a, b) =>
      Math.max(...b.thermal.gpuCoreTemps) - Math.max(...a.thermal.gpuCoreTemps)
    );
    return sorted.slice(0, 3).map(s => ({
      serverId: s.serverId,
      predictions: FailurePredictor.predict(s),
    }));
  }, [rawBatch]);

  // Capacity planning
  const capacity = useMemo(() => {
    if (!rawBatch || rawBatch.length === 0) return null;
    return CapacityPlanner.analyze(rawBatch);
  }, [rawBatch]);

  // Fleet health index (0-100)
  const healthIndex = useMemo(() => {
    if (!rawBatch || rawBatch.length === 0) return 100;
    let score = 100;
    for (const s of rawBatch) {
      const mt = Math.max(...s.thermal.gpuCoreTemps);
      if (mt > 90) score -= 2;
      else if (mt > 80) score -= 0.5;
      const mp = Math.min(...s.power.psuEfficiency);
      if (mp < 88) score -= 1;
    }
    return Math.max(0, Math.round(score));
  }, [rawBatch]);

  const healthColor = healthIndex > 80 ? 'var(--accent-green)' : healthIndex > 60 ? 'var(--accent-yellow)' : 'var(--accent-red)';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🤖</span>
          <div>
            <div className={styles.headerTitle}>{t('mlEngine.title')}</div>
            <div className={styles.headerSub}>{t('mlEngine.subtitle')}</div>
          </div>
        </div>
        <div className={styles.demoBadge}>{t('mlEngine.demoNote')}</div>
      </div>

      <div className={styles.grid}>
        {/* Fleet Health Index */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>{t('mlEngine.health')}</div>
          <div className={styles.healthScore} style={{ color: healthColor }}>
            {healthIndex}
            <span className={styles.healthMax}>/100</span>
          </div>
          <div className={styles.healthBar}>
            <div className={styles.healthFill} style={{ width: `${healthIndex}%`, background: healthColor }} />
          </div>
        </div>

        {/* Thermal Forecast */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>{t('mlEngine.thermalForecast')}</div>
          <MiniChart data={thermalForecast} color="#58a6ff" width={200} height={50} />
          <div className={styles.chartLabels}>
            <span>Now</span>
            <span style={{ color: 'var(--accent-blue)', opacity: 0.6 }}>│ Forecast →</span>
            <span>+24h</span>
          </div>
        </div>

        {/* Failure Predictions */}
        <div className={`${styles.card} ${styles.cardWide}`}>
          <div className={styles.cardTitle}>{t('mlEngine.failureProbability')}</div>
          <div className={styles.failureGrid}>
            {failurePredictions.map(({ serverId, predictions }) => (
              <div key={serverId} className={styles.serverPrediction}>
                <div className={styles.serverTag}>S{String(serverId).padStart(3, '0')}</div>
                {predictions.map((p) => (
                  <div key={p.component} className={styles.predRow}>
                    <span className={styles.compName}>{p.component}</span>
                    <div className={styles.probBar}>
                      <div
                        className={styles.probFill}
                        style={{
                          width: `${p.probability}%`,
                          background: p.probability > 50 ? 'var(--accent-red)' :
                            p.probability > 25 ? 'var(--accent-yellow)' : 'var(--accent-green)',
                        }}
                      />
                    </div>
                    <span className={styles.probVal}>{p.probability}%</span>
                    <span className={styles.etaVal}>{p.hoursToFailure}h</span>
                    <span className={styles.confVal}>{p.confidence}%</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className={styles.legendRow}>
            <span>Prob</span>
            <span>ETA</span>
            <span>{t('mlEngine.confidence')}</span>
          </div>
        </div>

        {/* Capacity Planning */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>{t('mlEngine.capacityPlanning')}</div>
          {capacity && (
            <div className={styles.capacityStats}>
              <div className={styles.capRow}>
                <span className={styles.capLabel}>Current Utilization</span>
                <span className={styles.capValue}>{capacity.currentUtil}%</span>
              </div>
              <div className={styles.capRow}>
                <span className={styles.capLabel}>Projected (72h)</span>
                <span className={styles.capValue} style={{
                  color: capacity.projectedUtil72h > 85 ? 'var(--accent-red)' :
                    capacity.projectedUtil72h > 70 ? 'var(--accent-yellow)' : 'var(--text-primary)',
                }}>
                  {capacity.projectedUtil72h}%
                </span>
              </div>
              <div className={styles.capRow}>
                <span className={styles.capLabel}>Max Capacity ETA</span>
                <span className={styles.capValue}>{capacity.maxCapacityETA}</span>
              </div>
              <div className={styles.capRecommendation}>{capacity.recommendation}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
