// GPU ECC / Memory Error Simulator — models NVIDIA DCGM-style error counters
// Reference: NVIDIA Data Center GPU Manager (DCGM) field IDs
// DCGM_FI_DEV_ECC_SBE_VOL_TOTAL, DCGM_FI_DEV_ECC_DBE_VOL_TOTAL, etc.

const NUM_GPUS = 72;

// Per-server ECC state — accumulates over "uptime"
const eccStates = new Map();

function getOrCreateEccState(serverId) {
  if (!eccStates.has(serverId)) {
    const gpus = Array.from({ length: NUM_GPUS }, (_, i) => ({
      // Volatile (since last reset) counters
      sramCorrectable: 0,             // SRAM single-bit errors (common, auto-corrected)
      sramUncorrectable: 0,           // SRAM double-bit errors (very rare, triggers XID 94)
      dramCorrectable: 0,             // HBM3e correctable ECC (common under load)
      dramUncorrectable: 0,           // HBM3e uncorrectable (triggers page retirement)
      // Aggregate (lifetime) counters
      retiredPagesSingle: Math.floor(Math.random() * 3),  // Already retired pages (SBE)
      retiredPagesDouble: 0,          // Should be 0 on healthy GPU
      pendingRetirement: 0,           // Pages pending retirement until next reset
      // Row remapper
      remapperCorrectable: Math.floor(Math.random() * 2),
      remapperUncorrectable: 0,
      remapperAvailability: true,     // false = out of remap rows
      // PCIe
      pciReplayCount: Math.floor(Math.random() * 5),
      pciReplayRollover: 0,
      // XID errors (last observed)
      lastXidError: 0,               // 0 = none, 48 = DBE, 63 = ECC page retirement, 94 = contained ECC
      lastXidTimestamp: 0,
      // Thermal throttle events
      thermalViolations: 0,
      powerViolations: 0,
    }));
    eccStates.set(serverId, {
      gpus,
      bootTimestamp: Date.now() - Math.floor(Math.random() * 86400000), // random uptime up to 24h
    });
  }
  return eccStates.get(serverId);
}

/**
 * Simulate ECC error accumulation per tick.
 * Rates based on published NVIDIA HBM3e reliability data:
 * - SRAM correctable: ~0.01-0.5 per GPU per minute under load
 * - DRAM correctable: ~0.005-0.1 per GPU per minute
 * - Uncorrectable: very rare, ~0.0001 per GPU per minute
 */
export function generateEccData(serverId, isPanic) {
  const state = getOrCreateEccState(serverId);

  for (let i = 0; i < NUM_GPUS; i++) {
    const gpu = state.gpus[i];

    // SRAM correctable: rate increases with temperature/load
    const sramRate = isPanic ? 0.08 : 0.01;
    if (Math.random() < sramRate) {
      gpu.sramCorrectable += 1 + Math.floor(Math.random() * 3);
    }

    // DRAM (HBM3e) correctable
    const dramRate = isPanic ? 0.04 : 0.005;
    if (Math.random() < dramRate) {
      gpu.dramCorrectable += 1;
    }

    // SRAM uncorrectable — very rare, more likely under panic (thermal stress)
    if (Math.random() < (isPanic ? 0.001 : 0.00005)) {
      gpu.sramUncorrectable += 1;
      gpu.lastXidError = 94; // Contained ECC error
      gpu.lastXidTimestamp = Date.now();
    }

    // DRAM uncorrectable — extremely rare
    if (Math.random() < (isPanic ? 0.0005 : 0.00002)) {
      gpu.dramUncorrectable += 1;
      gpu.pendingRetirement += 1;
      gpu.lastXidError = 63; // ECC page retirement or DBE
      gpu.lastXidTimestamp = Date.now();
    }

    // PCIe replay — occasional
    if (Math.random() < 0.002) {
      gpu.pciReplayCount += 1;
      if (gpu.pciReplayCount > 65535) {
        gpu.pciReplayRollover += 1;
        gpu.pciReplayCount = 0;
      }
    }

    // Thermal/power violations under panic
    if (isPanic) {
      if (Math.random() < 0.05) gpu.thermalViolations += 1;
      if (Math.random() < 0.03) gpu.powerViolations += 1;
    }
  }

  return {
    serverId,
    uptimeSeconds: Math.floor((Date.now() - state.bootTimestamp) / 1000),
    gpus: state.gpus.map((g, i) => ({
      gpuId: i,
      sramCorrectable: g.sramCorrectable,
      sramUncorrectable: g.sramUncorrectable,
      dramCorrectable: g.dramCorrectable,
      dramUncorrectable: g.dramUncorrectable,
      retiredPagesSingle: g.retiredPagesSingle,
      retiredPagesDouble: g.retiredPagesDouble,
      pendingRetirement: g.pendingRetirement,
      remapperCorrectable: g.remapperCorrectable,
      remapperUncorrectable: g.remapperUncorrectable,
      remapperAvailability: g.remapperAvailability,
      pciReplayCount: g.pciReplayCount,
      pciReplayRollover: g.pciReplayRollover,
      lastXidError: g.lastXidError,
      lastXidTimestamp: g.lastXidTimestamp,
      thermalViolations: g.thermalViolations,
      powerViolations: g.powerViolations,
    })),
    // Summary stats for this server
    summary: {
      totalSramCE: state.gpus.reduce((s, g) => s + g.sramCorrectable, 0),
      totalSramUE: state.gpus.reduce((s, g) => s + g.sramUncorrectable, 0),
      totalDramCE: state.gpus.reduce((s, g) => s + g.dramCorrectable, 0),
      totalDramUE: state.gpus.reduce((s, g) => s + g.dramUncorrectable, 0),
      totalRetiredPages: state.gpus.reduce((s, g) => s + g.retiredPagesSingle + g.retiredPagesDouble, 0),
      gpusWithUncorrectable: state.gpus.filter(g => g.sramUncorrectable > 0 || g.dramUncorrectable > 0).length,
      gpusWithXidErrors: state.gpus.filter(g => g.lastXidError !== 0).length,
    },
  };
}

export function resetEccCounters(serverId) {
  eccStates.delete(serverId);
}
