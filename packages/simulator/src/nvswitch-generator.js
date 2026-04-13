// NVSwitch Simulator — models NVIDIA NVSwitch 4th gen chip-level metrics
// Reference: GB200 NVL72 architecture — 9 trays, each tray has 2 NVSwitch chips
// Each NVSwitch has 64 NVLink 5.0 ports (100 GB/s bidirectional each)
// Total NVL72 bisection bandwidth: ~130 TB/s

const NUM_SWITCHES_PER_SERVER = 2;  // Simplified: 2 NVSwitch per server unit
const PORTS_PER_SWITCH = 64;
const PORT_BW_MAX = 100; // GB/s per port

const switchStates = new Map();

function getOrCreateSwitchState(serverId) {
  if (!switchStates.has(serverId)) {
    const switches = Array.from({ length: NUM_SWITCHES_PER_SERVER }, (_, sid) => ({
      id: sid,
      temperature: 55 + Math.random() * 10,        // NVSwitch die temp, typ 55-85°C
      voltage: 0.78 + Math.random() * 0.02,         // Core voltage ~0.78V
      power: 120 + Math.random() * 30,              // NVSwitch power ~120-180W
      fanRpm: 6000 + Math.random() * 2000,
      portStates: Array.from({ length: PORTS_PER_SWITCH }, () =>
        Math.random() < 0.98 ? 1 : Math.random() < 0.5 ? 2 : 0  // 98% active, 1% degraded, 1% down
      ),
      portTxBw: Array.from({ length: PORTS_PER_SWITCH }, () =>
        30 + Math.random() * 50  // typical load 30-80 GB/s
      ),
      portRxBw: Array.from({ length: PORTS_PER_SWITCH }, () =>
        30 + Math.random() * 50
      ),
      linkErrors: Array.from({ length: PORTS_PER_SWITCH }, () =>
        Math.random() < 0.05 ? Math.floor(Math.random() * 10) : 0
      ),
      fatalErrors: 0,
      nonFatalErrors: Math.floor(Math.random() * 3),
      throughputTx: 0,  // aggregate GB/s
      throughputRx: 0,
      latencyNs: 400 + Math.random() * 200,  // NVLink hop latency ~400-800ns
      // NVLink error counters
      crcErrors: Math.floor(Math.random() * 5),
      eccErrors: 0,
      replayErrors: Math.floor(Math.random() * 3),
      recoveryCount: 0,
    }));
    switchStates.set(serverId, switches);
  }
  return switchStates.get(serverId);
}

