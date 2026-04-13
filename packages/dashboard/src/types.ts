// Telemetry data types matching the BMC simulator output

export interface ThermalData {
  inletTemp: number;
  outletTemp: number;
  gpuCoreTemps: number[];
  liquidCoolingFlowRate: number;
}

export interface PowerData {
  chassisWattage: number;
  pue: number;
  psuEfficiency: number[];
}

export interface ComputeData {
  gpuUtilization: number[];
  hbm3eMemoryUsage: number[];
  nvlinkBandwidth: number[];
}

export interface ServerTelemetry {
  serverId: number;
  timestamp: number;
  thermal: ThermalData;
  power: PowerData;
  compute: ComputeData;
}

export interface TelemetryBatch {
  type: 'telemetry_batch';
  data: ServerTelemetry[];
  timestamp: number;
}

export interface AIOpsAlert {
  id: string;
  serverId: number;
  gpuId: number;
  type: 'fan_failure' | 'thermal_throttle' | 'memory_error' | 'nvlink_degraded' | 'psu_failure';
  probability: number;
  timeHorizon: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
}

export interface ServerSummary {
  id: number;
  name: string;
  avgTemp: number;
  maxTemp: number;
  avgGpuUtil: number;
  wattage: number;
  status: 'normal' | 'warning' | 'critical';
}

export type HealthStatus = 'normal' | 'warning' | 'critical';

export function getHealthStatus(maxTemp: number): HealthStatus {
  if (maxTemp >= 85) return 'critical';
  if (maxTemp >= 75) return 'warning';
  return 'normal';
}

export function getHealthColor(status: HealthStatus): number {
  switch (status) {
    case 'critical': return 0xf85149;
    case 'warning': return 0xf0c040;
    case 'normal': return 0x76d276;
  }
}

export function getHealthCSSColor(status: HealthStatus): string {
  switch (status) {
    case 'critical': return '#f85149';
    case 'warning': return '#f0c040';
    case 'normal': return '#76d276';
  }
}
