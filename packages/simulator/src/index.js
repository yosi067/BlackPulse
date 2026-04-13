import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import { generateTelemetry, setPanicMode, resetAllPanic } from './data-generator.js';
import { generateEccData, resetEccCounters } from './gpu-ecc-generator.js';
import { generateNvSwitchData, getNvSwitchPortDetail } from './nvswitch-generator.js';
import { generateEvents, getEvents, getEventStats, resolveEvent, addRemediationEvent } from './event-generator.js';
import { writeTelemetryBatch, query as tsQuery, getStats as tsStats, getMeasurements } from './influxdb-buffer.js';
import { dispatchWebhooks, getWebhookConfigs, updateWebhookConfig, addWebhookConfig, deleteWebhookConfig, getWebhookHistory } from './webhook-manager.js';
import { evaluateAndExecute, getPlaybooks, updatePlaybook, getExecutionHistory, getRemediationStats } from './remediation-engine.js';

const NUM_SERVERS = 100;
const TICK_INTERVAL = 1000;

const fastify = Fastify({ logger: true });

await fastify.register(fastifyCors, { origin: '*' });
await fastify.register(fastifyWebsocket);

// ─── Redfish API Endpoints ────────────────────────────────────────────

fastify.get('/redfish/v1', async () => ({
  '@odata.id': '/redfish/v1',
  '@odata.type': '#ServiceRoot.v1_15_0.ServiceRoot',
  Name: 'OmniCenter BMC Simulator',
  RedfishVersion: '1.15.0',
  UUID: 'omnicenter-bmc-sim-001',
}));

fastify.get('/redfish/v1/Chassis/GB200_NVL72/Thermal', async (request) => {
  const serverId = parseInt(request.query.serverId) || 0;
  const data = generateTelemetry(serverId);
  return {
    '@odata.id': `/redfish/v1/Chassis/GB200_NVL72/Thermal?serverId=${serverId}`,
    '@odata.type': '#Thermal.v1_7_1.Thermal',
    Name: `GB200 NVL72 Thermal - Server ${serverId}`,
    Temperatures: [
      { MemberId: 'Inlet', ReadingCelsius: data.thermal.inletTemp, Status: { State: 'Enabled' } },
      { MemberId: 'Outlet', ReadingCelsius: data.thermal.outletTemp, Status: { State: 'Enabled' } },
      ...data.thermal.gpuCoreTemps.map((t, i) => ({
        MemberId: `GPU_${i}`,
        ReadingCelsius: t,
        Status: { State: 'Enabled', Health: t > 85 ? 'Critical' : t > 75 ? 'Warning' : 'OK' },
      })),
    ],
    Oem: { LiquidCooling: { FlowRateLPM: data.thermal.liquidCoolingFlowRate } },
  };
});

fastify.get('/redfish/v1/Systems/Self/Gpus', async (request) => {
  const serverId = parseInt(request.query.serverId) || 0;
  const data = generateTelemetry(serverId);
  return {
    '@odata.id': `/redfish/v1/Systems/Self/Gpus?serverId=${serverId}`,
    Members: data.compute.gpuUtilization.map((util, i) => ({
      MemberId: `GPU_${i}`, Utilization: util,
      HBM3eUsage: data.compute.hbm3eMemoryUsage[i],
      NVLinkBandwidth: data.compute.nvlinkBandwidth[i],
      Temperature: data.thermal.gpuCoreTemps[i],
    })),
  };
});

// ─── Control Endpoints ────────────────────────────────────────────────

fastify.post('/api/panic', async (request) => {
  const { serverIds } = request.body || {};
  const ids = serverIds || Array.from({ length: 5 }, () => Math.floor(Math.random() * NUM_SERVERS));
  const uniqueIds = [...new Set(ids)].slice(0, 10);
  for (const id of uniqueIds) setPanicMode(id, true);
  return { status: 'panic', affectedServers: uniqueIds };
});

fastify.post('/api/reset', async () => { resetAllPanic(); return { status: 'reset' }; });

fastify.get('/api/servers', async () => ({
  count: NUM_SERVERS,
  servers: Array.from({ length: NUM_SERVERS }, (_, i) => ({
    id: i, name: `GB200-NVL72-${String(i).padStart(3, '0')}`,
    rack: Math.floor(i / 10), position: i % 10,
  })),
}));

// ─── GPU ECC Endpoints ────────────────────────────────────────────────

fastify.get('/api/ecc/:serverId', async (request) => {
  const sid = parseInt(request.params.serverId) || 0;
  const t = generateTelemetry(sid);
  return generateEccData(sid, t.thermal.gpuCoreTemps.some(v => v > 90));
});

fastify.get('/api/ecc', async () => {
  return Array.from({ length: NUM_SERVERS }, (_, i) => {
    const t = generateTelemetry(i);
    return generateEccData(i, t.thermal.gpuCoreTemps.some(v => v > 90));
  });
});

fastify.post('/api/ecc/:serverId/reset', async (request) => {
  resetEccCounters(parseInt(request.params.serverId) || 0);
  return { status: 'reset' };
});

// ─── NVSwitch Endpoints ───────────────────────────────────────────────