function smoothRandom(current, target, factor = 0.1) {
  return current + (target - current) * factor + (Math.random() - 0.5) * 2;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function generateNvSwitchData(serverId, isPanic) {
  const switches = getOrCreateSwitchState(serverId);

  for (const sw of switches) {
    // Temperature
    const tempTarget = isPanic ? 80 + Math.random() * 10 : 58 + Math.random() * 12;
    sw.temperature = clamp(smoothRandom(sw.temperature, tempTarget, 0.12), 40, 105);

    // Voltage fluctuation under load
    sw.voltage = clamp(smoothRandom(sw.voltage, isPanic ? 0.82 : 0.79, 0.05), 0.72, 0.88);

    // Power
    const powerTarget = isPanic ? 165 + Math.random() * 20 : 130 + Math.random() * 30;
    sw.power = clamp(smoothRandom(sw.power, powerTarget, 0.1), 90, 200);

    // Port bandwidth
    let totalTx = 0, totalRx = 0;
    for (let p = 0; p < PORTS_PER_SWITCH; p++) {
      if (sw.portStates[p] === 0) {
        sw.portTxBw[p] = 0;
        sw.portRxBw[p] = 0;
      } else {
        const bwTarget = isPanic ? 70 + Math.random() * 25 : 35 + Math.random() * 40;
        sw.portTxBw[p] = clamp(smoothRandom(sw.portTxBw[p], bwTarget, 0.1), 0, PORT_BW_MAX);
        sw.portRxBw[p] = clamp(smoothRandom(sw.portRxBw[p], bwTarget, 0.1), 0, PORT_BW_MAX);

        // Degraded ports have lower bandwidth
        if (sw.portStates[p] === 2) {
          sw.portTxBw[p] *= 0.5;
          sw.portRxBw[p] *= 0.5;
        }
      }
      totalTx += sw.portTxBw[p];
      totalRx += sw.portRxBw[p];

      // Link errors accumulate slowly
      if (Math.random() < (isPanic ? 0.005 : 0.001)) {
        sw.linkErrors[p] += 1;
      }

      // Port state changes (rare)
      if (Math.random() < 0.0005) {
        sw.portStates[p] = sw.portStates[p] === 1 ? 2 : 1; // toggle active/degraded
      }
    }

    sw.throughputTx = totalTx;
    sw.throughputRx = totalRx;

    // Latency
    sw.latencyNs = clamp(smoothRandom(sw.latencyNs, isPanic ? 700 : 500, 0.08), 300, 1500);

    // Error counters
    if (Math.random() < (isPanic ? 0.01 : 0.001)) sw.crcErrors += 1;
    if (Math.random() < 0.0001) sw.eccErrors += 1;
    if (Math.random() < (isPanic ? 0.005 : 0.0005)) sw.replayErrors += 1;
    if (Math.random() < 0.00005) {
      sw.fatalErrors += 1;
      sw.recoveryCount += 1;
    }
    if (Math.random() < (isPanic ? 0.003 : 0.0003)) sw.nonFatalErrors += 1;
  }

  return {
    serverId,
    switches: switches.map(sw => ({
      id: sw.id,
      temperature: round2(sw.temperature),
      voltage: round2(sw.voltage),
      power: round2(sw.power),
      // Aggregate port data (don't send all 64 ports every tick to save bandwidth)
      activePortCount: sw.portStates.filter(s => s === 1).length,
      degradedPortCount: sw.portStates.filter(s => s === 2).length,
      downPortCount: sw.portStates.filter(s => s === 0).length,
      totalPorts: PORTS_PER_SWITCH,
      throughputTxGBs: round2(sw.throughputTx),
      throughputRxGBs: round2(sw.throughputRx),
      avgLatencyNs: round2(sw.latencyNs),
      crcErrors: sw.crcErrors,
      eccErrors: sw.eccErrors,
      replayErrors: sw.replayErrors,
      fatalErrors: sw.fatalErrors,
      nonFatalErrors: sw.nonFatalErrors,
      recoveryCount: sw.recoveryCount,
      // Top 5 link errors for detail view
      topLinkErrors: sw.linkErrors
        .map((err, port) => ({ port, errors: err, state: sw.portStates[port] }))
        .filter(e => e.errors > 0)
        .sort((a, b) => b.errors - a.errors)
        .slice(0, 5),
    })),
    summary: {
      totalThroughputTB: round2(
        switches.reduce((s, sw) => s + sw.throughputTx + sw.throughputRx, 0) / 1000
      ),
      totalFatalErrors: switches.reduce((s, sw) => s + sw.fatalErrors, 0),
      degradedLinks: switches.reduce((s, sw) => s + sw.portStates.filter(p => p !== 1).length, 0),
      maxTemperature: round2(Math.max(...switches.map(sw => sw.temperature))),
      totalPower: round2(switches.reduce((s, sw) => s + sw.power, 0)),
    },
  };
}

// Detailed port-level data for drill-down (only requested on demand)
export function getNvSwitchPortDetail(serverId, switchId) {
  const switches = getOrCreateSwitchState(serverId);
  if (!switches || switchId >= switches.length) return null;

  const sw = switches[switchId];
  return {
    serverId,
    switchId,
    ports: Array.from({ length: PORTS_PER_SWITCH }, (_, p) => ({
      port: p,
      state: sw.portStates[p] === 1 ? 'active' : sw.portStates[p] === 2 ? 'degraded' : 'down',
      txBandwidthGBs: round2(sw.portTxBw[p]),
      rxBandwidthGBs: round2(sw.portRxBw[p]),
      linkErrors: sw.linkErrors[p],
    })),
  };
}
