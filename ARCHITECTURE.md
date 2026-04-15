# ARCHITECTURE.md — OmniCenter AI 技術架構深度解析

本文件為 [README.md](README.md) 的延伸，詳細說明 OmniCenter AI 的完整資料流、模擬層與真實硬體的差異、數據量級分析、各處理引擎的運作機制，以及後續朝真實 AI 伺服器監控方向的擴充路線圖。

---

## 目錄

- [1. 端對端資料流全景](#1-端對端資料流全景)
- [2. 各層數據量級分析](#2-各層數據量級分析)
- [3. 模擬器後端 vs 真實 BMC 對照](#3-模擬器後端-vs-真實-bmc-對照)
- [4. Web Worker 批次處理管線](#4-web-worker-批次處理管線)
- [5. SharedArrayBuffer 雙緩衝機制](#5-sharedarraybuffer-雙緩衝機制)
- [6. Rust-Wasm 數據處理引擎](#6-rust-wasm-數據處理引擎)
- [7. GLSL Shader 特效管線](#7-glsl-shader-特效管線)
- [8. AI/ML 預測引擎（Demo）](#8-aiml-預測引擎demo)
- [9. 告警規則引擎運作原理](#9-告警規則引擎運作原理)
- [10. v3 企業級子系統架構](#10-v3-企業級子系統架構)
  - [10.1 InfluxDB 時序緩衝引擎](#101-influxdb-時序緩衝引擎)
  - [10.2 GPU ECC 錯誤追蹤（DCGM 風格）](#102-gpu-ecc-錯誤追蹤-dcgm-風格)
  - [10.3 NVSwitch Fabric 監控](#103-nvswitch-fabric-監控)
  - [10.4 SEL 事件系統](#104-sel-事件系統)
  - [10.5 Webhook 通知管理器](#105-webhook-通知管理器)
  - [10.6 自動修復引擎 (Auto-remediation)](#106-自動修復引擎-auto-remediation)
  - [10.7 3D 資料中心視圖 (Three.js)](#107-3d-資料中心視圖-threejs)
  - [10.8 伺服器搜尋與篩選](#108-伺服器搜尋與篩選)
  - [10.9 Grafana 整合與 Dashboard Provisioning](#109-grafana-整合與-dashboard-provisioning)
- [11. 串接真實系統所需改動](#11-串接真實系統所需改動)
- [12. 注意事項與已知限制](#12-注意事項與已知限制)
- [13. 後續擴充路線圖（v4 及更遠）](#13-後續擴充路線圖v4-及更遠)

---

## 1. 端對端資料流全景

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ① BMC 模擬器 (Fastify)                                                    │
│     data-generator.js 每秒為 100 台伺服器生成遙測資料                          │
│     → 100 × { thermal, power, compute }                                    │
│     → WebSocket JSON 批次推播                                              │
│                                                                             │
│  ② WebSocket / 靜態數據源                            ┌─────────────────┐    │
│     DataSource.ts 自動偵測環境                        │ StaticDataSource │    │
│     • ws://host/ws/telemetry → 即時串流               │ (GitHub Pages   │    │
│     • 連線失敗 → 自動切換靜態模式 ──────────────────→ │  內建模擬引擎)   │    │
│                                                       └─────────────────┘    │
│  ③ useTelemetry Hook                                                        │
│     • 建立 Web Worker                                                       │
│     • 嘗試建立 SharedArrayBuffer 雙緩衝                                      │
│     • 訂閱 DataSource → 收到批次 → postMessage 給 Worker                    │
│                                                                             │
│  ④ Web Worker (telemetry.worker.ts)                                         │
│     a. 展平 100×72 GPU 溫度 → Float32Array (7,200 floats)                  │
│     b. processServerBatch() → [avg, max, anomaly] × 100 servers            │
│     c. 更新 60 秒環形緩衝區 → LTTB 降採樣至 30 點                            │
│     d. detectAnomalies() → 滑動窗口 5 + 2σ 偵測                             │
│     e. 聚合統計：Σ wattage, avg PUE, alert count                            │
│     f. (SAB) 寫入非活躍 buffer → Atomics.store 交換 → Atomics.notify        │
│     g. postMessage 回主線程（含 summaries + sparklines + rawBatch）          │
│                                                                             │
│  ⑤ React 渲染層                                                             │
│     • GlobalHeader — 聚合指標 (i18n 翻譯)                                   │
│     • RackHeatmap — 100 cells × Pixi.js + GLSL Shader + 篩選調光           │
│     • ServerFilter — 即時搜尋 + 狀態/機櫃篩選 + 排序                        │
│     • DataCenter3D — Three.js 等角投影機房 (Lazy-loaded)                    │
│     • AIOpsPanel — 規則式告警生成                                            │
│     • AlertRuleEngine — 自定義規則即時評估                                   │
│     • MLPredictionEngine — 模擬 ML 推論                                     │
│     • GPUEccTracker — DCGM 風格 ECC 錯誤追蹤                               │
│     • NVSwitchMonitor — NVSwitch Fabric 吞吐/鏈路監控                       │
│     • EventTimeline — SEL 事件時間軸（19 種事件）                            │
│     • WebhookSettings — Webhook + Playbook + 執行歷史三頁籤                 │
│     • BatchOperations — 多選 + 批次操作                                     │
│     • ServerDetail — 火焰圖 + NVLink + 液冷                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 資料流時序（v3 更新）

```
t=0ms    BMC Simulator: generateTelemetry(0..99)
t=1ms    generateEccData / generateNvSwitchData / generateEvents
t=2ms    writeTelemetryBatch → InfluxDB buffer
t=3ms    evaluateAndExecute → remediation engine
t=4ms    dispatchWebhooks (if critical events)
t=5ms    WebSocket: 4 messages per tick:
           ① { type:'telemetry_batch', data:[100 items] }     ~350 KB
           ② { type:'events', data:[...newEvents] }           ~2 KB
           ③ { type:'ecc_summary', data:{...fleetEcc} }       ~50 KB
           ④ { type:'nvswitch_summary', data:{...fleetNvs} }  ~30 KB
t=7ms    DataSource.onmessage → switch(type) → 通知對應 listeners
t=8ms    useTelemetry callbacks → update events/ecc/nvswitch state
t=9ms    worker.postMessage({ type:'telemetry_batch', payload })
t=10ms   Worker: 展平 7200 temps → processServerBatch → LTTB → anomaly
t=14ms   Worker: 寫入 SharedArrayBuffer (若可用) → swap → postMessage result
t=15ms   React setState(ProcessedData) → 觸發渲染
t=16ms   Pixi.js: 更新 100 cells + sparklines + GLSL uniforms
t=16ms   下一幀 (60 FPS) — Shader time 動畫持續推進
...
t=1000ms 下一輪 tick (1 秒間隔)
```

---

## 2. 各層數據量級分析

### 模擬器每秒產生的原始數據量

| 指標 | 數量 | 說明 |
|---|---|---|
| 伺服器數 | 100 | 模擬 10 個機櫃 × 每櫃 10 台 |
| 每台 GPU 數 | 72 | GB200 NVL72 規格 |
| 每台 PSU 數 | 6 | 電源供應器 |
| GPU 溫度 | 7,200 | 100 × 72 個 float 值 / 秒 |
| GPU 使用率 | 7,200 | 100 × 72 / 秒 |
| HBM3e 記憶體使用率 | 7,200 | 100 × 72 / 秒 |
| NVLink 頻寬 | 7,200 | 100 × 72 / 秒 |
| PSU 效率 | 600 | 100 × 6 / 秒 |
| 其他標量 | 500 | inlet/outlet temp, flow rate, wattage, pue × 100 |
| **每秒總 float values** | **~29,900** | ≈ 120 KB raw float data |

### WebSocket JSON 傳輸量（v3 更新）

| 項目 | 估算 |
|---|---|
| 單台伺服器 JSON | ~3.5 KB（含 72 顆 GPU 的 4 組陣列 + 標量） |
| telemetry_batch (100 台) | ~350 KB / 秒 |
| events 訊息 | ~2 KB / 秒（正常時 0-3 筆事件） |
| ecc_summary 訊息 | ~50 KB / 秒（100 台 × 72 GPU 摘要） |
| nvswitch_summary 訊息 | ~30 KB / 秒（100 台 × 2 NVSwitch 摘要） |
| 含 JSON key 名稱開銷 | ~40% overhead（vs binary） |
| **v3 總有效載荷** | **~432 KB/s ≈ 3.5 Mbps**（較 v2 增加 ~23%） |

### Web Worker 處理的數據

| 處理步驟 | 輸入大小 | 輸出大小 | 說明 |
|---|---|---|---|
| 展平 GPU temps | 29,900 values | 7,200 floats (28.8 KB) | 只取溫度子集 |
| processServerBatch | 28.8 KB | 300 floats (1.2 KB) | [avg, max, anomaly] × 100 |
| Sparkline 緩衝 | 100 × 60 points | 100 × 30 points (12 KB) | LTTB 降採樣後 |
| Anomaly detection | 100 floats | 100 floats (400 B) | 每台 1 個分數 |
| **SharedArrayBuffer** | — | 100 × 150 floats (60 KB) | 雙 buffer = 120 KB total |

### Pixi.js 渲染負載

| 元素 | Draw 量 | 說明 |
|---|---|---|
| 背景矩形 | 100 | Graphics.drawRoundedRect |
| 邊框 | 100 | Graphics.lineStyle + drawRoundedRect |
| 輝光層 | 0~100 | 只在 anomaly > 0.7 時繪製 |
| 迷你趨勢線 | 100 × 30 points | Graphics.moveTo/lineTo |
| 文字標籤 | 200 | 每格 2 個（編號 + 溫度）|
| **GLSL Shader** | 100 filters | 每幀更新 uTime uniform |
| **全部在同一 Canvas** | **~600 draw ops** | 批次渲染 > 60 FPS |

---

## 3. 模擬器後端 vs 真實 BMC 對照

### 功能對照表

| 面向 | 本專案模擬器 | 真實 BMC (Supermicro / Dell iDRAC) |
|---|---|---|
| **通訊協定** | Redfish REST + WebSocket | Redfish REST + IPMI + SSH |
| **資料格式** | 自定義 JSON (近似 Redfish schema) | 嚴格 Redfish v1.x DMTF schema |
| **認證** | 無（開發模式） | Basic Auth / Session Token / TLS mTLS |
| **資料來源** | `data-generator.js` 隨機模型 | 實體感測器（DIMM、VRM、GPU die）|
| **溫度模型** | `smoothRandom()` 平滑隨機遊走 | 真實傳感器讀數 ±0.5°C |
| **Panic 模式** | API 觸發 → 溫度跳升至 90-105°C | 真實過熱 → BMC 自動降頻/關機 |
| **GPU 數量** | 固定 72 顆/台 | 依機型而異（72 for NVL72, 8 for HGX H100） |
| **更新頻率** | 固定 1 次/秒 push | 依訂閱設定，通常 1-30 秒 polling |
| **液冷數據** | 單一流速值 | 多迴路：CDU 進出水溫、壓力、流量計 |
| **NVLink 指標** | 隨機生成頻寬% | `nvidia-smi nvlink --status` 真實 Tx/Rx bytes |
| **PSU 數據** | 6 個效率值 | PMBus 讀數：電壓、電流、功率、效率、風扇 RPM |
| **Event Log** | ✅ 19 種事件類型的 SEL 模擬（Ring buffer 500 筆） | SEL (System Event Log) 完整事件紀錄 |
| **韌體資訊** | 無 | BMC FW / BIOS / GPU driver 版本查詢 |
| **GPU ECC** | ✅ DCGM 風格模擬（SRAM/DRAM CE/UE、Retired Pages、XID） | nvidia-smi / DCGM 真實讀取 |
| **NVSwitch** | ✅ 4th-gen 模擬（2×64 ports、00 GB/s each） | NVSM / nvswitch-audit 真實讀取 |
| **Webhook** | ✅ PagerDuty/Slack/Generic (Dry-run) | 真實 HTTP POST + 重試機制 |
| **Auto-remediation** | ✅ 5 個 Ansible-style Playbook 模擬執行 | Ansible / Salt / 自定義 Operator |

### 數據真實度分析

| 指標 | 模擬範圍 | 真實典型範圍 | 差異說明 |
|---|---|---|---|
| GPU 溫度 | 30-105°C | 25-95°C | 模擬上限稍高，真實 BMC 會在 ~90°C 觸發保護 |
| 入水溫度 | 18-35°C | 15-35°C | 取決於 CDU (Coolant Distribution Unit) 設定 |
| 出水溫度 | 25-65°C | 30-55°C | 模擬偏高，真實液冷效率更好 |
| 冷卻流速 | 5-18 L/min | 2-25 L/min | 依冷板規格，模擬範圍合理 |
| 機框功耗 | 5,000-15,000 W | 8,000-17,000 W | GB200 NVL72 TDP 約 14.4 kW |
| PUE | 1.0-2.5 | 1.05-1.4 | 模擬上限偏高，現代液冷機房 PUE < 1.2 |
| GPU 使用率 | 0-100% | 0-100% | 合理，取決於訓練/推論工作負載 |
| NVLink 頻寬 | 隨機 0-100% | 與通訊模式強相關（AllReduce vs P2P） |
| PSU 效率 | 80-99% | 89-97% | 鉑金/鈦金等級 PSU 典型範圍 |

### 模擬器的簡化之處

1. **無熱力學關聯性**：真實系統中，相鄰 GPU 的溫度高度相關（共享冷板/散熱氣流），模擬器的 72 顆 GPU 溫度各自獨立隨機
2. **無工作負載模型**：真實環境中 GPU 溫度與使用率強正相關，模擬器的相關性較弱
3. **無故障狀態機**：真實 BMC 有明確的故障狀態轉移（Normal → Caution → Critical → Shutdown），模擬器只有 Normal 和 Panic 兩態
4. **無網路拓撲延遲**：真實 Redfish 呼叫有網路延遲 50-500ms，模擬器為本機直連
5. **無認證與授權**：真實 BMC 需要 session 管理與 RBAC 權限控制
6. **ECC 計數器為模擬**：真實 DCGM 的 ECC 錯誤類型更多樣（含 Row Remapper 詳細狀態、SRAM 區域定位等）
7. **NVSwitch 簡化**：真實系統的 NVSwitch 有更複雜的路由拓撲、QoS 策略和多路徑對稱
8. **Webhook Dry-run**：目前預設為 Dry-run 模式，不會真的發送 HTTP POST。對接真實服務時需設定實際 URL 並關閉 dryRun
9. **Remediation 模擬執行**：Playbook 的步驟執行是延遲模擬，未真正呼叫 Ansible / BMC 控制 API

---

## 4. Web Worker 批次處理管線

### 為什麼使用 Web Worker

瀏覽器主線程每幀只有 ~16ms（60 FPS）的時間預算。若在主線程處理 100 台 × 72 GPU 的數據（展平、統計、降採樣、異常偵測），將佔用 4-8ms，壓縮了 Pixi.js 的渲染時間。Web Worker 將全部數據運算移至獨立線程：

```
主線程 (16ms/frame)
├── React reconciliation   ~2ms
├── Pixi.js render calls   ~4ms
├── DOM updates            ~1ms
└── Idle                   ~9ms  ← 不被數據運算阻塞

Worker 線程 (獨立)
├── Flatten temps          ~0.5ms
├── processServerBatch     ~1ms
├── LTTB × 100             ~2ms
├── detectAnomalies        ~0.3ms
├── Aggregation            ~0.2ms
├── SAB write + swap       ~0.1ms
└── postMessage            ~0.5ms
Total: ~4.6ms / tick
```

### 處理管線詳細步驟

```typescript
// telemetry.worker.ts 核心流程

① 接收: self.onmessage({ type: 'telemetry_batch', payload: ServerTelemetry[100] })

② 展平: Float32Array(100 × 72) ← 取出所有 gpuCoreTemps
   // 消除物件解構開銷，轉為連續記憶體布局

③ 批次摘要: processServerBatch(allTemps, 100, 72) → Float32Array(300)
   // 每台輸出 [avgTemp, maxTemp, anomalyScore]
   // anomalyScore = clamp((maxTemp - 75) / 30, 0, 1)

④ 趨勢緩衝: 每台維護 Map<serverId, number[]>，最多 60 點
   // push(avgTemp) → 超過容量則 shift()

⑤ LTTB 降採樣: 60 → 30 點，保留視覺特徵
   // Largest Triangle Three Buckets 演算法
   // 比簡單的 stride sampling 保留更多極值

⑥ 異常偵測: detectAnomalies(100 avgTemps, window=5, threshold=2.0)
   // 滑動窗口計算 μ ± 2σ，偏離度 ∈ [0, 1]

⑦ 聚合: totalWattage, avgPUE, alertCount(anomaly > 0.5)

⑧ SAB: if(sharedBuffers) → write → Atomics swap

⑨ postMessage: { summaries, sparklines, anomalyScores, aggregation, rawBatch }
```

### 效能考量

| 問題 | 解法 |
|---|---|
| JSON 序列化開銷 | rawBatch 仍走 structured clone，但 summaries 用 Float32Array transferable |
| 大陣列拷貝 | SharedArrayBuffer 路徑完全零拷貝 |
| 記憶體累積 | sparklineBuffers 使用 shift() 保持固定 60 長度 |
| Worker 初始化延遲 | 使用 ES module worker，Vite 自動打包 |

---

## 5. SharedArrayBuffer 雙緩衝機制

### 設計動機

傳統 `postMessage` 需要序列化 → 傳輸 → 反序列化，對於每秒 100 台 × 150 floats 的數據量：

| 方式 | 每秒開銷 | Latency |
|---|---|---|
| JSON postMessage | ~50 KB serialize + ~50 KB deserialize | ~2ms |
| Transferable | 零拷貝但 **單向轉移所有權** | ~0.1ms |
| SharedArrayBuffer | **雙向零拷貝** | ~0.01ms |

### 雙緩衝記憶體布局

```
SharedArrayBuffer 配置:

controlSAB (4 bytes):
┌─────────────────────┐
│ activeIndex: Int32   │  ← Atomics.load / store
│ (0 or 1)            │
└─────────────────────┘

dataSAB0 (60,000 bytes = 100 servers × 150 floats × 4 bytes):
┌──────────────────────────────────────────────────┐
│ Server 0:  [avg, max, anomaly, gpu0..71 temps,   │
│             gpu0..71 utils, wattage, pue, flow]  │ ← 150 floats
│ Server 1:  [...]                                 │
│ ...                                              │
│ Server 99: [...]                                 │
└──────────────────────────────────────────────────┘

dataSAB1 (60,000 bytes): ← 相同布局，交替使用
┌──────────────────────────────────────────────────┐
│ (同上)                                            │
└──────────────────────────────────────────────────┘
```

### 讀寫協定

```
Worker 線程:                         主線程 (Reader):
─────────────                        ─────────────
① Atomics.load(control, 0) → 0     
   → writeBuffer = dataSAB1         
② 寫入 dataSAB1[0..14999]          
③ Atomics.store(control, 0, 1)     
④ Atomics.notify(control, 0)       ← ⑤ 收到通知 / 下次讀取
                                     ⑥ Atomics.load(control, 0) → 1
                                        → readBuffer = dataSAB1
                                     ⑦ 從 dataSAB1 讀取最新數據

(下一 tick)
① Atomics.load(control, 0) → 1
   → writeBuffer = dataSAB0
② 寫入 dataSAB0[0..14999]
③ Atomics.store(control, 0, 0)
④ Atomics.notify(control, 0)
...
```

### 必要的 HTTP Headers

`SharedArrayBuffer` 要求頁面處於 cross-origin isolated 狀態：

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Vite dev server 已在 `vite.config.ts` 中設定這些 headers。若不支援（如 Safari < 16.4），系統自動 fallback 至 structured clone。

---

## 6. Rust-Wasm 數據處理引擎

### 函式清單

| 函式 | 複雜度 | TypeScript 回退 | 說明 |
|---|---|---|---|
| `lttb_downsample(data, target)` | O(n) | ✅ `processor-fallback.ts` | LTTB 最大三角形降採樣 |
| `detect_anomalies(data, window, σ)` | O(n) | ✅ | 滑動窗口 μ ± kσ 偵測 |
| `process_server_batch(temps, N, G)` | O(N×G) | ✅ | 批次計算 avg/max/anomaly |
| `ema_smooth(data, α)` | O(n) | ✅ | 指數移動平均 |
| `RingBuffer` struct | O(1) push | ✅（JS Array） | 固定容量環形緩衝區 |

### Wasm vs TS 效能差異

| 操作 | Wasm | TypeScript | 加速比 |
|---|---|---|---|
| `process_server_batch` (100×72) | ~0.3ms | ~1.0ms | **3.3×** |
| `lttb_downsample` (60→30) × 100 | ~0.5ms | ~1.5ms | **3.0×** |
| `detect_anomalies` (100 points) | ~0.05ms | ~0.15ms | **3.0×** |

> 在 100 台伺服器的規模下，TypeScript 回退已足夠（<4ms/tick）。Wasm 的優勢在 1,000+ 台時才顯著。

### 當前狀態

專案內含完整的 Rust 原始碼（`packages/wasm-processor/src/lib.rs`），但預設使用 TypeScript 回退以簡化開發流程。執行 `npm run build:wasm` 可啟用 Wasm 路徑。

---

## 7. GLSL Shader 特效管線

### Shader 檔案結構

所有 Shader 定義在 `src/shaders/gpu-effects.ts`，包含三套 Fragment Shader：

#### 高溫輝光 Shader（Glow）

```glsl
// 核心邏輯（簡化版）
float dist = distance(vTextureCoord, vec2(0.5));
float pulse = sin(uTime * 3.0) * 0.15 + 0.85;
float glowStrength = uIntensity * pulse * smoothstep(0.6, 0.0, dist);
```

- `uIntensity`：由 anomaly score (0-1) 驅動，越高越亮
- `uTime`：由 Pixi.js ticker 每幀推進，產生脈動效果
- 邊緣光暈：`smoothstep(0.3, 0.5, dist)` 在方塊邊緣產生輝光
- 臨界閃爍：`uIntensity > 0.7` 時額外疊加高頻正弦閃爍

#### 數據流光條紋 Shader（Stripe）

```glsl
float stripe = sin((uv.x + uv.y) * 20.0 - uTime * uSpeed * 5.0);
float stripe2 = sin((uv.x - uv.y * 0.5) * 30.0 - uTime * uSpeed * 3.0);
```

- 雙層對角條紋，速度由 `uSpeed` 控制
- 透明度由 `uBandwidth` (NVLink 使用率) 調節
- 掃描線效果：`sin(uv.y * 50.0 - uTime * 2.0)` 垂直掃描

#### 熱力方塊組合 Shader（HeatCell）

整合上述兩種效果，用於 RackHeatmap 每個格子：

- `uAnomaly` → 控制輝光強度
- `uBandwidth` → 控制流光密度
- `uCellColor` → 由溫度色彩映射決定（green → yellow → red）

### Pixi.js 整合方式

```typescript
// 建立時
const filter = createHeatCellFilter();
cell.filters = [filter];

// 每幀更新（ticker）
filter.uniforms.uTime = elapsed;

// 每秒更新（telemetry tick）
filter.uniforms.uAnomaly = anomalyScore;
filter.uniforms.uCellColor = hexToRgb(tempColor);
```

---

## 8. AI/ML 預測引擎（Demo）

### 目前狀態

**這是可行性展示（Proof of Concept），尚未套入真實 AI/ML 模型。** 所有「預測」均由確定性演算法或啟發式規則產生，標示為 `⚠ Demo mode — simulated ML inference`。

### 模擬的 ML 模組

| 模組 | 模擬方法 | 真實 ML 替代方案 |
|---|---|---|
| **ThermalPredictor** | 雙指數平滑法（Holt's method）外推 | LSTM / Transformer 時序預測 |
| **FailurePredictor** | Weibull 分佈啟發式 + 溫度/功耗壓力指數 | Cox 比例風險模型 / Survival Analysis |
| **CapacityPlanner** | 線性增長率外插 | Prophet / ARIMA 時序分解 |
| **Fleet Health Index** | 加權扣分（溫度>80 扣0.5, >90 扣2, PSU<88 扣1） | 多變量主成分分析（PCA）+ 異常分數 |

### ThermalPredictor 演算法

```typescript
// 雙指數平滑（Holt Linear Trend Method）
α = 0.3    // level 平滑係數
β = 0.1    // trend 平滑係數

for each observation:
  level = α × value + (1-α) × (level + trend)
  trend = β × (level - prevLevel) + (1-β) × trend

forecast(h) = level + trend × h + noise
```

### FailurePredictor 演算法

```typescript
// Weibull 風格的故障概率
tempStress = max(0, (maxTemp - 70) / 35)
failProb = 1 - exp(-tempStress^2.5)    // Weibull shape ≈ 2.5

// 不同組件有不同的應力函數:
GPU Module:  f(tempStress)     — 溫度驅動
PSU:         f(95 - minPsuEff) — 效率退化驅動
NVLink:      f(maxBandwidth)   — 壅塞驅動
Coolant:     f(1 - flowRate/15)— 流量不足驅動
```

### 如何替換為真實 ML

1. **訓練時序模型**：收集數週的歷史遙測數據 → 訓練 LSTM/Transformer → 匯出為 ONNX 或 TF SavedModel
2. **部署推論服務**：建立 Python FastAPI 或 TF Serving，提供 `/predict` REST 端點
3. **前端對接**：`MLPredictionEngine.tsx` 中的静態函式替換為 `fetch('/api/ml/predict', { body: ... })`
4. **替代方案（瀏覽器端）**：使用 TensorFlow.js 載入 `tfjs-model`，在 Worker 中執行推論，零後端依賴

---

## 9. 告警規則引擎運作原理

### 規則結構

```typescript
interface AlertRule {
  id: string;
  metric: 'gpu_temp' | 'gpu_util' | 'power' | 'coolant_flow';
  operator: '>' | '<' | '>=' | '<=';
  threshold: number;
  durationSec: number;           // 持續觸發秒數才告警
  enabled: boolean;
  combineWith?: {                // AND 複合條件（選用）
    metric: string;
    operator: string;
    threshold: number;
  };
}
```

### 評估流程

```
每秒 tick:
  for each rule (if enabled):
    for each server:
      ① 取得 metric 值（如 max GPU temp）
      ② 檢查 primary condition: value > threshold?
      ③ 若有 combineWith → 檢查 secondary condition
      ④ primary AND secondary 都通過 → 記錄觸發時間至 Map
      ⑤ 計算持續時間: now - firstTriggeredAt
      ⑥ 若持續時間 >= durationSec → 產生告警
      ⑦ 若條件不再滿足 → 清除觸發記錄
```

### 預設規則

| 規則 | 條件 | 持續 |
|---|---|---|
| High GPU Temp (3min) | `gpu_temp > 85 AND gpu_util > 90` | 180s |
| Critical Temp | `gpu_temp > 95` | 30s |
| Low Coolant Flow | `coolant_flow < 5` | 60s |
| Power Spike | `power > 12000` | 120s（預設停用）|

---

## 10. v3 企業級子系統架構

本節詳細說明 v3 新增的 9 個子系統的架構設計、數據流與參數設定。

### 10.1 InfluxDB 時序緩衝引擎

**檔案**：`simulator/src/influxdb-buffer.js`

模擬 InfluxDB 2.x 的 In-memory 時序儲存，支援 Line Protocol 格式寫入與 Flux 風格查詢。

```
每秒 tick:
  writeTelemetryBatch(servers[100]):
    → thermal measurement: inletTemp, outletTemp, flowRate (tag: serverId, rack)
    → power measurement: wattage, pue, psuEfficiency (tag: serverId, rack)
    → compute measurement: avgGpuUtil, avgHbm3e, avgNvlink (tag: serverId, rack)
    → 共 300 data points / tick = 18,000 points / min
    → 1小時滾動保留 → auto-eviction by timestamp
```

**查詢 API 參數**：

| 參數 | 類型 | 說明 |
|---|---|---|
| `measurement` | string | `thermal` / `power` / `compute` |
| `tags` | object | `{ serverId: "0", rack: "Rack-0" }` |
| `range` | object | `{ start: "-1h", stop: "now()" }` |
| `aggregateWindow` | object | `{ every: "5m", fn: "mean" }` — 支援 mean/max/min/last/sum |

**Docker 整合**：docker-compose.yml 配置 InfluxDB 2.7（port 8086），org: `omnicenter`，bucket: `telemetry`。目前模擬器使用 in-memory buffer；切換至真實 InfluxDB 僅需替換 `writeTelemetryBatch` 為 HTTP POST 至 `/api/v2/write`。

---

### 10.2 GPU ECC 錯誤追蹤（DCGM 風格）

**檔案**：`simulator/src/gpu-ecc-generator.js`  
**前端**：`components/GPUEccTracker.tsx`

模擬 NVIDIA Data Center GPU Manager (DCGM) 的 ECC 錯誤計數器，每台伺服器 72 顆 GPU 各自追蹤：

| 計數器 | 正常速率 | Panic 速率 | 真實參考 |
|---|---|---|---|
| SRAM Correctable | ~0.01/GPU/tick | ~0.08/GPU/tick | `dcgmi diag -r 3` |
| SRAM Uncorrectable | ~0.0005 | ~0.005 | 觸發 XID 94 |
| DRAM (HBM3e) Correctable | ~0.005 | ~0.04 | HBM3e ECC scrubbing |
| DRAM Uncorrectable | ~0.00002 | ~0.0002 | 觸發 XID 63 / page retirement |
| Retired Pages (Single) | 開機隨機 0-2 | — | `nvidia-smi -q -d RETIRED_PAGES` |
| PCIe Replay Count | 開機隨機 0-4 | — | PCIe link retraining |
| XID Errors (94/63) | 依 UE 觸發 | — | NVIDIA XID Error Code |

**Fleet 統計摘要**：WebSocket 每秒推送 `ecc_summary`，包含全域 totalSramCE、totalDramUE、gpusWithXidErrors 等。

**前端功能**：
- Fleet 卡片：Correctable / Uncorrectable / Retired Pages / XID Servers
- 可排序表格（依 UE/CE/retired/XID），支援「僅顯示異常」篩選
- 紅色高亮 uncorrectable errors

---

### 10.3 NVSwitch Fabric 監控

**檔案**：`simulator/src/nvswitch-generator.js`  
**前端**：`components/NVSwitchMonitor.tsx`

模擬 NVSwitch 4th-gen（GB200 NVL72 架構）：每台伺服器 2 顆 NVSwitch，每顆 64 個 NVLink 5.0 ports（100 GB/s 單向）。

| 指標 | 範圍 | 真實參考 |
|---|---|---|
| Switch 溫度 | 55-85°C | NVSM thermal sensor |
| 供電電壓 | ~0.78V ±0.03 | VRM telemetry |
| Switch 功耗 | 120-180W | Board power sensor |
| Port 狀態 | active/degraded/down | NVLink link status |
| Per-port Tx/Rx 頻寬 | 0-100 GB/s | nvlink counters |
| Link 延遲 | 400-800 ns | Fabric hop latency |
| CRC/ECC 錯誤 | 低頻隨機 | Link error counters |

**WebSocket 推送**：每秒發送 `nvswitch_summary`，包含 fleet 總吞吐 (TB/s)、最高溫度、degraded links 數。

**前端功能**：
- Fleet 統計卡片：總吞吐 / 最高溫度 / Degraded Links / 總功耗
- 每台伺服器 2 NVSwitch 卡片：溫度 / 電壓 / 功耗 / 64-port 狀態條
- Port 狀態以顏色表示（綠=active、黃=degraded、紅=down）
- TX/RX 頻寬、延遲、CRC/Fatal 錯誤
- 點擊展開詳細 port 級資訊

---

### 10.4 SEL 事件系統

**檔案**：`simulator/src/event-generator.js`  
**前端**：`components/EventTimeline.tsx`

模擬 IPMI System Event Log (SEL) 的事件產生器，支援 19 種事件類型：

```
Temperature Threshold | Temperature Critical | PSU Status Change | PSU Redundancy
Fan Failure | ECC Correctable Error | ECC Uncorrectable Error | NVLink State Change
NVSwitch Error | Power Cycle | BMC Firmware Event | Watchdog Timer
Chassis Intrusion | Coolant Flow Alert | GPU Thermal Throttle | NVIDIA XID Error
Memory Training | System Boot | Auto-Remediation
```

**設計**：
- 每秒根據遙測數據門檻自動生成事件（如 GPU > 85°C → Temperature Threshold）
- Ring buffer 500 筆，FIFO 淘汰
- 每筆事件包含：id、timestamp、severity (critical/warning/info)、type、serverId、message、resolved 狀態

**前端功能**：
- 時間軸佈局：時間線連接器 + 嚴重度色點 + 類型 emoji 圖示
- 嚴重度篩選（All / Critical / Warning / Info）
- 自動捲動切換
- Resolve 按鈕標記已解決

---

### 10.5 Webhook 通知管理器

**檔案**：`simulator/src/webhook-manager.js`  
**前端**：`components/WebhookSettings.tsx`（Webhooks 頁籤）

3 種預設通道：

| 通道 | Payload 格式 | 預設狀態 |
|---|---|---|
| PagerDuty | Events API v2 (`routing_key` + `event_action: trigger`) | 停用 |
| Slack | Incoming Webhook (attachments 格式) | 停用 |
| Generic HTTP | JSON (`{ alert, server, timestamp, severity }`) | 停用 |

**特性**：
- 每通道獨立啟停、URL 設定、Rate limiting（預設 5分鐘/unique alert）
- **Dry-run 模式**（預設開啟）：不實際發送 HTTP POST，僅記錄 payload
- 派發歷史 Ring buffer 200 筆
- Alert → Webhook 派發時機：每秒 tick 檢查 events 中的 critical 事件

---

### 10.6 自動修復引擎 (Auto-remediation)

**檔案**：`simulator/src/remediation-engine.js`  
**前端**：`components/WebhookSettings.tsx`（Playbooks 頁籤 + History 頁籤）

5 個 Ansible-style Playbook：

| # | Playbook | 觸發條件 | 成功率 | Cooldown |
|---|---|---|---|---|
| 1 | Thermal Throttle Mitigation | GPU > 90°C | 85% | 5 min |
| 2 | GPU ECC Error Response | ECC UE > 0 | 70% | 10 min |
| 3 | NVLink Degraded Link Recovery | NVLink degraded detected | 90% | 3 min |
| 4 | PSU Redundancy Failover | PSU efficiency < 85% | 95% | 15 min |
| 5 | Coolant Flow Recovery | Flow rate < 5 L/min | 80% | 5 min |

**執行流程**：
```
每秒 tick → evaluateAndExecute(telemetry, eccData, nvswitchData)
  → 逐一檢查 playbook 觸發條件
  → 符合條件 → 檢查 cooldown
  → 建立 execution context → 模擬逐步驟執行（setTimeout 延遲）
  → 每步驟成功/失敗判定 → 更新 execution 記錄
  → 完成 → 寫入 event log（Auto-Remediation 事件）
  → 統計成功率
```

**前端功能**：
- Playbooks 頁籤：啟停切換、觸發條件描述、步驟列表、Cooldown/Duration 資訊、成功率
- History 頁籤：執行歷史列表，含狀態圖示、步驟完成指標、耗時

---

### 10.7 3D 資料中心視圖 (Three.js)

**前端**：`components/DataCenter3D.tsx`（React.lazy 延遲載入）

使用 Three.js 建構等角投影的 3D 機房模型：

| 元素 | 規格 | 說明 |
|---|---|---|
| 機櫃 | 10 個（2×5 網格） | 半透明線框 BoxGeometry |
| 伺服器 | 100 個（每櫃 10 台） | 小型 Box，顏色依 anomaly 映射 |
| LED 指示燈 | 100 個 | 紅(critical)/黃(warning)/綠(normal) 球體 |
| CDU 冷卻塔 | 1 個 | 圓柱體 + 冷卻管路線條 |
| 地板格線 | 自動生成 | GridHelper |
| 環境 | Fog + 環境光 + 方向光 | ACES filmic tone mapping |

**互動**：
- OrbitControls：拖曳旋轉、滾輪縮放、右鍵平移
- Raycaster 點擊：選取伺服器 → 更新主面板
- Mousemove：Tooltip 顯示伺服器 ID 與溫度
- Camera 初始位置：(18, 14, 18) 俯視

**效能考量**：
- Lazy-loaded（`React.lazy`），不開啟時零開銷
- 100 個 Mesh 在現代 GPU 上完全無壓力
- Canvas 高度固定 320px，限制 pixel fill rate
- 使用 `requestAnimationFrame` 獨立渲染迴圈

---

### 10.8 伺服器搜尋與篩選

**前端**：`components/ServerFilter.tsx` + `RackHeatmap.tsx`（filteredIds 支援）

| 篩選維度 | 選項 |
|---|---|
| 文字搜尋 | 依 Server ID 即時比對 |
| 狀態篩選 | All / Normal / Warning / Critical |
| 機櫃篩選 | Rack 0 ~ Rack 9 |
| 排序 | ID / 溫度 / 功耗 / 異常分數 |

篩選結果傳入 `RackHeatmap`，未匹配的伺服器 alpha 降至 0.25 + 背景透明度降低，產生「聚焦」效果。

---

### 10.9 Grafana 整合與 Dashboard Provisioning

**基礎設施**：`docker-compose.yml` + `grafana/` 目錄

```yaml
# docker-compose.yml 中新增的服務
influxdb:     # InfluxDB 2.7, port 8086
grafana:      # Grafana 10.4.0, port 3000 (admin/omnicenter)
```

**自動 Provisioning**：
- `grafana/provisioning/datasources/influxdb.yml` → InfluxDB Flux 數據源
- `grafana/provisioning/dashboards/dashboard.yml` → Auto-load dashboard JSON
- `grafana/dashboards/omnicenter.json` → 9 面板 Dashboard

#### Grafana 的定位：歷史分析 vs 即時監控

本專案同時存在兩套可視化系統，各司其職：

| 比較維度 | React + Pixi.js + Three.js Dashboard | Grafana Dashboard |
|---|---|---|
| **角色** | 主要操作介面（NOC 即時戰情室） | 輔助分析工具（歷史趨勢 / 容量規劃） |
| **數據傳输** | WebSocket 推送（Push），每秒即時更新 | InfluxDB Flux 查詢（Pull），使用者自訂時間範圍 |
| **視覺化** | 高度客製化：Pixi.js Canvas 熱力圖、Three.js 3D 等角機房、GLSL Shader 光效、粒子流動動畫、NVLink 拓撲、GPU 火焰圖 | 標準圖表庫：折線圖 (timeseries)、gauge、histogram、表格，透過 JSON 設定 |
| **互動能力** | 鍵盤快捷鍵導航、Raycaster 3D 點擊下鑽、批次操作、告警規則 CRUD、自動修復觸發、伺服器篩選排序 | Grafana 原生：時間範圍拖曳、Dashboard 變數篩選、Annotation、Alert rules |
| **部署方式** | 獨立運行（`npm run dev`）或靜態部署（GitHub Pages），無需後端依賴 | 必須透過 Docker Compose 啟動，依賴 InfluxDB 資料源 |
| **開發成本** | 所有 UI 元件從零建構（React + Canvas API + WebGL） | 零程式碼，編輯 JSON 即可新增/修改面板 |
| **典型問題** | 「這台伺服器現在怎麼了？要不要重啟？」 | 「過去 6 小時 GPU 溫度的趨勢？冷卻液流速有無遞減？」 |

**為什麼需要兩者？**

在真實資料中心監控場景中，這兩種工具通常會同時部署：
- **操作員（NOC）** 使用自建 React Dashboard 進行 7×24 值班盯盤，即時反應異常並執行操作（重啟、功耗調整、批次維護）
- **SRE / 基礎設施工程師** 使用 Grafana 做事後回溯（root cause analysis）、長期趨勢觀測、容量規劃報表，並設定 Grafana Alerting 做為次要告警通道

#### 資料流架構

```
                        ┌─────────────────────────────────────────┐
                        │        BMC 模擬器 (Fastify)              │
                        │   data-generator.js (每秒 100 台遙測)     │
                        └────────────┬──────────────┬─────────────┘
                                     │              │
                    WebSocket 推送    │              │  寫入 InfluxDB
                    (即時 4 種訊息)   │              │  Line Protocol
                                     ▼              ▼
                        ┌────────────────┐  ┌──────────────────┐
                        │ React Dashboard│  │ InfluxDB 2.7     │
                        │ (Pixi/Three.js)│  │ (Docker, port    │
                        │ port 5173      │  │  8086)           │
                        │                │  └────────┬─────────┘
                        │ 即時操作監控    │           │ Flux 查詢
                        └────────────────┘           ▼
                                            ┌──────────────────┐
                                            │ Grafana 10.4     │
                                            │ (Docker, port    │
                                            │  3000)           │
                                            │                  │
                                            │ 歷史趨勢分析     │
                                            └──────────────────┘
```

#### 啟動方式

```bash
# 需要 Docker Desktop 已安裝並運行
docker-compose up --build

# 服務入口
# Grafana:   http://localhost:3000  (admin / omnicenter)
# InfluxDB:  http://localhost:8086  (org: omnicenter, bucket: telemetry)
# Dashboard: http://localhost:5173
# Simulator: http://localhost:3001
```

> ⚠️ 純 `npm run dev` 模式不包含 Grafana 與 InfluxDB，僅啟動 Simulator + React Dashboard。

**Dashboard 面板**：

| 面板 | 類型 | Flux 查詢 |
|---|---|---|
| Fleet GPU Temperature | timeseries | `thermal` → `inletTemp`, `outletTemp` |
| Total Fleet Power | timeseries | `power` → `wattage` |
| Average PUE | gauge | `power` → `pue` → mean |
| GPU Utilization | gauge | `compute` → `avgGpuUtil` → mean |
| Coolant Flow Rate | timeseries | `thermal` → `flowRate` |
| HBM3e Memory Usage | timeseries | `compute` → `avgHbm3e` |
| NVLink Bandwidth | timeseries | `compute` → `avgNvlink` |
| PSU Efficiency | histogram | `power` → `psuEfficiency` |
| Inlet vs Outlet Temp | timeseries | `thermal` → 雙 Y 軸 |

---

## 11. 串接真實系統所需改動

### 階段 1：替換數據源（最小改動）

只需修改 `DataSource.ts`，將 WebSocket 端點指向真實 BMC 聚合層：

```typescript
// 目前
const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

// 改為
const wsUrl = `${protocol}//bmc-aggregator.internal:8080/ws/telemetry`;
```

需要新增的中間層：**BMC Aggregator Service**

```
[BMC 1] ─ Redfish ─┐
[BMC 2] ─ Redfish ──┤─→ [Aggregator] ─ WebSocket ─→ [Dashboard]
[BMC N] ─ Redfish ──┘
```

Aggregator 負責：
- 對每台 BMC 輪詢 Redfish API（或 SSE 訂閱）
- 彙整為統一的 `TelemetryBatch` JSON 格式
- 透過 WebSocket 推播至前端

### 階段 2：Redfish 協定適配

需要修改的檔案與位置：

| 檔案 | 修改內容 |
|---|---|
| `types.ts` | 擴充型別以匹配真實 Redfish schema（如加入 `Status.State`、`Status.Health`、`EventLog`） |
| `DataSource.ts` | 新增 Redfish session 認證（`X-Auth-Token`）、SSL/TLS 設定 |
| `data-generator.js` | 完全移除（由真實 BMC 替代） |
| `telemetry.worker.ts` | 數據欄位映射可能需要微調（如真實 NVLink 回報的是 bytes/s 而非百分比） |
| 新增 `RedfishAdapter.ts` | Redfish JSON → 內部 `ServerTelemetry` 的映射層 |

### 階段 3：認證與安全

| 需求 | 實作方式 |
|---|---|
| 前端認證 | OAuth2 → JWT，React context 管理 token |
| BMC 認證 | Aggregator 使用 Redfish Session Login + Token Management |
| 傳輸加密 | WSS (TLS 1.3)，BMC 端需信任 CA |
| 權限控制 | RBAC：Admin（可 Panic/Reset/批次操作）、Viewer（唯讀）|

### 階段 4：持久化與歷史查詢

| 元件 | 選型建議 |
|---|---|
| 時序資料庫 | InfluxDB 3 或 TimescaleDB |
| 告警持久化 | PostgreSQL + 告警歷史表 |
| 日誌 | Loki / Elasticsearch |
| 查詢 API | GraphQL（Hasura on TimescaleDB）或 REST |

---

## 12. 注意事項與已知限制

### 瀏覽器相容性

| 功能 | 最低版本 | Fallback |
|---|---|---|
| SharedArrayBuffer | Chrome 92+, Firefox 79+, Safari 16.4+ | 自動退回 structured clone |
| Pixi.js WebGL | 所有現代瀏覽器 | Canvas 2D fallback（Pixi.js 內建）|
| GLSL Fragment Shader | WebGL 1.0+ | 不渲染 Shader，視覺效果退化但不影響功能 |
| Web Worker ES Module | Chrome 80+, Firefox 114+ | ——（必要功能）|
| CSS `backdrop-filter` | Chrome 76+, Firefox 103+ | 無模糊效果 |
| Three.js WebGL | Chrome 56+, Firefox 51+ | 隱藏 3D 視圖按鈕（需 WebGL 2.0）|

### SharedArrayBuffer 注意事項

1. **COOP/COEP Headers 必須**：若部署至非 localhost 環境，Web server 必須回傳 `Cross-Origin-Opener-Policy: same-origin` 和 `Cross-Origin-Embedder-Policy: require-corp`
2. **iframe 限制**：嵌入至 iframe 時，父頁面也需要相同 headers
3. **DevTools 影響**：Chrome DevTools 開啟 Performance 面板時可能干擾 Atomics.wait（本專案使用 notify 不受影響）

### GLSL Shader 注意事項

1. **精度**：使用 `precision mediump float`，在部分 Android 裝置上可能有精度問題
2. **效能**：100 個 Filter 在低端 GPU 可能造成壓力，建議在 anomaly < 0.1 的伺服器關閉 Shader
3. **相容性**：Pixi.js v7 的 Filter 建構函式在 v8 中已改用 `FilterSystem`，升級時需調整

### 數據規模限制

| 參數 | 目前值 | 理論上限（60 FPS）| 突破方案 |
|---|---|---|---|
| 伺服器數 | 100 | ~300（Canvas 2D）| WebGPU instance rendering |
| GPU / 台 | 72 | 不變 | 僅顯示摘要 |
| 更新頻率 | 1 Hz | 5 Hz | 差量更新 + Protobuf |
| Sparkline history | 60 points | 300 points | 離線壓縮 + 按需查詢 |

### i18n 注意事項

- 翻譯鍵定義在 `src/i18n/locales/*.ts`，新增語系只需新增對應檔案並在 `src/i18n/index.ts` 註冊
- 語言偏好存於 `localStorage('omnicenter-lang')`
- 動態內容（如告警訊息）目前仍為英文固定值，需進一步國際化

### v3 子系統注意事項

1. **Webhook Dry-run 模式**：預設所有 Webhook 為 dry-run + disabled，不會發送真實 HTTP 請求。整合真實 PagerDuty/Slack 時需手動設定 URL 並關閉 dryRun
2. **Remediation 模擬執行**：Playbook 步驟以 setTimeout 延遲模擬執行，未實際呼叫 Ansible API 或 BMC 控制端點
3. **InfluxDB Buffer 為 In-memory**：重啟後資料清空。切換至 Docker InfluxDB 需替換寫入函式（Line Protocol 格式已相容）
4. **ECC 計數器簡化**：真實 DCGM 的 ECC 錯誤有更細粒度的區域定位（bank/row address），模擬器僅追蹤全域計數
5. **NVSwitch Port 數量**：真實 GB200 NVL72 的 NVSwitch 有更複雜的多層拓撲，模擬為扁平 64-port 結構
6. **Three.js 記憶體**：3D 視圖會佔用 ~30-50 MB GPU 記憶體（100 meshes + materials + textures），關閉時 Lazy-load 保證零開銷
7. **WebSocket 頻寬增加**：v3 每秒推送 4 種訊息（telemetry + events + ecc + nvswitch），總頻寬約 ~450 KB/s（較 v2 增加約 30%）
8. **Event Ring Buffer 上限**：500 筆事件滿後 FIFO 淘汰，不支援歷史查詢。需要長期儲存應串接 InfluxDB 或 Elasticsearch
9. **Grafana 需要 Docker**：Grafana 面板僅在 `docker-compose up` 時可用，純 `npm run dev` 不含 Grafana

### 延續擴充建議

以下為各模組可直接延續擴充的方向，不需架構重構：

| 模組 | 可擴充方向 | 複雜度 |
|---|---|---|
| **GPU ECC Tracker** | 新增 ECC 趨勢圖（時序）、退頁預測（何時達到閾值）、DCGM Job Stats 模擬 | 中 |
| **NVSwitch Monitor** | 新增拓撲圖視覺化（NVSwitch ↔ GPU 連線圖）、traffic 熱力圖、QoS 面板 | 中 |
| **Event Timeline** | 新增事件關聯分析（同時段多事件聚合）、匯出 CSV/JSON、事件統計面板 | 低 |
| **Webhook** | 新增 Teams/Discord 通道、自定義 payload template、Retry with backoff | 低 |
| **Remediation** | 新增自定義 Playbook 建立 UI、steps editor、execution 甘特圖 | 中 |
| **3D View** | 新增 LOD（Level of Detail）、機櫃內部展開、散熱氣流粒子動畫 | 高 |
| **InfluxDB** | 串接真實 InfluxDB HTTP API、Continuous Query 自動降採樣、Retention Policy | 低 |
| **Grafana** | 新增 Alerting rules、Annotation API、嵌入式 iframe panel | 低 |
| **ServerFilter** | 新增自定義篩選欄位、saved filter presets、URL query string 同步 | 低 |

---

## 13. 後續擴充路線圖（v4 及更遠）

以下參考真實 AI 伺服器監控軟體的功能需求（NVIDIA Base Command Manager、Supermicro SuperCloud Composer、Dell OpenManage、HPE iLO Amplifier），列出可延續擴充的方向：

### ✅ 已完成（v3，原短期/中期/長期規劃）

| 功能 | 原規劃時程 | 完成狀態 |
|---|---|---|
| InfluxDB 時序儲存 | 短期 | ✅ In-memory buffer + Docker 配置 |
| Grafana 整合 | 短期 | ✅ 9 面板 Flux Dashboard + Provisioning |
| 伺服器搜尋/篩選 | 短期 | ✅ 搜尋 + 多維篩選 + 排序 |
| 3D 機房視圖 | 中期 | ✅ Three.js + OrbitControls + Raycaster |
| 事件時間軸 (SEL) | 中期 | ✅ 19 種事件 + 嚴重度篩選 + Resolve |
| Webhook / PagerDuty | 中期 | ✅ 3 通道 + Rate limiting + Dry-run |
| Auto-remediation | 長期 | ✅ 5 Ansible-style Playbook |
| GPU ECC 追蹤 (DCGM) | 長期 | ✅ 72 GPU × 17 計數器 + Fleet 統計 |
| NVSwitch 監控 | 長期 | ✅ 2×64 port + Fabric 吞吐 + 鏈路健康 |

### 🟢 短期（1-2 週）— 可快速實現

| 功能 | 改動範圍 | 複雜度 |
|---|---|---|
| **OAuth2 / SSO 認證** | 新增 React AuthContext + 後端 JWT middleware | 中 |
| **i18n 新增語系** | 新增 `locales/ko.ts` 等 + 更新 LANGUAGES 陣列 | 低 |
| **儀表板佈局記憶** | 將面板開關/位置狀態存入 localStorage | 低 |
| **Protocol Buffers** | 替換 WebSocket JSON 為 Protobuf（減少 ~60% 傳輸量）| 中 |
| **Dark/Light 主題切換** | CSS 變數覆蓋 + context toggle | 低 |
| **告警 E-mail 通知** | AlertRuleEngine 觸發時 → nodemailer / SendGrid | 低 |

### 🟡 中期（1-2 月）— 需要新增子系統

| 功能 | 改動範圍 | 說明 |
|---|---|---|
| **真實 BMC Redfish 對接** | 新增 Aggregator Service + RedfishAdapter | 見 [§11](#11-串接真實系統所需改動) |
| **PDF / CSV 匯出報表** | 新增匯出元件 | PUE 月報、碳排估算、SLA 報告、ECC 歷史 |
| **Redfish 寫入操作** | 新增控制 API | 遠端設定風扇轉速、功率上限、重開機 |
| **串接真實 InfluxDB** | 替換 buffer → HTTP write API | Line Protocol 已相容，低改動 |
| **Grafana Alerting** | 設定 Grafana Alert Rules | 基於 InfluxDB 查詢的告警 |
| **RBAC 權限控制** | Admin / Operator / Viewer 角色分離 | 控制寫入操作（Panic/Reset/Batch）|
| **Teams / Discord 通知** | 擴充 webhook-manager | 新增 payload formatter |

### 🔴 長期（3-6 月）— 架構級擴展

| 功能 | 架構影響 | 現實參考 |
|---|---|---|
| **真實 AI/ML 推論引擎** | 後端 Python 服務 + TF Serving / TorchServe | NVIDIA DGX AI Ops |
| **TensorFlow.js 瀏覽器端推論** | Worker 中載入 ONNX/TF.js 模型 | 離線部署場景 |
| **數位孿生（Digital Twin）** | 完整的熱力學 / 電力模型 + 3D 場景 | Siemens Xcelerator |
| **多資料中心聯邦** | 全球部署架構 + 統一 API Gateway | HPE GreenLake |
| **IPMI raw command 支援** | 底層 BMC 協定層 | ipmitool / OpenIPMI |
| **OpenTelemetry 整合** | 新增 Collector + Jaeger + Prometheus | 雲原生可觀測性 |
| **邊緣推論** | BMC/DPU 端部署 ONNX Runtime | NVIDIA DPU BlueField |
| **WebGPU 渲染升級** | 替代 WebGL，支援 compute shader | 萬台規模 instance rendering |

### 效能擴展路線

| 方向 | 目前 | 目標 | 關鍵技術 |
|---|---|---|---|
| 伺服器規模 | 100 台 | 10,000 台 | WebGPU + 虛擬捲動 + 分頁載入 |
| 更新頻率 | 1 Hz | 10 Hz | Protobuf + 差量更新 + QUIC |
| 歷史查詢 | 1 小時 (buffer) | 90 天 | InfluxDB 持久化 + 自動降採樣 + 分層儲存 |
| 並行使用者 | 1 | 100+ | WebSocket pub/sub + Redis | 
| Wasm 加速 | 3× | 10× | SIMD 指令 + bulk memory ops |
| WebSocket 頻寬 | ~450 KB/s (4 msg types) | ~150 KB/s | Protobuf + delta encoding |
| 3D 渲染 | 100 meshes | 10,000 meshes | WebGPU instanced rendering + LOD |

---

## 附錄 A：關鍵型別定義

```typescript
// 核心遙測型別（types.ts）
interface ServerTelemetry {
  serverId: number;
  timestamp: number;
  thermal: {
    inletTemp: number;           // °C
    outletTemp: number;          // °C
    gpuCoreTemps: number[];      // 72 values, °C
    liquidCoolingFlowRate: number; // L/min
  };
  power: {
    chassisWattage: number;      // Watts
    pue: number;                 // 1.0 ~ 2.5
    psuEfficiency: number[];     // 6 values, %
  };
  compute: {
    gpuUtilization: number[];    // 72 values, %
    hbm3eMemoryUsage: number[];  // 72 values, %
    nvlinkBandwidth: number[];   // 72 values, %
  };
}

// v3 新增型別
interface GpuEccEntry {
  gpuId: number;
  sramCorrectable: number;       // SRAM CE count
  sramUncorrectable: number;     // SRAM UE count (triggers XID 94)
  dramCorrectable: number;       // HBM3e DRAM CE count
  dramUncorrectable: number;     // HBM3e DRAM UE count (triggers XID 63)
  retiredPagesSingle: number;    // Single-bit retired pages
  retiredPagesDouble: number;    // Double-bit retired pages
  pendingRetirement: number;     // Pages pending retirement
  remapperCorrectable: number;   // Row remapper correctable
  remapperUncorrectable: number; // Row remapper uncorrectable
  pciReplayCount: number;        // PCIe replay counter
  lastXidError: number;          // Last XID error code (0=none, 94, 63)
  thermalViolations: number;
  powerViolations: number;
}

interface NvSwitchInfo {
  switchId: number;
  temperature: number;           // °C (55-85)
  voltage: number;               // V (~0.78)
  power: number;                 // W (120-180)
  ports: Array<{
    portId: number;
    state: 'active' | 'degraded' | 'down';
    txBandwidth: number;         // GB/s (0-100)
    rxBandwidth: number;         // GB/s (0-100)
    latency: number;             // ns (400-800)
    crcErrors: number;
    eccErrors: number;
    fatalErrors: number;
  }>;
}

interface SELEvent {
  id: string;
  timestamp: number;
  severity: 'critical' | 'warning' | 'info';
  type: string;                  // 19 event types
  serverId: number;
  message: string;
  resolved: boolean;
}

interface Playbook {
  id: string;
  name: string;
  enabled: boolean;
  triggerCondition: string;
  steps: RemediationStep[];
  cooldownMs: number;
  estimatedDurationMs: number;
  successRate: number;
}

// SharedArrayBuffer 佈局（shared-buffer.ts）
// 每台伺服器 150 floats:
//   [0]    avgTemp
//   [1]    maxTemp
//   [2]    anomalyScore
//   [3-74] gpuCoreTemps     (72 floats)
//   [75-146] gpuUtilization (72 floats)
//   [147]  chassisWattage
//   [148]  pue
//   [149]  liquidCoolingFlowRate
```

---

## 附錄 B：GLSL Uniform 參數表

| Uniform | 型別 | 範圍 | 更新頻率 | 說明 |
|---|---|---|---|---|
| `uTime` | float | 0.0 → ∞ | 每幀 (60Hz) | 經過時間（秒），驅動動畫 |
| `uAnomaly` | float | 0.0 ~ 1.0 | 每秒 (1Hz) | 異常分數，控制輝光強度 |
| `uBandwidth` | float | 0.0 ~ 1.0 | 每秒 (1Hz) | 數據流量，控制條紋密度 |
| `uCellColor` | vec3 | RGB 0~1 | 每秒 (1Hz) | 基底色（綠/黃/紅）|
| `uIntensity` | float | 0.0 ~ 1.0 | 每秒 (1Hz) | 光暈強度（Glow shader）|
| `uGlowColor` | vec3 | RGB 0~1 | 每秒 (1Hz) | 光暈顏色 |
| `uSpeed` | float | 0.5 ~ 3.0 | 每秒 (1Hz) | 條紋流速（Stripe shader）|
| `uFlowColor` | vec3 | RGB 0~1 | 設定時 | 流光顏色 |