fastify.get('/api/nvswitch/:serverId', async (request) => {
  const sid = parseInt(request.params.serverId) || 0;
  const t = generateTelemetry(sid);
  return generateNvSwitchData(sid, t.thermal.gpuCoreTemps.some(v => v > 90));
});

fastify.get('/api/nvswitch/:serverId/:switchId/ports', async (request) => {
  return getNvSwitchPortDetail(
    parseInt(request.params.serverId) || 0,
    parseInt(request.params.switchId) || 0
  ) || { error: 'not found' };
});

// ─── Event Log (SEL) Endpoints ────────────────────────────────────────

fastify.get('/api/events', async (request) => {
  const { serverId, severity, type, limit, since, unresolved } = request.query;
  return getEvents({
    serverId: serverId !== undefined ? parseInt(serverId) : undefined,
    severity, type,
    limit: parseInt(limit) || 100,
    since: since ? parseInt(since) : undefined,
    unresolved: unresolved === 'true',
  });
});

fastify.get('/api/events/stats', async () => getEventStats());
fastify.post('/api/events/:eventId/resolve', async (request) => resolveEvent(request.params.eventId) || { error: 'not found' });

// ─── InfluxDB-Compatible Endpoints ────────────────────────────────────

fastify.post('/api/influx/query', async (request) => tsQuery(request.body));
fastify.get('/api/influx/stats', async () => tsStats());
fastify.get('/api/influx/measurements', async () => getMeasurements());

// ─── Webhook Endpoints ────────────────────────────────────────────────

fastify.get('/api/webhooks', async () => getWebhookConfigs());
fastify.put('/api/webhooks/:id', async (request) => updateWebhookConfig(request.params.id, request.body) || { error: 'not found' });
fastify.post('/api/webhooks', async (request) => addWebhookConfig(request.body));
fastify.delete('/api/webhooks/:id', async (request) => ({ deleted: deleteWebhookConfig(request.params.id) }));
fastify.get('/api/webhooks/history', async (request) => getWebhookHistory(parseInt(request.query.limit) || 50));
fastify.post('/api/webhooks/test', async () => {
  const testEvent = { id: 'TEST-001', type: 'Test Event', severity: 'warning', message: 'Test webhook notification', serverId: 0, timestamp: Date.now(), details: { test: true } };
  return dispatchWebhooks(testEvent, true);
});

// ─── Remediation Endpoints ────────────────────────────────────────────

fastify.get('/api/remediation/playbooks', async () => getPlaybooks());
fastify.put('/api/remediation/playbooks/:id', async (request) => updatePlaybook(request.params.id, request.body) || { error: 'not found' });
fastify.get('/api/remediation/history', async (request) => getExecutionHistory(parseInt(request.query.limit) || 50));
fastify.get('/api/remediation/stats', async () => getRemediationStats());

// ─── WebSocket Telemetry Stream ───────────────────────────────────────

fastify.register(async function (fastify) {
  fastify.get('/ws/telemetry', { websocket: true }, (socket) => {
    fastify.log.info('WebSocket client connected');

    const interval = setInterval(() => {
      const batch = [], eccBatch = [], nvswitchBatch = [];

      for (let i = 0; i < NUM_SERVERS; i++) {
        const telemetry = generateTelemetry(i);
        const isPanic = telemetry.thermal.gpuCoreTemps.some(t => t > 90);
        batch.push(telemetry);
        eccBatch.push(generateEccData(i, isPanic));
        nvswitchBatch.push(generateNvSwitchData(i, isPanic));
      }

      // Write to InfluxDB buffer
      writeTelemetryBatch(batch);

      // Generate events
      const newEvents = generateEvents(batch, eccBatch, nvswitchBatch);

      // Auto-remediation
      for (const event of newEvents) {
        if (event.severity === 'critical' || event.severity === 'warning') {
          const executions = evaluateAndExecute(event);
          for (const exec of executions) {
            if (exec.status !== 'cooldown') {
              addRemediationEvent(event.serverId, exec.playbookName, exec.status);
            }
          }
          if (event.severity === 'critical') dispatchWebhooks(event, true);
        }
      }

      try {
        // Core telemetry (backward compatible)
        socket.send(JSON.stringify({ type: 'telemetry_batch', data: batch, timestamp: Date.now() }));

        // Extended streams
        if (newEvents.length > 0) {
          socket.send(JSON.stringify({ type: 'events', data: newEvents.slice(-20), timestamp: Date.now() }));
        }
        socket.send(JSON.stringify({
          type: 'ecc_summary',
          data: eccBatch.map(e => ({ serverId: e.serverId, summary: e.summary })),
          timestamp: Date.now(),
        }));
        socket.send(JSON.stringify({
          type: 'nvswitch_summary',
          data: nvswitchBatch.map(n => ({ serverId: n.serverId, summary: n.summary, switches: n.switches })),
          timestamp: Date.now(),
        }));
      } catch { clearInterval(interval); }
    }, TICK_INTERVAL);

    socket.on('close', () => { fastify.log.info('WebSocket client disconnected'); clearInterval(interval); });
    socket.on('error', () => { clearInterval(interval); });
  });
});

// ─── Start ─────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || '3001');
try {
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`🚀 BMC Simulator v2.0 — ${NUM_SERVERS} servers on port ${port}`);
} catch (err) { fastify.log.error(err); process.exit(1); }
