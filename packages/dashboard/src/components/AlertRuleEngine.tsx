import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServerTelemetry } from '../types';
import styles from './AlertRuleEngine.module.css';

export interface AlertRule {
  id: string;
  name: string;
  metric: 'gpu_temp' | 'gpu_util' | 'power' | 'coolant_flow';
  operator: '>' | '<' | '>=' | '<=';
  threshold: number;
  durationSec: number;
  enabled: boolean;
  combineWith?: { metric: string; operator: string; threshold: number };
}

interface AlertRuleMatch {
  ruleId: string;
  serverId: number;
  currentValue: number;
  triggeredAt: number;
}

const DEFAULT_RULES: AlertRule[] = [
  {
    id: 'r1',
    name: 'High GPU Temp (3min)',
    metric: 'gpu_temp',
    operator: '>',
    threshold: 85,
    durationSec: 180,
    enabled: true,
    combineWith: { metric: 'gpu_util', operator: '>', threshold: 90 },
  },
  {
    id: 'r2',
    name: 'Critical Temp',
    metric: 'gpu_temp',
    operator: '>',
    threshold: 95,
    durationSec: 30,
    enabled: true,
  },
  {
    id: 'r3',
    name: 'Low Coolant Flow',
    metric: 'coolant_flow',
    operator: '<',
    threshold: 5,
    durationSec: 60,
    enabled: true,
  },
  {
    id: 'r4',
    name: 'Power Spike',
    metric: 'power',
    operator: '>',
    threshold: 12000,
    durationSec: 120,
    enabled: false,
  },
];

const METRIC_LABELS: Record<string, string> = {
  gpu_temp: 'alertEngine.temp',
  gpu_util: 'alertEngine.util',
  power: 'alertEngine.power',
  coolant_flow: 'alertEngine.flow',
};

function getMetricValue(server: ServerTelemetry, metric: string): number {
  switch (metric) {
    case 'gpu_temp': return Math.max(...server.thermal.gpuCoreTemps);
    case 'gpu_util': {
      const u = server.compute.gpuUtilization;
      return u.reduce((a, b) => a + b, 0) / u.length;
    }
    case 'power': return server.power.chassisWattage;
    case 'coolant_flow': return server.thermal.liquidCoolingFlowRate;
    default: return 0;
  }
}

function checkCondition(value: number, op: string, threshold: number): boolean {
  switch (op) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    default: return false;
  }
}

interface AlertRuleEngineProps {
  rawBatch: ServerTelemetry[] | null;
}

export default function AlertRuleEngine({ rawBatch }: AlertRuleEngineProps) {
  const { t } = useTranslation();
  const [rules, setRules] = useState<AlertRule[]>(DEFAULT_RULES);
  const [expanded, setExpanded] = useState(false);
  const matchHistoryRef = useRef<Map<string, number>>(new Map());

  // Evaluate rules against current telemetry
  const matches = useMemo(() => {
    if (!rawBatch) return [];
    const results: AlertRuleMatch[] = [];
    const now = Date.now();

    for (const rule of rules) {
      if (!rule.enabled) continue;
      for (const server of rawBatch) {
        const val = getMetricValue(server, rule.metric);
        const primary = checkCondition(val, rule.operator, rule.threshold);

        let secondary = true;
        if (rule.combineWith) {
          const secVal = getMetricValue(server, rule.combineWith.metric);
          secondary = checkCondition(secVal, rule.combineWith.operator, rule.combineWith.threshold);
        }

        if (primary && secondary) {
          const key = `${rule.id}_${server.serverId}`;
          if (!matchHistoryRef.current.has(key)) {
            matchHistoryRef.current.set(key, now);
          }
          const elapsed = (now - matchHistoryRef.current.get(key)!) / 1000;
          if (elapsed >= rule.durationSec) {
            results.push({
              ruleId: rule.id,
              serverId: server.serverId,
              currentValue: val,
              triggeredAt: matchHistoryRef.current.get(key)!,
            });
          }
        } else {
          matchHistoryRef.current.delete(`${rule.id}_${server.serverId}`);
        }
      }
    }
    return results;
  }, [rawBatch, rules]);

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const addRule = () => {
    const newRule: AlertRule = {
      id: `r${Date.now()}`,
      name: 'New Rule',
      metric: 'gpu_temp',
      operator: '>',
      threshold: 80,
      durationSec: 60,
      enabled: true,
    };
    setRules(prev => [...prev, newRule]);
  };

  const removeRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <span className={styles.headerIcon}>🔔</span>
        <span className={styles.headerTitle}>{t('alertEngine.title')}</span>
        <span className={`${styles.matchBadge} ${matches.length > 0 ? styles.active : ''}`}>
          {matches.length} {t('alertEngine.triggered')}
        </span>
        <span className={styles.chevron}>{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.rulesList}>
            {rules.map(rule => {
              const ruleMatches = matches.filter(m => m.ruleId === rule.id);
              return (
                <div key={rule.id} className={`${styles.rule} ${!rule.enabled ? styles.disabled : ''}`}>
                  <div className={styles.ruleHeader}>
                    <button
                      className={`${styles.toggle} ${rule.enabled ? styles.toggleOn : ''}`}
                      onClick={() => toggleRule(rule.id)}
                    >
                      {rule.enabled ? '●' : '○'}
                    </button>
                    <span className={styles.ruleName}>{rule.name}</span>
                    {ruleMatches.length > 0 && (
                      <span className={styles.ruleTriggered}>
                        {ruleMatches.length} servers
                      </span>
                    )}
                    <button className={styles.removeBtn} onClick={() => removeRule(rule.id)}>✕</button>
                  </div>
                  <div className={styles.ruleCondition}>
                    <span className={styles.metricTag}>{t(METRIC_LABELS[rule.metric])}</span>
                    <span className={styles.operator}>{rule.operator}</span>
                    <span className={styles.threshold}>{rule.threshold}</span>
                    <span className={styles.duration}>for {rule.durationSec}s</span>
                    {rule.combineWith && (
                      <>
                        <span className={styles.andLabel}>AND</span>
                        <span className={styles.metricTag}>{t(METRIC_LABELS[rule.combineWith.metric])}</span>
                        <span className={styles.operator}>{rule.combineWith.operator}</span>
                        <span className={styles.threshold}>{rule.combineWith.threshold}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button className={styles.addBtn} onClick={addRule}>
            {t('alertEngine.addRule')}
          </button>
        </div>
      )}
    </div>
  );
}
