// Static data source for GitHub Pages deployment
// Generates simulated telemetry data when no backend is available

import type { ServerTelemetry, TelemetryBatch } from '../types';

const NUM_SERVERS = 100;
const NUM_GPUS = 72;

class SimulationState {
  gpuTemps: Float32Array[] = [];
  gpuUtils: Float32Array[] = [];
  panicServers = new Set<number>();

  constructor() {
    for (let i = 0; i < NUM_SERVERS; i++) {
      this.gpuTemps.push(new Float32Array(NUM_GPUS).map(() => 45 + Math.random() * 20));
      this.gpuUtils.push(new Float32Array(NUM_GPUS).map(() => 30 + Math.random() * 40));
    }
  }

  tick(): ServerTelemetry[] {
    const batch: ServerTelemetry[] = [];
    for (let s = 0; s < NUM_SERVERS; s++) {
      const isPanic = this.panicServers.has(s);
      const temps = this.gpuTemps[s];
      const utils = this.gpuUtils[s];

      for (let g = 0; g < NUM_GPUS; g++) {
        const tTarget = isPanic ? 92 + Math.random() * 12 : 50 + Math.random() * 20;
        temps[g] += (tTarget - temps[g]) * 0.15 + (Math.random() - 0.5) * 2;
        temps[g] = Math.max(30, Math.min(105, temps[g]));

        const uTarget = isPanic ? 95 : 40 + Math.random() * 40;
        utils[g] += (uTarget - utils[g]) * 0.1 + (Math.random() - 0.5) * 3;
        utils[g] = Math.max(0, Math.min(100, utils[g]));
      }

      const avgTemp = temps.reduce((a, b) => a + b, 0) / NUM_GPUS;
      const r2 = (n: number) => Math.round(n * 100) / 100;

      batch.push({
        serverId: s,
        timestamp: Date.now(),
        thermal: {
          inletTemp: r2(22 + Math.random() * 3 + (isPanic ? 5 : 0)),
          outletTemp: r2(avgTemp * 0.6 + 10),
          gpuCoreTemps: Array.from(temps).map(r2),
          liquidCoolingFlowRate: r2(8 + Math.random() * 4 + (isPanic ? 4 : 0)),
        },
        power: {
          chassisWattage: r2(8000 + Math.random() * 2000 + (isPanic ? 3000 : 0)),
          pue: r2(1.1 + Math.random() * 0.2 + (isPanic ? 0.3 : 0)),
          psuEfficiency: Array.from({ length: 6 }, () => r2(92 + Math.random() * 6)),
        },
        compute: {
          gpuUtilization: Array.from(utils).map(r2),
          hbm3eMemoryUsage: Array.from({ length: NUM_GPUS }, () => r2(25 + Math.random() * 40)),
          nvlinkBandwidth: Array.from({ length: NUM_GPUS }, () => r2(40 + Math.random() * 35 + (isPanic ? 25 : 0))),
        },
      });
    }
    return batch;
  }

  setPanic(ids: number[]) {
    ids.forEach(id => this.panicServers.add(id));
  }

  resetPanic() {
    this.panicServers.clear();
  }
}

export class StaticDataSource {
  private state = new SimulationState();
  private listeners = new Set<(batch: TelemetryBatch) => void>();
  private interval: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      const data = this.state.tick();
      const batch: TelemetryBatch = {
        type: 'telemetry_batch',
        data,
        timestamp: Date.now(),
      };
      this.listeners.forEach(fn => fn(batch));
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  subscribe(fn: (batch: TelemetryBatch) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  panic(ids?: number[]) {
    const targets = ids || Array.from({ length: 5 }, () => Math.floor(Math.random() * NUM_SERVERS));
    this.state.setPanic([...new Set(targets)]);
    return targets;
  }

  reset() {
    this.state.resetPanic();
  }
}

export function isStaticMode(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('github.io') ||
      window.location.protocol === 'file:' ||
      new URLSearchParams(window.location.search).has('static'))
  );
}
