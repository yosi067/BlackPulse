// Webhook Notification Manager — sends alerts to configured endpoints
// Supports: Generic webhook, PagerDuty, Slack, Teams (simulated)

const webhookConfigs = new Map();
const webhookHistory = [];
const MAX_HISTORY = 200;

// Default webhook configurations (simulated endpoints)
const DEFAULT_CONFIGS = [
  {
    id: 'wh_pagerduty',
    name: 'PagerDuty',
    type: 'pagerduty',
    url: 'https://events.pagerduty.com/v2/enqueue',
    routingKey: 'SIMULATED_ROUTING_KEY',
    enabled: false, // disabled by default in demo
    severityMap: { critical: 'critical', warning: 'warning', info: 'info' },
    rateLimitMs: 60000, // 1 call/min per unique alert
    lastSent: new Map(),
  },
  {
    id: 'wh_slack',
    name: 'Slack #ops-alerts',
    type: 'slack',
    url: 'https://hooks.slack.com/services/SIMULATED/WEBHOOK/URL',
    channel: '#ops-alerts',
    enabled: false,
    rateLimitMs: 30000,
    lastSent: new Map(),
  },
  {
    id: 'wh_generic',
    name: 'Generic Webhook',
    type: 'webhook',
    url: 'http://localhost:9999/webhook',
    headers: { 'Content-Type': 'application/json' },
    enabled: false,
    rateLimitMs: 10000,
    lastSent: new Map(),
  },
];

// Initialize default configs
for (const cfg of DEFAULT_CONFIGS) {
  webhookConfigs.set(cfg.id, cfg);
}

function formatPagerDutyPayload(event, config) {
  return {
    routing_key: config.routingKey,
    event_action: event.severity === 'critical' ? 'trigger' : 'trigger',
    dedup_key: `omnicenter-${event.serverId}-${event.type}`,
    payload: {
      summary: `[Server ${event.serverId}] ${event.message}`,
      severity: config.severityMap[event.severity] || 'warning',
      source: `GB200-NVL72-${String(event.serverId).padStart(3, '0')}`,
      component: event.type,
      group: `rack-${Math.floor(event.serverId / 10)}`,
      class: 'bmc_alert',
      timestamp: new Date(event.timestamp).toISOString(),
      custom_details: event.details,
    },
  };
}

function formatSlackPayload(event, config) {
  const color = event.severity === 'critical' ? '#f85149' : event.severity === 'warning' ? '#f0c040' : '#76d276';
  return {
    channel: config.channel,
    attachments: [{
      color,
      title: `${event.severity.toUpperCase()}: ${event.type}`,
      text: event.message,
      fields: [
        { title: 'Server', value: `GB200-NVL72-${String(event.serverId).padStart(3, '0')}`, short: true },
        { title: 'Rack', value: `Rack ${Math.floor(event.serverId / 10)}`, short: true },
      ],
      ts: Math.floor(event.timestamp / 1000),
    }],
  };
}

function formatGenericPayload(event) {
  return {
    source: 'omnicenter-ai',
    version: '2.0',
    event: {
      id: event.id,
      type: event.type,
      severity: event.severity,
      message: event.message,
      serverId: event.serverId,
      serverName: `GB200-NVL72-${String(event.serverId).padStart(3, '0')}`,
      rack: Math.floor(event.serverId / 10),
      timestamp: new Date(event.timestamp).toISOString(),
      details: event.details,
    },
  };
}

/**
 * Dispatch an event to all enabled webhooks.
 * Returns array of dispatch results. In demo mode, doesn't actually POST.
 */
export function dispatchWebhooks(event, dryRun = true) {
  const results = [];

  for (const [id, config] of webhookConfigs) {
    if (!config.enabled) continue;

    // Rate limiting
    const dedupKey = `${event.serverId}_${event.type}`;
    const lastSentTime = config.lastSent.get(dedupKey) || 0;
    if (Date.now() - lastSentTime < config.rateLimitMs) {
      results.push({ webhookId: id, status: 'rate_limited', dedupKey });
      continue;
    }

    let payload;
    switch (config.type) {
      case 'pagerduty': payload = formatPagerDutyPayload(event, config); break;
      case 'slack': payload = formatSlackPayload(event, config); break;
      default: payload = formatGenericPayload(event); break;
    }

    // In demo mode, log but don't actually send
    const result = {
      webhookId: id,
      name: config.name,
      type: config.type,
      url: config.url,
      status: dryRun ? 'simulated' : 'sent',
      payload,
      timestamp: Date.now(),
      eventId: event.id,
    };

    config.lastSent.set(dedupKey, Date.now());
    results.push(result);

    // Store in history
    webhookHistory.push(result);
    if (webhookHistory.length > MAX_HISTORY) {
      webhookHistory.splice(0, webhookHistory.length - MAX_HISTORY);
    }
  }

  return results;
}

export function getWebhookConfigs() {
  return Array.from(webhookConfigs.values()).map(({ lastSent, ...rest }) => rest);
}

export function updateWebhookConfig(id, updates) {
  const config = webhookConfigs.get(id);
  if (!config) return null;
  Object.assign(config, updates);
  return { ...config, lastSent: undefined };
}

export function addWebhookConfig(config) {
  const id = `wh_${Date.now()}`;
  webhookConfigs.set(id, { ...config, id, lastSent: new Map(), enabled: true });
  return { id };
}

export function deleteWebhookConfig(id) {
  return webhookConfigs.delete(id);
}

export function getWebhookHistory(limit = 50) {
  return webhookHistory.slice(-limit).reverse();
}
