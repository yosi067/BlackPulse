// System Event Log (SEL) Generator — models real BMC event log entries
// Reference: IPMI SEL record format, Redfish LogService schema

const MAX_EVENTS = 500;   // Keep last 500 events per system (ring buffer)
const eventStore = [];     // Global event log
let nextEventId = 1;

const EVENT_TYPES = {
  TEMPERATURE_THRESHOLD: 'Temperature Threshold',
  TEMPERATURE_CRITICAL: 'Temperature Critical',
  PSU_STATUS: 'PSU Status Change',
  PSU_REDUNDANCY: 'PSU Redundancy',
  FAN_FAILURE: 'Fan Failure',
  ECC_CORRECTABLE: 'ECC Correctable Error',
  ECC_UNCORRECTABLE: 'ECC Uncorrectable Error',
  NVLINK_STATE: 'NVLink State Change',
  NVSWITCH_ERROR: 'NVSwitch Error',
  POWER_CYCLE: 'Power Cycle',
  BMC_FIRMWARE: 'BMC Firmware Event',
  WATCHDOG_TIMER: 'Watchdog Timer',
  CHASSIS_INTRUSION: 'Chassis Intrusion',
  COOLANT_FLOW: 'Coolant Flow Alert',
  GPU_THROTTLE: 'GPU Thermal Throttle',
  XID_ERROR: 'NVIDIA XID Error',
  MEMORY_TRAINING: 'Memory Training',
  BOOT_EVENT: 'System Boot',
  AUTO_REMEDIATION: 'Auto-Remediation',
};

const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
};

function createEvent(serverId, type, severity, message, details = {}) {
  const event = {
    id: `SEL-${String(nextEventId++).padStart(6, '0')}`,
    timestamp: Date.now(),
    serverId,
    type,
    severity,
    message,
    details,
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
  };
  eventStore.push(event);
  if (eventStore.length > MAX_EVENTS * 2) {
    eventStore.splice(0, eventStore.length - MAX_EVENTS);
  }
  return event;
}

/**
 * Generate events based on current telemetry state.
 * Call once per tick with the full batch of server telemetry.
 */
