// Web Worker for processing telemetry data
// Uses Wasm when available, falls back to pure TS implementation
// Supports SharedArrayBuffer double-buffering for zero-copy transfer

import { processServerBatch, detectAnomalies, lttbDownsample } from '../wasm/processor-fallback';
import type { ServerTelemetry, TelemetryBatch } from '../types';
import {
  FLOATS_PER_SERVER,
  OFFSET_AVG_TEMP,
  OFFSET_MAX_TEMP,
  OFFSET_ANOMALY,
  OFFSET_GPU_TEMPS,
  OFFSET_GPU_UTILS,
  OFFSET_WATTAGE,
  OFFSET_PUE,
  OFFSET_FLOW_RATE,
} from './shared-buffer';

const NUM_GPUS = 72;
const SPARKLINE_HISTORY = 60; // 60 seconds of history
const SPARKLINE_DISPLAY = 30; // downsample to 30 points for display

// Ring buffers for sparkline history per server
const sparklineBuffers: Map<number, number[]> = new Map();

// SharedArrayBuffer references (set via init message)
let sharedControlView: Int32Array | null = null;
let sharedDataView0: Float32Array | null = null;
let sharedDataView1: Float32Array | null = null;

function getSparklineBuffer(serverId: number): number[] {
  if (!sparklineBuffers.has(serverId)) {
    sparklineBuffers.set(serverId, []);
  }
  return sparklineBuffers.get(serverId)!;
}

function getWriteBuffer(): Float32Array | null {
  if (!sharedControlView || !sharedDataView0 || !sharedDataView1) return null;
  const active = Atomics.load(sharedControlView, 0);
  return active === 0 ? sharedDataView1 : sharedDataView0;
}

function swapBuffers(): void {
  if (!sharedControlView) return;
  const current = Atomics.load(sharedControlView, 0);
  Atomics.store(sharedControlView, 0, current === 0 ? 1 : 0);
  Atomics.notify(sharedControlView, 0);
}

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  // Initialize SharedArrayBuffer references
  if (type === 'init_shared_buffers') {
    try {
      sharedControlView = new Int32Array(payload.controlSAB);
      sharedDataView0 = new Float32Array(payload.dataSAB0);
      sharedDataView1 = new Float32Array(payload.dataSAB1);
      (self as any).postMessage({ type: 'shared_buffers_ready' });
    } catch (e) {
      console.warn('Worker: Failed to init SharedArrayBuffer', e);
    }
    return;
  }

  if (type === 'telemetry_batch') {
    const batch: ServerTelemetry[] = payload;
    const numServers = batch.length;

    // 1. Flatten all GPU temps into a single array for batch processing
    const allTemps = new Float32Array(numServers * NUM_GPUS);
    for (let s = 0; s < numServers; s++) {
      const temps = batch[s].thermal.gpuCoreTemps;
      for (let g = 0; g < NUM_GPUS; g++) {
        allTemps[s * NUM_GPUS + g] = temps[g] ?? 0;
      }
    }

    // 2. Process server summaries [avgTemp, maxTemp, anomalyScore] per server
    const summaries = processServerBatch(allTemps, numServers, NUM_GPUS);

    // 3. Update sparkline buffers and downsample
    const sparklines: Float32Array[] = [];
    for (let s = 0; s < numServers; s++) {
      const avgTemp = summaries[s * 3];
      const buffer = getSparklineBuffer(s);
      buffer.push(avgTemp);
      if (buffer.length > SPARKLINE_HISTORY) {
        buffer.shift();
      }
      // LTTB downsample for display
      const downsampled = buffer.length > SPARKLINE_DISPLAY
        ? lttbDownsample(buffer, SPARKLINE_DISPLAY)
        : buffer;
      sparklines.push(new Float32Array(downsampled));
    }

    // 4. Anomaly detection on average temps
    const avgTemps = Array.from({ length: numServers }, (_, i) => summaries[i * 3]);
    const anomalyScores = detectAnomalies(avgTemps, 5, 2.0);

    // 5. Build aggregation stats
    let totalWattage = 0;
    let totalPue = 0;
    let alertCount = 0;
    for (let s = 0; s < numServers; s++) {
      totalWattage += batch[s].power.chassisWattage;
      totalPue += batch[s].power.pue;
      if (summaries[s * 3 + 2] > 0.5) alertCount++;
    }

    // 6. Write to SharedArrayBuffer if available (zero-copy path)
    const writeBuf = getWriteBuffer();
    if (writeBuf) {
      for (let s = 0; s < numServers; s++) {
        const base = s * FLOATS_PER_SERVER;
        writeBuf[base + OFFSET_AVG_TEMP] = summaries[s * 3];
        writeBuf[base + OFFSET_MAX_TEMP] = summaries[s * 3 + 1];
        writeBuf[base + OFFSET_ANOMALY] = summaries[s * 3 + 2];

        // GPU temps and utils
        for (let g = 0; g < NUM_GPUS; g++) {
          writeBuf[base + OFFSET_GPU_TEMPS + g] = batch[s].thermal.gpuCoreTemps[g] ?? 0;
          writeBuf[base + OFFSET_GPU_UTILS + g] = batch[s].compute.gpuUtilization[g] ?? 0;
        }

        writeBuf[base + OFFSET_WATTAGE] = batch[s].power.chassisWattage;
        writeBuf[base + OFFSET_PUE] = batch[s].power.pue;
        writeBuf[base + OFFSET_FLOW_RATE] = batch[s].thermal.liquidCoolingFlowRate;
      }
      swapBuffers();
    }

    // 7. Post processed data back to main thread
    const result = {
      type: 'processed_batch',
      summaries, // Float32Array: [avg, max, anomaly] x numServers
      sparklines, // Float32Array[] per server
      anomalyScores, // number[] per server
      aggregation: {
        totalServers: numServers,
        avgPue: Math.round((totalPue / numServers) * 100) / 100,
        totalWattageKW: Math.round(totalWattage / 100) / 10,
        alertCount,
      },
      // Forward the raw batch for detailed views
      rawBatch: batch,
    };

    (self as unknown as Worker).postMessage(result);
  }
};
