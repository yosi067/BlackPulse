import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { WebhookConfig, Playbook, RemediationExecution } from '../types';
import styles from './WebhookSettings.module.css';

export default function WebhookSettings() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'webhooks' | 'playbooks' | 'history'>('webhooks');
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [history, setHistory] = useState<RemediationExecution[]>([]);
  const [stats, setStats] = useState<{ totalExecutions: number; successRate: number } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [wh, pb, hist, st] = await Promise.all([
        fetch('/api/webhooks').then(r => r.json()),
        fetch('/api/remediation/playbooks').then(r => r.json()),
        fetch('/api/remediation/history?limit=20').then(r => r.json()),
        fetch('/api/remediation/stats').then(r => r.json()),
      ]);
      setWebhooks(wh); setPlaybooks(pb); setHistory(hist); setStats(st);
    } catch { /* API not available */ }
  }, []);

  useEffect(() => {
    if (expanded) fetchData();
  }, [expanded, fetchData]);

  // Auto-refresh history
  useEffect(() => {
    if (!expanded) return;
    const iv = setInterval(fetchData, 5000);
    return () => clearInterval(iv);
  }, [expanded, fetchData]);

  const toggleWebhook = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/webhooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      fetchData();
    } catch { /* ignore */ }
  };

  const togglePlaybook = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/remediation/playbooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      fetchData();
    } catch { /* ignore */ }
  };

  const testWebhook = async () => {
    try {
      const res = await fetch('/api/webhooks/test', { method: 'POST' });
      const data = await res.json();
      alert(`Webhook test: ${JSON.stringify(data.map((r: any) => r.status))}`);
    } catch { /* ignore */ }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <span className={styles.icon}>🔧</span>
        <span className={styles.title}>{t('webhook.title')}</span>
        {stats && stats.totalExecutions > 0 && (
          <span className={styles.statBadge}>
            {stats.totalExecutions} runs · {(stats.successRate * 100).toFixed(0)}%
          </span>
        )}
        <span className={styles.chevron}>{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.tabs}>
            {(['webhooks', 'playbooks', 'history'] as const).map(t => (
              <button
                key={t}
                className={`${styles.tabBtn} ${tab === t ? styles.activeTab : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'webhooks' ? '🔗 Webhooks' : t === 'playbooks' ? '📋 Playbooks' : '📜 History'}
              </button>
            ))}
          </div>

          {/* Webhooks tab */}
          {tab === 'webhooks' && (
            <div className={styles.list}>
              {webhooks.map(wh => (
                <div key={wh.id} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <button
                      className={`${styles.toggle} ${wh.enabled ? styles.on : ''}`}
                      onClick={() => toggleWebhook(wh.id, !wh.enabled)}
                    >
                      {wh.enabled ? '●' : '○'}
                    </button>
                    <span className={styles.itemName}>{wh.name}</span>
                    <span className={styles.typeBadge}>{wh.type}</span>
                  </div>
                  <div className={styles.itemUrl}>{wh.url}</div>
                  <div className={styles.itemMeta}>
                    Rate limit: {wh.rateLimitMs / 1000}s
                  </div>
                </div>
              ))}
              <button className={styles.actionBtn} onClick={testWebhook}>
                🧪 {t('webhook.test')}
              </button>
            </div>
          )}

          {/* Playbooks tab */}
          {tab === 'playbooks' && (
            <div className={styles.list}>
              {playbooks.map(pb => (
                <div key={pb.id} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <button
                      className={`${styles.toggle} ${pb.enabled ? styles.on : ''}`}
                      onClick={() => togglePlaybook(pb.id, !pb.enabled)}
                    >
                      {pb.enabled ? '●' : '○'}
                    </button>
                    <span className={styles.itemName}>{pb.name}</span>
                    <span className={styles.successRate}>
                      {(pb.successRate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className={styles.triggerInfo}>
                    Trigger: {pb.trigger.eventType} ({pb.trigger.minSeverity}+)
                  </div>
                  <div className={styles.steps}>
                    {pb.steps.map((step, i) => (
                      <span key={i} className={styles.step}>
                        {i + 1}. {step.description}
                      </span>
                    ))}
                  </div>
                  <div className={styles.itemMeta}>
                    Cooldown: {pb.cooldownMs / 1000}s · {pb.steps.length} steps ·{' '}
                    {pb.steps.reduce((s, st) => s + st.durationMs, 0) / 1000}s total
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* History tab */}
          {tab === 'history' && (
            <div className={styles.list}>
              {history.length === 0 && (
                <div className={styles.empty}>{t('webhook.noHistory')}</div>
              )}
              {history.map(exec => (
                <div key={exec.id} className={`${styles.historyItem} ${exec.status === 'success' ? styles.success : styles.failure}`}>
                  <div className={styles.historyHeader}>
                    <span className={styles.historyStatus}>
                      {exec.status === 'success' ? '✅' : '⚠️'}
                    </span>
                    <span className={styles.historyName}>{exec.playbookName}</span>
                    <span className={styles.historyServer}>
                      S{String(exec.serverId).padStart(3, '0')}
                    </span>
                    <span className={styles.historyTime}>
                      {new Date(exec.startedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className={styles.historySteps}>
                    {exec.steps.map((step, i) => (
                      <span
                        key={i}
                        className={`${styles.historyStep} ${step.status === 'completed' ? styles.stepOk : styles.stepFail}`}
                      >
                        {step.status === 'completed' ? '✓' : '✕'} {step.description}
                      </span>
                    ))}
                  </div>
                  <div className={styles.historyDuration}>
                    Duration: {(exec.durationMs / 1000).toFixed(1)}s
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
