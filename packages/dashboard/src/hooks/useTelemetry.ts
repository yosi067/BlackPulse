import { useEffect, useRef, useState, useCallback } from 'react';
import { getDataSource } from '../data/DataSource';
import type { ServerTelemetry, TelemetryBatch } from '../types';
import { createSharedBuffers, type SharedBuffers } from '../workers/shared-buffer';

export interface ProcessedData {
  summaries: Float32Array;       // [avg, max, anomaly] x numServers
  sparklines: Float32Array[];    // per server
  anomalyScores: number[];
  aggregation: {
    totalServers: number;
    avgPue: number;
    totalWattageKW: number;
    alertCount: number;
  };
  rawBatch: ServerTelemetry[];
}

export function useTelemetry() {
  const workerRef = useRef<Worker | null>(null);
  const sharedRef = useRef<SharedBuffers | null>(null);
  const [data, setData] = useState<ProcessedData | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Create Web Worker
    const worker = new Worker(
      new URL('../workers/telemetry.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    // Try to set up SharedArrayBuffer double-buffering
    const shared = createSharedBuffers();
    if (shared) {
      sharedRef.current = shared;
      worker.postMessage({
        type: 'init_shared_buffers',
        payload: {
          controlSAB: shared.controlSAB,
          dataSAB0: shared.dataSAB0,
          dataSAB1: shared.dataSAB1,
        },
      });
      console.log('SharedArrayBuffer double-buffering enabled');
    } else {
      console.log('SharedArrayBuffer not available, using structured clone');
    }

    worker.onmessage = (event) => {
      if (event.data.type === 'processed_batch') {
        setData(event.data as ProcessedData);
      }
    };

    // Connect to data source
    const ds = getDataSource();
    const unsub = ds.subscribe((batch: TelemetryBatch) => {
      setConnected(true);
      worker.postMessage({ type: 'telemetry_batch', payload: batch.data });
    });
    ds.start();

    return () => {
      unsub();
      ds.stop();
      worker.terminate();
    };
  }, []);

  const triggerPanic = useCallback(async (ids?: number[]) => {
    return getDataSource().panic(ids);
  }, []);

  const resetPanic = useCallback(async () => {
    return getDataSource().reset();
  }, []);

  return { data, connected, triggerPanic, resetPanic };
}
