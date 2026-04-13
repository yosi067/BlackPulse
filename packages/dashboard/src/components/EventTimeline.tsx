import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { SELEvent } from '../types';
import styles from './EventTimeline.module.css';

interface EventTimelineProps {
  events: SELEvent[];
  onResolve?: (eventId: string) => void;
}

const SEV_ICON: Record<string, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
};

const TYPE_ICON: Record<string, string> = {
  'Temperature Critical': '🌡️',
  'Temperature Threshold': '🌡️',
  'PSU Status Change': '⚡',
  'ECC Correctable Error': '💾',
  'ECC Uncorrectable Error': '💥',
  'NVLink State Change': '🔗',
  'NVSwitch Error': '🔀',
  'Coolant Flow Alert': '💧',
  'GPU Thermal Throttle': '🔥',
  'NVIDIA XID Error': '⚠️',
  'Auto-Remediation': '🔧',
};

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export default function EventTimeline({ events, onResolve }: EventTimelineProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [expanded, setExpanded] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter(e => e.severity === filter);
  }, [events, filter]);

  // Auto-scroll to top on new events
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [filtered.length, autoScroll]);

  const stats = useMemo(() => ({
    critical: events.filter(e => e.severity === 'critical').length,
    warning: events.filter(e => e.severity === 'warning').length,
    info: events.filter(e => e.severity === 'info').length,
  }), [events]);

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <span className={styles.icon}>📋</span>
        <span className={styles.title}>{t('events.title')}</span>
        <span className={styles.stats}>
          {stats.critical > 0 && <span className={styles.critBadge}>{stats.critical}</span>}
          {stats.warning > 0 && <span className={styles.warnBadge}>{stats.warning}</span>}
          <span className={styles.totalBadge}>{events.length}</span>
        </span>
        <span className={styles.chevron}>{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.filterBar}>
            {(['all', 'critical', 'warning', 'info'] as const).map(f => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? t('events.all') : `${SEV_ICON[f]} ${f}`}
              </button>
            ))}
            <label className={styles.autoScrollLabel}>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
              />
              {t('events.autoScroll')}
            </label>
          </div>
          <div className={styles.timeline} ref={listRef}>
            {filtered.length === 0 && (
              <div className={styles.empty}>{t('events.noEvents')}</div>
            )}
            {filtered.map(event => (
              <div
                key={event.id}
                className={`${styles.event} ${styles[event.severity]} ${event.resolved ? styles.resolved : ''}`}
              >
                <div className={styles.eventTime}>
                  <span className={styles.timeAgo}>{timeAgo(event.timestamp)}</span>
                  <span className={styles.timeStamp}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className={styles.eventDot}>
                  <span className={`${styles.dot} ${styles[event.severity + 'Dot']}`} />
                  <div className={styles.line} />
                </div>
                <div className={styles.eventContent}>
                  <div className={styles.eventHeader}>
                    <span className={styles.eventIcon}>
                      {TYPE_ICON[event.type] || SEV_ICON[event.severity]}
                    </span>
                    <span className={styles.eventType}>{event.type}</span>
                    <span className={styles.serverId}>S{String(event.serverId).padStart(3, '0')}</span>
                    {!event.resolved && event.severity !== 'info' && onResolve && (
                      <button
                        className={styles.resolveBtn}
                        onClick={() => onResolve(event.id)}
                      >
                        ✓
                      </button>
                    )}
                  </div>
                  <div className={styles.eventMessage}>{event.message}</div>
                  {event.resolved && (
                    <div className={styles.resolvedTag}>
                      ✓ Resolved {event.resolvedBy && `by ${event.resolvedBy}`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
