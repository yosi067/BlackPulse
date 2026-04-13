use wasm_bindgen::prelude::*;

/// LTTB (Largest Triangle Three Buckets) downsampling algorithm
/// Reduces data points while preserving visual appearance
#[wasm_bindgen]
pub fn lttb_downsample(data: &[f32], target_points: usize) -> Vec<f32> {
    let len = data.len();
    if target_points >= len || target_points < 3 {
        return data.to_vec();
    }

    let mut result = Vec::with_capacity(target_points);

    // Always include first point
    result.push(data[0]);

    let bucket_size = (len - 2) as f64 / (target_points - 2) as f64;

    let mut a_index: usize = 0;

    for i in 1..(target_points - 1) {
        // Calculate bucket range
        let bucket_start = ((i - 1) as f64 * bucket_size + 1.0) as usize;
        let bucket_end = (i as f64 * bucket_size + 1.0).min(len as f64) as usize;

        // Calculate average of next bucket for triangle area
        let next_start = bucket_end;
        let next_end = ((i + 1) as f64 * bucket_size + 1.0).min(len as f64) as usize;
        let avg_next: f32 = if next_end > next_start {
            data[next_start..next_end].iter().sum::<f32>() / (next_end - next_start) as f32
        } else {
            data[len - 1]
        };

        // Find point in current bucket with largest triangle area
        let mut max_area: f32 = -1.0;
        let mut max_idx = bucket_start;
        let a_val = data[a_index];

        for j in bucket_start..bucket_end {
            let area = ((a_index as f32 - next_start as f32) * (data[j] - a_val)
                - (a_index as f32 - j as f32) * (avg_next - a_val))
                .abs()
                * 0.5;
            if area > max_area {
                max_area = area;
                max_idx = j;
            }
        }

        result.push(data[max_idx]);
        a_index = max_idx;
    }

    // Always include last point
    result.push(data[len - 1]);
    result
}

/// Sliding window anomaly detection
/// Returns anomaly scores (0.0 = normal, 1.0 = extreme anomaly)
#[wasm_bindgen]
pub fn detect_anomalies(data: &[f32], window_size: usize, threshold: f32) -> Vec<f32> {
    let len = data.len();
    if len < window_size {
        return vec![0.0; len];
    }

    let mut scores = vec![0.0f32; len];
    let mut window_sum: f32 = data[..window_size].iter().sum();
    let mut window_sq_sum: f32 = data[..window_size].iter().map(|x| x * x).sum();

    for i in window_size..len {
        let mean = window_sum / window_size as f32;
        let variance = (window_sq_sum / window_size as f32) - mean * mean;
        let std_dev = variance.max(0.0).sqrt();

        let deviation = (data[i] - mean).abs();
        let score = if std_dev > 0.001 {
            (deviation / (std_dev * threshold)).min(1.0)
        } else if deviation > threshold {
            1.0
        } else {
            0.0
        };

        scores[i] = score;

        // Slide window
        let old = data[i - window_size];
        window_sum += data[i] - old;
        window_sq_sum += data[i] * data[i] - old * old;
    }

    scores
}

/// Process a batch of server temperatures for the heatmap
/// Input: flat array of [server0_gpu0, server0_gpu1, ..., server0_gpu71, server1_gpu0, ...]
/// Output: per-server summary [avgTemp, maxTemp, anomalyScore] for each server
#[wasm_bindgen]
pub fn process_server_batch(temps: &[f32], num_servers: usize, num_gpus: usize) -> Vec<f32> {
    let mut result = Vec::with_capacity(num_servers * 3);

    for s in 0..num_servers {
        let offset = s * num_gpus;
        let end = (offset + num_gpus).min(temps.len());
        let slice = &temps[offset..end];

        let mut sum = 0.0f32;
        let mut max = f32::NEG_INFINITY;

        for &t in slice {
            sum += t;
            if t > max {
                max = t;
            }
        }

        let avg = sum / slice.len() as f32;
        // Anomaly score: how far max is from critical threshold
        let anomaly = ((max - 75.0) / 30.0).clamp(0.0, 1.0);

        result.push(avg);
        result.push(max);
        result.push(anomaly);
    }

    result
}

/// Exponential moving average smoothing for sparkline data
#[wasm_bindgen]
pub fn ema_smooth(data: &[f32], alpha: f32) -> Vec<f32> {
    if data.is_empty() {
        return vec![];
    }
    let mut result = Vec::with_capacity(data.len());
    result.push(data[0]);
    for i in 1..data.len() {
        let smoothed = alpha * data[i] + (1.0 - alpha) * result[i - 1];
        result.push(smoothed);
    }
    result
}

/// Ring buffer implementation for streaming data
#[wasm_bindgen]
pub struct RingBuffer {
    data: Vec<f32>,
    capacity: usize,
    head: usize,
    len: usize,
}

#[wasm_bindgen]
impl RingBuffer {
    #[wasm_bindgen(constructor)]
    pub fn new(capacity: usize) -> RingBuffer {
        RingBuffer {
            data: vec![0.0; capacity],
            capacity,
            head: 0,
            len: 0,
        }
    }

    pub fn push(&mut self, value: f32) {
        self.data[self.head] = value;
        self.head = (self.head + 1) % self.capacity;
        if self.len < self.capacity {
            self.len += 1;
        }
    }

    pub fn push_batch(&mut self, values: &[f32]) {
        for &v in values {
            self.push(v);
        }
    }

    pub fn to_array(&self) -> Vec<f32> {
        let mut result = Vec::with_capacity(self.len);
        if self.len < self.capacity {
            result.extend_from_slice(&self.data[..self.len]);
        } else {
            result.extend_from_slice(&self.data[self.head..]);
            result.extend_from_slice(&self.data[..self.head]);
        }
        result
    }

    pub fn len(&self) -> usize {
        self.len
    }

    pub fn is_empty(&self) -> bool {
        self.len == 0
    }
}
