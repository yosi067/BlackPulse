// Unified data source: switches between WebSocket and Static mode

import type { ServerTelemetry, TelemetryBatch, SELEvent, EccSummary, NvSwitchSummary } from '../types';
import { StaticDataSource, isStaticMode } from './StaticDataSource';

export type DataCallback = (batch: TelemetryBatch) => void;
export type EventCallback = (events: SELEvent[]) => void;
export type EccCallback = (data: EccSummary[]) => void;
export type NvSwitchCallback = (data: NvSwitchSummary[]) => void;

export class DataSource {
  private ws: WebSocket | null = null;
  private static staticSource: StaticDataSource | null = null;
  private listeners = new Set<DataCallback>();
  private eventListeners = new Set<EventCallback>();
  private eccListeners = new Set<EccCallback>();
  private nvswitchListeners = new Set<NvSwitchCallback>();
  private useStatic: boolean;

  constructor() {
    this.useStatic = isStaticMode();
  }

  start() {
    if (this.useStatic) {
      this.startStatic();
    } else {
      this.startWebSocket();
    }
  }

  private startStatic() {
    if (!DataSource.staticSource) {
      DataSource.staticSource = new StaticDataSource();
    }
    DataSource.staticSource.subscribe((batch) => {
      this.listeners.forEach(fn => fn(batch));
    });
    DataSource.staticSource.start();
  }

  private startWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

    const connect = () => {
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'telemetry_batch':
              this.listeners.forEach(fn => fn(msg as TelemetryBatch));
              break;
            case 'events':
              this.eventListeners.forEach(fn => fn(msg.data as SELEvent[]));
              break;
            case 'ecc_summary':
              this.eccListeners.forEach(fn => fn(msg.data as EccSummary[]));
              break;
            case 'nvswitch_summary':
              this.nvswitchListeners.forEach(fn => fn(msg.data as NvSwitchSummary[]));
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      this.ws.onclose = () => {
        // Reconnect after 2 seconds, fall back to static if repeated failures
        setTimeout(() => {
          if (!this.useStatic) connect();
        }, 2000);
      };

      this.ws.onerror = () => {
        this.ws?.close();
        // After connection error, switch to static mode
        console.warn('WebSocket failed, switching to static data source');
        this.useStatic = true;
        this.startStatic();
      };
    };

    connect();
  }

  subscribe(fn: DataCallback) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  subscribeEvents(fn: EventCallback) {
    this.eventListeners.add(fn);
    return () => { this.eventListeners.delete(fn); };
  }

  subscribeEcc(fn: EccCallback) {
    this.eccListeners.add(fn);
    return () => { this.eccListeners.delete(fn); };
  }

  subscribeNvSwitch(fn: NvSwitchCallback) {
    this.nvswitchListeners.add(fn);
    return () => { this.nvswitchListeners.delete(fn); };
  }

  stop() {
    this.ws?.close();
    this.ws = null;
    DataSource.staticSource?.stop();
  }

  async panic(serverIds?: number[]): Promise<number[]> {
    if (this.useStatic && DataSource.staticSource) {
      return DataSource.staticSource.panic(serverIds);
    }
    try {
      const res = await fetch('/api/panic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverIds }),
      });
      const data = await res.json();
      return data.affectedServers;
    } catch {
      return [];
    }
  }

  async reset(): Promise<void> {
    if (this.useStatic && DataSource.staticSource) {
      DataSource.staticSource.reset();
      return;
    }
    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch {
      // ignore
    }
  }
}

// Singleton
let _dataSource: DataSource | null = null;
export function getDataSource(): DataSource {
  if (!_dataSource) _dataSource = new DataSource();
  return _dataSource;
}
