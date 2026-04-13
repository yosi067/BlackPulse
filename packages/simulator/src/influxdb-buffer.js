// In-memory time-series buffer — simulates InfluxDB write/query API
// Uses InfluxDB-compatible line protocol and Flux-like query interface

const RETENTION_SECONDS = 3600; // Keep 1 hour of data
const DOWNSAMPLE_AFTER = 300;   // Downsample data older than 5 minutes

// Storage: measurement -> [{ timestamp, tags, fields }]
const buckets = new Map();

export function writePoint(measurement, tags, fields, timestamp = Date.now()) {
  if (!buckets.has(measurement)) {
    buckets.set(measurement, []);
  }
  const bucket = buckets.get(measurement);
  bucket.push({ timestamp, tags: { ...tags }, fields: { ...fields } });

  // Evict old data
  const cutoff = Date.now() - RETENTION_SECONDS * 1000;
  while (bucket.length > 0 && bucket[0].timestamp < cutoff) {
    bucket.shift();
  }
}

export function writeBatch(points) {
  for (const { measurement, tags, fields, timestamp } of points) {
    writePoint(measurement, tags, fields, timestamp);
  }
}

/**
 * Write telemetry batch in InfluxDB line protocol format
 * 将 BMC telemetry 转为 InfluxDB measurements
 */
export function writeTelemetryBatch(telemetryBatch) {
  const ts = Date.now();
  const points = [];

  for (const server of telemetryBatch) {
    const serverTag = { serverId: String(server.serverId), serverName: `GB200-NVL72-${String(server.serverId).padStart(3, '0')}` };

    // Thermal measurement
    points.push({
      measurement: 'thermal',
      tags: serverTag,
      fields: {
        inletTemp: server.thermal.inletTemp,
        outletTemp: server.thermal.outletTemp,
        maxGpuTemp: Math.max(...server.thermal.gpuCoreTemps),
        avgGpuTemp: server.thermal.gpuCoreTemps.reduce((a, b) => a + b, 0) / server.thermal.gpuCoreTemps.length,
        flowRate: server.thermal.liquidCoolingFlowRate,
      },
      timestamp: ts,
    });

    // Power measurement
    points.push({
      measurement: 'power',
      tags: serverTag,
      fields: {
        chassisWattage: server.power.chassisWattage,
        pue: server.power.pue,
        avgPsuEfficiency: server.power.psuEfficiency.reduce((a, b) => a + b, 0) / server.power.psuEfficiency.length,
        minPsuEfficiency: Math.min(...server.power.psuEfficiency),
      },
      timestamp: ts,
    });

    // Compute measurement (aggregated)
    const gpuUtils = server.compute.gpuUtilization;
    points.push({
      measurement: 'compute',
      tags: serverTag,
      fields: {
        avgGpuUtil: gpuUtils.reduce((a, b) => a + b, 0) / gpuUtils.length,
        maxGpuUtil: Math.max(...gpuUtils),
        avgHbmUsage: server.compute.hbm3eMemoryUsage.reduce((a, b) => a + b, 0) / server.compute.hbm3eMemoryUsage.length,
        avgNvlinkBw: server.compute.nvlinkBandwidth.reduce((a, b) => a + b, 0) / server.compute.nvlinkBandwidth.length,
      },
      timestamp: ts,
    });
  }

  writeBatch(points);
  return points.length;
}

/**
 * Simple query API (subset of Flux-like queries):
 * - measurement: which measurement to query
 * - fields: array of field names (or '*')
 * - tags: tag filter object { serverId: '0' }
 * - range: { start: -300000, stop: 0 } (relative ms from now)
 * - aggregateWindow: { every: 10000, fn: 'mean' | 'max' | 'min' | 'last' }
 */
export function query({ measurement, fields, tags, range, aggregateWindow }) {
  const bucket = buckets.get(measurement);
  if (!bucket) return [];

  const now = Date.now();
  const startTime = range?.start ? now + range.start : now - 60000;
  const stopTime = range?.stop ? now + range.stop : now;

  // Filter by time and tags
  let filtered = bucket.filter(p => {
    if (p.timestamp < startTime || p.timestamp > stopTime) return false;
    if (tags) {
      for (const [k, v] of Object.entries(tags)) {
        if (p.tags[k] !== v) return false;
      }
    }
    return true;
  });

  // Select fields
  if (fields && fields[0] !== '*') {
    filtered = filtered.map(p => ({
      timestamp: p.timestamp,
      tags: p.tags,
      fields: Object.fromEntries(
        Object.entries(p.fields).filter(([k]) => fields.includes(k))
      ),
    }));
  }

  // Aggregate window (downsample)
  if (aggregateWindow) {
    const windowMs = aggregateWindow.every;
    const fn = aggregateWindow.fn || 'mean';
    const windowedMap = new Map();

    for (const point of filtered) {
      const windowKey = Math.floor(point.timestamp / windowMs) * windowMs;
      if (!windowedMap.has(windowKey)) {
        windowedMap.set(windowKey, []);
      }
      windowedMap.get(windowKey).push(point);
    }

    const result = [];
    for (const [windowTs, points] of windowedMap) {
      const aggregated = { timestamp: windowTs, tags: points[0].tags, fields: {} };
      const fieldNames = Object.keys(points[0].fields);

      for (const fieldName of fieldNames) {
        const values = points.map(p => p.fields[fieldName]).filter(v => typeof v === 'number');
        if (values.length === 0) continue;

        switch (fn) {
          case 'mean':
            aggregated.fields[fieldName] = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'max':
            aggregated.fields[fieldName] = Math.max(...values);
            break;
          case 'min':
            aggregated.fields[fieldName] = Math.min(...values);
            break;
          case 'last':
            aggregated.fields[fieldName] = values[values.length - 1];
            break;
          case 'sum':
            aggregated.fields[fieldName] = values.reduce((a, b) => a + b, 0);
            break;
        }
      }
      result.push(aggregated);
    }

    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  return filtered;
}

export function getMeasurements() {
  return Array.from(buckets.keys());
}

export function getStats() {
  const stats = {};
  for (const [name, bucket] of buckets) {
    stats[name] = {
      pointCount: bucket.length,
      oldestTimestamp: bucket[0]?.timestamp,
      newestTimestamp: bucket[bucket.length - 1]?.timestamp,
    };
  }
  return {
    measurements: stats,
    totalPoints: Array.from(buckets.values()).reduce((s, b) => s + b.length, 0),
    retentionSeconds: RETENTION_SECONDS,
  };
}
