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

// ─── GPU ECC / DCGM Types ─────────────────────────────────────────────

export interface GpuEccEntry {
  gpuId: number;
  sramCorrectable: number;
  sramUncorrectable: number;
  dramCorrectable: number;
  dramUncorrectable: number;
  retiredPagesSingle: number;
  retiredPagesDouble: number;
  pendingRetirement: number;
  remapperCorrectable: number;
  remapperUncorrectable: number;
  remapperAvailability: boolean;
  pciReplayCount: number;
  pciReplayRollover: number;
  lastXidError: number;
  lastXidTimestamp: number;
  thermalViolations: number;
  powerViolations: number;
}

export interface EccSummary {
  serverId: number;
  summary: {
    totalSramCE: number;
    totalSramUE: number;
    totalDramCE: number;
    totalDramUE: number;
    totalRetiredPages: number;
    gpusWithUncorrectable: number;
    gpusWithXidErrors: number;
  };
}

// ─── NVSwitch Types ───────────────────────────────────────────────────

export interface NvSwitchLinkError {
  port: number;
  errors: number;
  state: number;
}

export interface NvSwitchInfo {
  id: number;
  temperature: number;
  voltage: number;
  power: number;
  activePortCount: number;
  degradedPortCount: number;
  downPortCount: number;
  totalPorts: number;
  throughputTxGBs: number;
  throughputRxGBs: number;
  avgLatencyNs: number;
  crcErrors: number;
  eccErrors: number;
  replayErrors: number;
  fatalErrors: number;
  nonFatalErrors: number;
  recoveryCount: number;
  topLinkErrors: NvSwitchLinkError[];
}

export interface NvSwitchSummary {
  serverId: number;
  summary: {
    totalThroughputTB: number;
    totalFatalErrors: number;
    degradedLinks: number;
    maxTemperature: number;
    totalPower: number;
  };
  switches: NvSwitchInfo[];
}

// ─── SEL Event Types ──────────────────────────────────────────────────

export interface SELEvent {
  id: string;
  timestamp: number;
  serverId: number;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details: Record<string, unknown>;
  resolved: boolean;
  resolvedAt: number | null;
  resolvedBy: string | null;
}

// ─── Webhook Types ────────────────────────────────────────────────────

export interface WebhookConfig {
  id: string;
  name: string;
  type: 'pagerduty' | 'slack' | 'webhook';
  url: string;
  enabled: boolean;
  rateLimitMs: number;
}

// ─── Remediation Types ────────────────────────────────────────────────

export interface RemediationStep {
  action: string;
  description: string;
  durationMs: number;
  status: 'completed' | 'failed' | 'pending';
  startedAt: number;
  completedAt: number;
}

export interface RemediationExecution {
  id: string;
  playbookId: string;
  playbookName: string;
  eventId: string;
  serverId: number;
  startedAt: number;
  completedAt: number;
  status: 'success' | 'partial_failure';
  steps: RemediationStep[];
  durationMs: number;
}

export interface Playbook {
  id: string;
  name: string;
  trigger: { eventType: string; minSeverity: string };
  enabled: boolean;
  cooldownMs: number;
  steps: { action: string; description: string; durationMs: number; target?: string }[];
  successRate: number;
}
