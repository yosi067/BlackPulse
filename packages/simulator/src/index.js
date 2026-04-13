import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import { generateTelemetry, setPanicMode, resetAllPanic } from './data-generator.js';

const NUM_SERVERS = 100;
const TICK_INTERVAL = 1000; // 1 second

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
    Oem: {
      LiquidCooling: { FlowRateLPM: data.thermal.liquidCoolingFlowRate },
    },
  };
});

fastify.get('/redfish/v1/Systems/Self/Gpus', async (request) => {
  const serverId = parseInt(request.query.serverId) || 0;
  const data = generateTelemetry(serverId);
  return {
    '@odata.id': `/redfish/v1/Systems/Self/Gpus?serverId=${serverId}`,
    Members: data.compute.gpuUtilization.map((util, i) => ({
      MemberId: `GPU_${i}`,
      Utilization: util,
      HBM3eUsage: data.compute.hbm3eMemoryUsage[i],
      NVLinkBandwidth: data.compute.nvlinkBandwidth[i],
      Temperature: data.thermal.gpuCoreTemps[i],
    })),
  };
});

// ─── Control Endpoints ────────────────────────────────────────────────

fastify.post('/api/panic', async (request) => {
  const { serverIds } = request.body || {};
  const ids = serverIds || [
    Math.floor(Math.random() * NUM_SERVERS),
    Math.floor(Math.random() * NUM_SERVERS),
    Math.floor(Math.random() * NUM_SERVERS),
    Math.floor(Math.random() * NUM_SERVERS),
    Math.floor(Math.random() * NUM_SERVERS),
  ];
  const uniqueIds = [...new Set(ids)].slice(0, 10);
  for (const id of uniqueIds) {
    setPanicMode(id, true);
  }
  return { status: 'panic', affectedServers: uniqueIds };
});

fastify.post('/api/reset', async () => {
  resetAllPanic();
  return { status: 'reset' };
});

fastify.get('/api/servers', async () => ({
  count: NUM_SERVERS,
  servers: Array.from({ length: NUM_SERVERS }, (_, i) => ({
    id: i,
    name: `GB200-NVL72-${String(i).padStart(3, '0')}`,
    rack: Math.floor(i / 10),
    position: i % 10,
  })),
}));

// ─── WebSocket Telemetry Stream ───────────────────────────────────────

fastify.register(async function (fastify) {
  fastify.get('/ws/telemetry', { websocket: true }, (socket) => {
    fastify.log.info('WebSocket client connected');

    const interval = setInterval(() => {
      const batch = [];
      for (let i = 0; i < NUM_SERVERS; i++) {
        batch.push(generateTelemetry(i));
      }
      try {
        socket.send(JSON.stringify({ type: 'telemetry_batch', data: batch, timestamp: Date.now() }));
      } catch {
        clearInterval(interval);
      }
    }, TICK_INTERVAL);

    socket.on('close', () => {
      fastify.log.info('WebSocket client disconnected');
      clearInterval(interval);
    });

    socket.on('error', () => {
      clearInterval(interval);
    });
  });
});

// ─── Start Server ─────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || '3001');
try {
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`🚀 BMC Simulator running on port ${port} — ${NUM_SERVERS} servers`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
