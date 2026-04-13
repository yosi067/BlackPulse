// Pure TypeScript fallback for the Wasm processor
// Used when Wasm build is not available

export function lttbDownsample(data: number[], targetPoints: number): number[] {
  const len = data.length;
  if (targetPoints >= len || targetPoints < 3) return data;

  const result: number[] = [data[0]];
  const bucketSize = (len - 2) / (targetPoints - 2);
  let aIndex = 0;

  for (let i = 1; i < targetPoints - 1; i++) {
    const bucketStart = Math.floor((i - 1) * bucketSize + 1);
    const bucketEnd = Math.min(Math.floor(i * bucketSize + 1), len);
    const nextStart = bucketEnd;
    const nextEnd = Math.min(Math.floor((i + 1) * bucketSize + 1), len);

    let avgNext = data[len - 1];
    if (nextEnd > nextStart) {
      let sum = 0;
      for (let j = nextStart; j < nextEnd; j++) sum += data[j];
      avgNext = sum / (nextEnd - nextStart);
    }

    let maxArea = -1;
    let maxIdx = bucketStart;
    const aVal = data[aIndex];

    for (let j = bucketStart; j < bucketEnd; j++) {
      const area = Math.abs(
        (aIndex - nextStart) * (data[j] - aVal) - (aIndex - j) * (avgNext - aVal)
      ) * 0.5;
      if (area > maxArea) {
        maxArea = area;
        maxIdx = j;
      }
    }

    result.push(data[maxIdx]);
    aIndex = maxIdx;
  }

  result.push(data[len - 1]);
  return result;
}

export function detectAnomalies(data: number[], windowSize: number, threshold: number): number[] {
  const len = data.length;
  if (len < windowSize) return new Array(len).fill(0);

  const scores = new Array(len).fill(0);
  let windowSum = 0;
  let windowSqSum = 0;

  for (let i = 0; i < windowSize; i++) {
    windowSum += data[i];
    windowSqSum += data[i] * data[i];
  }

  for (let i = windowSize; i < len; i++) {
    const mean = windowSum / windowSize;
    const variance = windowSqSum / windowSize - mean * mean;
    const stdDev = Math.sqrt(Math.max(0, variance));
    const deviation = Math.abs(data[i] - mean);

    scores[i] = stdDev > 0.001
      ? Math.min(deviation / (stdDev * threshold), 1.0)
      : deviation > threshold ? 1.0 : 0.0;

    const old = data[i - windowSize];
    windowSum += data[i] - old;
    windowSqSum += data[i] * data[i] - old * old;
  }

  return scores;
}

export function processServerBatch(
  temps: Float32Array | number[],
  numServers: number,
  numGpus: number
): Float32Array {
  const result = new Float32Array(numServers * 3);

  for (let s = 0; s < numServers; s++) {
    const offset = s * numGpus;
    let sum = 0;
    let max = -Infinity;

    for (let g = 0; g < numGpus; g++) {
      const t = temps[offset + g];
      sum += t;
      if (t > max) max = t;
    }

    const avg = sum / numGpus;
    const anomaly = Math.max(0, Math.min(1, (max - 75) / 30));

    result[s * 3] = avg;
    result[s * 3 + 1] = max;
    result[s * 3 + 2] = anomaly;
  }

  return result;
}

export function emaSmooth(data: number[], alpha: number): number[] {
  if (data.length === 0) return [];
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}