export function generateEvents(telemetryBatch, eccBatch, nvswitchBatch) {
  const newEvents = [];

  for (const server of telemetryBatch) {
    const sid = server.serverId;
    const maxGpuTemp = Math.max(...server.thermal.gpuCoreTemps);
    const avgGpuTemp = server.thermal.gpuCoreTemps.reduce((a, b) => a + b, 0) / server.thermal.gpuCoreTemps.length;

    // Temperature threshold warnings
    if (maxGpuTemp > 85 && Math.random() < 0.15) {
      newEvents.push(createEvent(sid, EVENT_TYPES.TEMPERATURE_THRESHOLD, SEVERITY.WARNING,
        `GPU temperature ${maxGpuTemp.toFixed(1)}°C exceeds warning threshold (85°C)`,
        { maxTemp: maxGpuTemp, threshold: 85, gpuId: server.thermal.gpuCoreTemps.indexOf(maxGpuTemp) }
      ));
    }

    // Temperature critical
    if (maxGpuTemp > 95 && Math.random() < 0.3) {
      newEvents.push(createEvent(sid, EVENT_TYPES.TEMPERATURE_CRITICAL, SEVERITY.CRITICAL,
        `GPU temperature ${maxGpuTemp.toFixed(1)}°C exceeds critical threshold (95°C) — throttling initiated`,
        { maxTemp: maxGpuTemp, threshold: 95 }
      ));
    }

    // PSU efficiency drop
    const minPsu = Math.min(...server.power.psuEfficiency);
    if (minPsu < 88 && Math.random() < 0.05) {
      const psuIdx = server.power.psuEfficiency.indexOf(minPsu);
      newEvents.push(createEvent(sid, EVENT_TYPES.PSU_STATUS, SEVERITY.WARNING,
        `PSU ${psuIdx} efficiency degraded to ${minPsu.toFixed(1)}%`,
        { psuId: psuIdx, efficiency: minPsu }
      ));
    }

    // Coolant flow low
    if (server.thermal.liquidCoolingFlowRate < 6 && Math.random() < 0.1) {
      newEvents.push(createEvent(sid, EVENT_TYPES.COOLANT_FLOW, SEVERITY.WARNING,
        `Coolant flow rate ${server.thermal.liquidCoolingFlowRate.toFixed(1)} L/min below minimum (6 L/min)`,
        { flowRate: server.thermal.liquidCoolingFlowRate, threshold: 6 }
      ));
    }

    // Power spike
    if (server.power.chassisWattage > 13000 && Math.random() < 0.05) {
      newEvents.push(createEvent(sid, EVENT_TYPES.GPU_THROTTLE, SEVERITY.WARNING,
        `Chassis power ${(server.power.chassisWattage / 1000).toFixed(1)} kW approaching limit`,
        { wattage: server.power.chassisWattage }
      ));
    }
  }

  // ECC events
  if (eccBatch) {
    for (const ecc of eccBatch) {
      const ueGpus = ecc.gpus.filter(g => g.lastXidError !== 0 && Date.now() - g.lastXidTimestamp < 2000);
      for (const gpu of ueGpus) {
        if (gpu.lastXidError === 94) {
          newEvents.push(createEvent(ecc.serverId, EVENT_TYPES.ECC_CORRECTABLE, SEVERITY.WARNING,
            `GPU ${gpu.gpuId}: XID 94 — Contained ECC error detected in SRAM`,
            { gpuId: gpu.gpuId, xid: 94, sramUE: gpu.sramUncorrectable }
          ));
        } else if (gpu.lastXidError === 63) {
          newEvents.push(createEvent(ecc.serverId, EVENT_TYPES.ECC_UNCORRECTABLE, SEVERITY.CRITICAL,
            `GPU ${gpu.gpuId}: XID 63 — HBM3e uncorrectable ECC error, page retirement pending`,
            { gpuId: gpu.gpuId, xid: 63, dramUE: gpu.dramUncorrectable, pendingPages: gpu.pendingRetirement }
          ));
        }
      }
    }
  }

  // NVSwitch events
  if (nvswitchBatch) {
    for (const nvsw of nvswitchBatch) {
      for (const sw of nvsw.switches) {
        if (sw.fatalErrors > 0 && Math.random() < 0.5) {
          newEvents.push(createEvent(nvsw.serverId, EVENT_TYPES.NVSWITCH_ERROR, SEVERITY.CRITICAL,
            `NVSwitch ${sw.id}: Fatal error detected — ${sw.fatalErrors} total, recovery count: ${sw.recoveryCount}`,
            { switchId: sw.id, fatalErrors: sw.fatalErrors, recoveryCount: sw.recoveryCount }
          ));
        }
        if (sw.degradedPortCount > 2 && Math.random() < 0.1) {
          newEvents.push(createEvent(nvsw.serverId, EVENT_TYPES.NVLINK_STATE, SEVERITY.WARNING,
            `NVSwitch ${sw.id}: ${sw.degradedPortCount} degraded + ${sw.downPortCount} down links`,
            { switchId: sw.id, degraded: sw.degradedPortCount, down: sw.downPortCount }
          ));
        }
      }
    }
  }

  return newEvents;
}

// Add auto-remediation event
export function addRemediationEvent(serverId, action, result) {
  return createEvent(serverId, EVENT_TYPES.AUTO_REMEDIATION,
    result === 'success' ? SEVERITY.INFO : SEVERITY.WARNING,
    `Auto-remediation: ${action} — ${result}`,
    { action, result }
  );
}

// Resolve an event
export function resolveEvent(eventId, resolvedBy = 'operator') {
  const event = eventStore.find(e => e.id === eventId);
  if (event) {
    event.resolved = true;
    event.resolvedAt = Date.now();
    event.resolvedBy = resolvedBy;
  }
  return event;
}

// Query events
export function getEvents({ serverId, severity, type, limit = 100, since, unresolved } = {}) {
  let filtered = eventStore;
  if (serverId !== undefined) filtered = filtered.filter(e => e.serverId === serverId);
  if (severity) filtered = filtered.filter(e => e.severity === severity);
  if (type) filtered = filtered.filter(e => e.type === type);
  if (since) filtered = filtered.filter(e => e.timestamp >= since);
  if (unresolved) filtered = filtered.filter(e => !e.resolved);
  return filtered.slice(-limit).reverse(); // newest first
}

export function getEventStats() {
  const last5min = Date.now() - 300000;
  const recent = eventStore.filter(e => e.timestamp >= last5min);
  return {
    total: eventStore.length,
    unresolved: eventStore.filter(e => !e.resolved).length,
    last5min: recent.length,
    bySeverity: {
      critical: recent.filter(e => e.severity === 'critical').length,
      warning: recent.filter(e => e.severity === 'warning').length,
      info: recent.filter(e => e.severity === 'info').length,
    },
    byType: Object.fromEntries(
      Object.values(EVENT_TYPES).map(t => [t, recent.filter(e => e.type === t).length])
    ),
  };
}
