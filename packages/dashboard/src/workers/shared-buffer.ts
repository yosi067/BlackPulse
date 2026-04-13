// SharedArrayBuffer double-buffering for zero-copy Worker <-> Main thread communication
// Uses two alternating buffers so the worker writes to one while the main thread reads the other

const NUM_SERVERS = 100;
const NUM_GPUS = 72;

// Layout per server: [avgTemp, maxTemp, anomalyScore, ...72 gpuTemps, ...72 gpuUtils, wattage, pue, flowRate]
// = 3 + 72 + 72 + 3 = 150 floats per server
export const FLOATS_PER_SERVER = 150;
export const OFFSET_AVG_TEMP = 0;
export const OFFSET_MAX_TEMP = 1;
export const OFFSET_ANOMALY = 2;
export const OFFSET_GPU_TEMPS = 3;
export const OFFSET_GPU_UTILS = 3 + NUM_GPUS;   // 75
export const OFFSET_WATTAGE = 3 + NUM_GPUS * 2; // 147
export const OFFSET_PUE = 148;
export const OFFSET_FLOW_RATE = 149;

export const TOTAL_FLOATS = NUM_SERVERS * FLOATS_PER_SERVER;
export const BUFFER_BYTES = TOTAL_FLOATS * Float32Array.BYTES_PER_ELEMENT;

// Double buffer: two data regions + 1 control int (active buffer index)
// Control layout: [activeBufferIndex (0 or 1)]
export const CONTROL_BYTES = Int32Array.BYTES_PER_ELEMENT;

export interface SharedBuffers {
  controlSAB: SharedArrayBuffer;
  dataSAB0: SharedArrayBuffer;
  dataSAB1: SharedArrayBuffer;
  controlView: Int32Array;
  dataView0: Float32Array;
  dataView1: Float32Array;
}

export function createSharedBuffers(): SharedBuffers | null {
  // Check if SharedArrayBuffer is available
  if (typeof SharedArrayBuffer === 'undefined') {
    console.warn('SharedArrayBuffer not available — falling back to structured clone');
    return null;
  }

  try {
    const controlSAB = new SharedArrayBuffer(CONTROL_BYTES);
    const dataSAB0 = new SharedArrayBuffer(BUFFER_BYTES);
    const dataSAB1 = new SharedArrayBuffer(BUFFER_BYTES);

    return {
      controlSAB,
      dataSAB0,
      dataSAB1,
      controlView: new Int32Array(controlSAB),
      dataView0: new Float32Array(dataSAB0),
      dataView1: new Float32Array(dataSAB1),
    };
  } catch (e) {
    console.warn('Failed to create SharedArrayBuffer:', e);
    return null;
  }
}

// Worker side: get the buffer to write to (the inactive one)
export function getWriteBuffer(
  controlView: Int32Array,
  dataView0: Float32Array,
  dataView1: Float32Array
): Float32Array {
  const active = Atomics.load(controlView, 0);
  // Write to the buffer that is NOT currently being read
  return active === 0 ? dataView1 : dataView0;
}

// Worker side: swap buffers after writing is complete
export function swapBuffers(controlView: Int32Array): void {
  const current = Atomics.load(controlView, 0);
  Atomics.store(controlView, 0, current === 0 ? 1 : 0);
  // Notify main thread that new data is ready
  Atomics.notify(controlView, 0);
}

// Main thread side: get the buffer to read from (the active one)
export function getReadBuffer(
  controlView: Int32Array,
  dataView0: Float32Array,
  dataView1: Float32Array
): Float32Array {
  const active = Atomics.load(controlView, 0);
  return active === 0 ? dataView0 : dataView1;
}

// Write server data into shared buffer at the correct offset
export function writeServerData(
  buffer: Float32Array,
  serverId: number,
  avgTemp: number,
  maxTemp: number,
  anomaly: number,
  gpuTemps: number[],
  gpuUtils: number[],
  wattage: number,
  pue: number,
  flowRate: number
): void {
  const base = serverId * FLOATS_PER_SERVER;

  buffer[base + OFFSET_AVG_TEMP] = avgTemp;
  buffer[base + OFFSET_MAX_TEMP] = maxTemp;
  buffer[base + OFFSET_ANOMALY] = anomaly;

  // GPU temps
  for (let g = 0; g < NUM_GPUS && g < gpuTemps.length; g++) {
    buffer[base + OFFSET_GPU_TEMPS + g] = gpuTemps[g];
  }

  // GPU utils
  for (let g = 0; g < NUM_GPUS && g < gpuUtils.length; g++) {
    buffer[base + OFFSET_GPU_UTILS + g] = gpuUtils[g];
  }

  buffer[base + OFFSET_WATTAGE] = wattage;
  buffer[base + OFFSET_PUE] = pue;
  buffer[base + OFFSET_FLOW_RATE] = flowRate;
}

// Read server summary from shared buffer
export function readServerSummary(
  buffer: Float32Array,
  serverId: number
): { avgTemp: number; maxTemp: number; anomaly: number; wattage: number; pue: number; flowRate: number } {
  const base = serverId * FLOATS_PER_SERVER;
  return {
    avgTemp: buffer[base + OFFSET_AVG_TEMP],
    maxTemp: buffer[base + OFFSET_MAX_TEMP],
    anomaly: buffer[base + OFFSET_ANOMALY],
    wattage: buffer[base + OFFSET_WATTAGE],
    pue: buffer[base + OFFSET_PUE],
    flowRate: buffer[base + OFFSET_FLOW_RATE],
  };
}
