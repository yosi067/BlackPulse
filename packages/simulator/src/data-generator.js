// BMC Simulator - Blackwell GB200 NVL72 Telemetry Data Generator
const NUM_GPUS = 72;
const NUM_PSUS = 6;

// State tracking for smooth transitions
const serverStates = new Map();

function getOrCreateState(serverId) {
  if (!serverStates.has(serverId)) {
    const gpuTemps = Array.from({ length: NUM_GPUS }, () => 45 + Math.random() * 15);
    serverStates.set(serverId, {
      gpuTemps,
      gpuUtils: Array.from({ length: NUM_GPUS }, () => 30 + Math.random() * 40),
      hbmUsage: Array.from({ length: NUM_GPUS }, () => 20 + Math.random() * 30),
      nvlinkBw: Array.from({ length: NUM_GPUS }, () => 40 + Math.random() * 30),
      inletTemp: 22 + Math.random() * 3,
      outletTemp: 35 + Math.random() * 5,
      flowRate: 8 + Math.random() * 4,
      chassisWattage: 8000 + Math.random() * 2000,
      psuEfficiency: Array.from({ length: NUM_PSUS }, () => 92 + Math.random() * 6),
      panicMode: false,
    });
  }
  return serverStates.get(serverId);
}

function smoothRandom(current, target, factor = 0.1) {
  return current + (target - current) * factor + (Math.random() - 0.5) * 2;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function generateTelemetry(serverId) {
  const state = getOrCreateState(serverId);
  const isPanic = state.panicMode;

  // Update GPU temperatures with smooth transitions
  for (let i = 0; i < NUM_GPUS; i++) {
    const baseTarget = isPanic ? 90 + Math.random() * 15 : 50 + Math.random() * 20;
    state.gpuTemps[i] = clamp(smoothRandom(state.gpuTemps[i], baseTarget, 0.15), 30, 105);
    state.gpuUtils[i] = clamp(smoothRandom(state.gpuUtils[i], isPanic ? 95 : 40 + Math.random() * 40, 0.1), 0, 100);
    state.hbmUsage[i] = clamp(smoothRandom(state.hbmUsage[i], isPanic ? 85 : 30 + Math.random() * 40, 0.08), 0, 100);
    state.nvlinkBw[i] = clamp(smoothRandom(state.nvlinkBw[i], isPanic ? 90 : 40 + Math.random() * 35, 0.1), 0, 100);
  }

  const avgGpuTemp = state.gpuTemps.reduce((a, b) => a + b, 0) / NUM_GPUS;
  state.inletTemp = clamp(smoothRandom(state.inletTemp, isPanic ? 28 : 22 + Math.random() * 3, 0.1), 18, 35);
  state.outletTemp = clamp(smoothRandom(state.outletTemp, avgGpuTemp * 0.6 + 10, 0.1), 25, 65);
  state.flowRate = clamp(smoothRandom(state.flowRate, isPanic ? 14 : 9 + Math.random() * 3, 0.08), 5, 18);
  state.chassisWattage = clamp(smoothRandom(state.chassisWattage, isPanic ? 12000 : 8500 + Math.random() * 2000, 0.1), 5000, 15000);

  for (let i = 0; i < NUM_PSUS; i++) {
    state.psuEfficiency[i] = clamp(smoothRandom(state.psuEfficiency[i], isPanic ? 88 : 94 + Math.random() * 4, 0.05), 80, 99);
  }

  const avgPsuEff = state.psuEfficiency.reduce((a, b) => a + b, 0) / NUM_PSUS;
  const pue = clamp(1.0 + (1.0 - avgPsuEff / 100) * 2 + (isPanic ? 0.3 : 0), 1.0, 2.5);

  return {
    serverId,
    timestamp: Date.now(),
    thermal: {
      inletTemp: round2(state.inletTemp),
      outletTemp: round2(state.outletTemp),
      gpuCoreTemps: state.gpuTemps.map(round2),
      liquidCoolingFlowRate: round2(state.flowRate),
    },
    power: {
      chassisWattage: round2(state.chassisWattage),
      pue: round2(pue),
      psuEfficiency: state.psuEfficiency.map(round2),
    },
    compute: {
      gpuUtilization: state.gpuUtils.map(round2),
      hbm3eMemoryUsage: state.hbmUsage.map(round2),
      nvlinkBandwidth: state.nvlinkBw.map(round2),
    },
  };
}

export function setPanicMode(serverId, panic) {
  const state = getOrCreateState(serverId);
  state.panicMode = panic;
}

export function resetAllPanic() {
  for (const state of serverStates.values()) {
    state.panicMode = false;
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
