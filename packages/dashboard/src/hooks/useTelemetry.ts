import { useEffect, useRef, useState, useCallback } from 'react';
import { getDataSource } from '../data/DataSource';
import type { ServerTelemetry, TelemetryBatch } from '../types';

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
  const [data, setData] = useState<ProcessedData | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Create Web Worker
    const worker = new Worker(
      new URL('../workers/telemetry.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

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
