# OmniCenter AI — Blackwell NVL72 機群遠端監測平台

企業級 NVIDIA Blackwell GB200 NVL72 伺服器機群即時監測系統。整合 Pixi.js 高效能渲染、Rust-Wasm 數據處理引擎、AIOps 智慧預測告警，打造媲美 NVIDIA Base Command / Supermicro SuperCloud 等大廠等級的資料中心監控體驗。

![Industrial Dark Theme](https://img.shields.io/badge/主題-Industrial%20Dark-0b0e14)
![Status](https://img.shields.io/badge/狀態-啟用中-76b900)

---

## 📌 專案用途與定位

本專案旨在提供一套**完整的資料中心 GPU 伺服器遠端監測解決方案的概念驗證（PoC）**，適用於以下場景：

| 場景 | 說明 |
|---|---|
| **AI 超級電腦機房管理** | 即時掌握數百台 GB200 NVL72 節點的溫度、功耗、GPU 使用率 |
| **液冷散熱系統監控** | 視覺化冷卻液流速、進/出水溫度，預防散熱異常 |
| **NVLink 互連效能分析** | 觀察 GPU 間高速互連頻寬使用狀態，辨識瓶頸 |
| **AIOps 預測性維護** | 透過遙測數據模式辨識，在故障前提出告警 |
| **技術展示 / Demo** | 支援靜態模式部署至 GitHub Pages，無需後端即可完整展示 |

---

## 🏗 系統架構總覽

```
┌──────────────────────────────────────────────────────────────┐
│  頂層 (The Vision) — React 儀表板                              │
│  ┌──────────────┐ ┌───────────────┐ ┌────────────────────┐   │
│  │  Pixi.js     │ │  Rust-Wasm    │ │   Web Worker       │   │
│  │  渲染引擎     │ │  數據處理引擎   │ │   (遙測處理線程)    │   │
│  │  • 機櫃熱力圖 │ │  • LTTB 降採樣 │ │   • 批次運算       │   │
│  │  • 拓撲圖    │ │  • 異常偵測    │ │   • 環形緩衝區      │   │
│  │  • 火焰圖    │ │  • EMA 平滑   │ │   • 迷你趨勢圖      │   │
│  └──────────────┘ └───────────────┘ └────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│  中台 (The Core) — WebSocket 即時串流 / 靜態數據源              │
├──────────────────────────────────────────────────────────────┤
│  底層 (The Edge) — Fastify BMC 模擬器 (Redfish 協定)           │
│  100 台伺服器 × 72 顆 GPU × 每秒 1 次遙測                      │
└──────────────────────────────────────────────────────────────┘
```

### 架構說明

- **底層（The Edge）**：以 Docker 容器化的 BMC 模擬器，透過 Redfish 標準協定輸出 GB200 NVL72 的模擬遙測數據，涵蓋溫度、功耗、GPU 運算、NVLink 頻寬等指標
- **中台（The Core）**：WebSocket 即時數據串流管道，將 100 台伺服器的 Telemetry 批次推播至前端；偵測到 GitHub Pages 等靜態環境時自動切換為內建模擬數據源
- **頂層（The Vision）**：React 儀表板搭配 Pixi.js 高效能 Canvas 渲染，所有數據先經 Web Worker 以 Rust-Wasm（或 TypeScript 回退）處理後再交付渲染，確保主線程順暢

---

## 🚀 快速啟動

### 開發模式（含模擬器後端）

```bash
# 安裝所有工作區依賴
npm install

# 同時啟動模擬器 + 儀表板
npm run dev
```

- 儀表板：http://localhost:5173
- 模擬器 API：http://localhost:3001

### 靜態模式（免後端）

在 URL 後加上 `?static` 參數，或部署至 GitHub Pages——儀表板會自動偵測環境並切換為內建數據模擬。

```bash
# 建置生產版本
npm run build

# 預覽靜態建置
npm -w packages/dashboard run preview
```

### Docker 模式

```bash
docker-compose up --build
```

---

## 📂 專案結構

```
packages/
├── simulator/              # Fastify BMC 模擬器後端
│   └── src/
│       ├── index.js               # HTTP 伺服器 + WebSocket + Redfish API 端點
│       └── data-generator.js      # GB200 遙測數據模型與狀態引擎
├── wasm-processor/         # Rust → WebAssembly 數據處理模組
│   └── src/
│       └── lib.rs                 # LTTB 降採樣、滑動窗口異常偵測、環形緩衝區、EMA 平滑
└── dashboard/              # Vite + React + Pixi.js 前端儀表板
    └── src/
        ├── App.tsx                # 主佈局：Header + 熱力圖 + 側邊欄
        ├── components/
        │   ├── GlobalHeader.tsx          # 頂部全域統計列
        │   ├── RackHeatmap.tsx           # 10×10 機櫃熱力圖（Pixi.js）
        │   ├── GPUFlameGraph.tsx          # 72 顆 GPU 溫度火焰圖（Pixi.js）
        │   ├── NVLinkTopology.tsx         # NVLink 互連拓撲圖（Pixi.js）
        │   ├── LiquidCoolingFlow.tsx      # 液冷系統動態流向圖（Pixi.js）
        │   ├── AIOpsPanel.tsx             # AIOps 智慧預測告警側邊欄
        │   ├── ServerDetail.tsx           # 單台伺服器詳細資訊彈窗
        │   └── ServerDetail.module.css    # 詳細彈窗樣式
        ├── data/
        │   ├── DataSource.ts             # 統一數據源（WebSocket / 靜態自動切換）
        │   └── StaticDataSource.ts       # GitHub Pages 用內建數據模擬引擎
        ├── hooks/
        │   └── useTelemetry.ts           # React Hook：數據訂閱 + Worker 通訊
        ├── workers/
        │   └── telemetry.worker.ts       # Web Worker：離線程數據批次處理
        └── wasm/
            └── processor-fallback.ts     # 純 TypeScript 的 Wasm 回退實作
```

---

## 🖥 介面功能詳細說明

### 一、全域統計列（Global Header）

畫面最上方的橫向導航列，左中右三區域提供整體機群狀態一覽：

| 區域 | 元素 | 說明 |
|---|---|---|
| **左側品牌區** | OmniCenter AI Logo | 綠色 NVIDIA 風格 SVG 圖標 |
| | `OmniCenter AI` 標題 | 系統名稱，白色粗體 |
| | `Blackwell NVL72 Fleet Monitor` 副標題 | 灰色小字，標示監控對象 |
| | 連線狀態燈號 | 🟢 綠色 = WebSocket 已連線；🔴 紅色閃爍 = 離線/靜態模式 |
| **中央指標區** | `MACHINES` | 當前監控的伺服器總數（預設 100） |
| | `AVG PUE` | 平均電力使用效率值（Power Usage Effectiveness），理想值趨近 1.0 |
| | `TOTAL POWER` (kW) | 所有伺服器即時總功耗，以青色（Cyan）顯示 |
| | `ALERTS` | 當前觸發告警的伺服器數量，>0 時紅色閃爍 |
| **右側控制區** | `⚡ PANIC` 按鈕 | 紅色邊框按鈕，點擊後隨機使 5 台伺服器進入過熱模擬 |
| | `↻ RESET` 按鈕 | 灰色按鈕，將所有伺服器溫度恢復正常狀態 |

---

### 二、機櫃熱力圖（Rack Heatmap）— 主面板

佔據畫面中央最大區域，以 **Pixi.js Canvas** 繪製 10 列 × 10 行共 100 個伺服器方塊：

| 功能 | 詳細說明 |
|---|---|
| **色彩映射** | 每個方塊根據 GPU 最高溫的異常分數動態著色：🟢 深綠（正常 <75°C）→ 🟡 黃色（警告 75-85°C）→ 🔴 紅色（危急 >85°C） |
| **迷你趨勢線（Sparklines）** | 每個方塊內繪製最近 60 秒的平均溫度走勢曲線，透過 LTTB 演算法降採樣至 30 個點，線條下方有半透明填充區域 |
| **伺服器編號** | 左上角顯示 `S000`~`S099` 等編號標籤 |
| **即時溫度** | 右上角顯示該伺服器 GPU 最高溫度值（如 `72°C`），顏色隨健康狀態變化 |
| **邊框特效** | 正常：深灰邊框；警告：黃色邊框；危急：紅色邊框 + 脈衝閃爍發光效果 |
| **選取狀態** | 點擊任一方塊時，該方塊顯示藍色高亮邊框，並開啟伺服器詳細面板 |
| **圖例列** | 頂部顯示 `Normal` / `Warning` / `Critical` 三色圖例 |
| **效能** | 100 台伺服器的所有圖形在同一個 Draw Call 內批次渲染，確保 > 60 FPS |

---

### 三、AIOps 智慧預測側邊欄（AIOps Predictions）

位於畫面右側，寬度 280px 的固定側邊欄：

| 功能 | 詳細說明 |
|---|---|
| **標題區** | 🧠 圖標 + `AIOps Predictions` 標題 + 活躍告警數量統計 |
| **告警卡片** | 每張卡片包含：伺服器編號標籤（藍底 `S012`）、預測機率（如 `89%`）、完整告警訊息、告警類型與預估時間 |
| **嚴重度分級** | `critical`（危急）= 紅色左邊框；`warning`（警告）= 黃色左邊框 |
| **排序邏輯** | 自動依嚴重度 → 機率由高至低排序，最多顯示 20 筆 |
| **告警類型** | 支援五種預測類型： |
| | • `thermal_throttle` — GPU 溫度過高即將降頻 |
| | • `fan_failure` — 風扇故障預測 |
| | • `nvlink_degraded` — NVLink 互連頻寬擁塞 |
| | • `psu_failure` — 電源供應器效率衰退 |
| | • `memory_error` — HBM3e 記憶體錯誤（保留） |
| **空狀態** | 無告警時顯示 `All systems nominal` |

---

### 四、伺服器詳細面板（Server Detail Modal）

點擊熱力圖中任一伺服器方塊後彈出的全螢幕疊層視窗，包含三大子面板：

#### 4.1 標題與快速統計

| 元素 | 說明 |
|---|---|
| 伺服器名稱 | `GB200-NVL72-012` 格式，JetBrains Mono 等寬字體 |
| 機櫃位置 | `Rack 1 · Position 2` 顯示所在機架與槽位 |
| 健康狀態徽章 | `OK` / `WARN` / `CRIT` 帶對應顏色邊框 |
| 快速指標列 | 六個指標橫向排列：Max Temp、Avg Temp、GPU Util、Power (kW)、PUE、Flow Rate (L/min) |

#### 4.2 GPU 溫度火焰圖（GPU Flame Graph）

全寬展示，高度 180px 的 Pixi.js 頻譜圖：

| 功能 | 詳細說明 |
|---|---|
| **長條數量** | 72 根直條，對應 GB200 NVL72 的 72 顆 GPU |
| **高度映射** | 每根長條高度 = GPU 溫度 / 105°C × 圖表高度 |
| **色彩映射** | 深綠（<50°C）→ 亮綠（50-60°C）→ 黃（60-75°C）→ 紅（>75°C） |
| **過熱發光** | 溫度 >80°C 的 GPU 長條頂端疊加紅色半透明光暈 |
| **Y 軸刻度** | 左側顯示 40° / 60° / 80° / 100° 刻度標記與水平參考線 |
| **用途** | 快速辨識哪些 GPU 核心溫度偏高，是否有散熱不均的情況 |

#### 4.3 NVLink 互連拓撲圖（NVLink Topology View）

圓形佈局的 GPU 群組互聯關係圖：

| 功能 | 詳細說明 |
|---|---|
| **節點** | 8 個圓形節點，代表 72 顆 GPU 分成 8 組（每組 9 顆），標籤如 `G0-8`、`G9-17` |
| **連線** | 20 條互連線段，模擬 NVLink 高速互連拓撲 |
| **線寬映射** | 連線粗細 = 0.5px + (頻寬使用率 / 100) × 3px |
| **顏色映射** | 低負載 (<50%) = 深灰、中等 (50-80%) = 青色、高負載 (>80%) = 藍色 |
| **流動粒子** | 沿每條連線流動的動態粒子，速度與數量隨頻寬使用率增加而加快/增多 |
| **頻寬標籤** | 每個節點下方顯示該群組平均頻寬百分比 |
| **節點光暈** | 高負載節點外圍顯示半透明光暈效果 |

#### 4.4 液冷系統流向圖（Liquid Cooling Flow）

矩形迴路管道動畫，視覺化液冷散熱系統：

| 功能 | 詳細說明 |
|---|---|
| **管道佈局** | 左側下行（冷入水）→ 底部橫向 → 右側上行（熱出水）→ 頂部回流，形成封閉迴路 |
| **冷熱色彩** | 入水管 = 藍/青色粒子；出水管 = 黃/紅色粒子，直觀呈現溫差 |
| **流速動態** | 粒子移動速度與 `liquidCoolingFlowRate`（L/min）即時數據連動 |
| **粒子數量** | 流速越高，可見粒子越多，視覺密度隨之增加 |
| **中央熱交換區** | 中間繪製半透明矩形，代表 GPU 散熱板（熱交換器） |

---

### 五、數據處理管線

#### Web Worker 離線程處理

所有原始 Telemetry JSON 進入 Web Worker 後依序執行：

1. **展平 GPU 溫度**：100 台 × 72 顆 = 7,200 個溫度值寫入單一 Float32Array
2. **批次摘要**：呼叫 `processServerBatch()` 計算每台伺服器的平均溫度、最高溫度、異常分數
3. **趨勢緩衝**：為每台伺服器維護 60 秒的溫度歷史環形緩衝區
4. **LTTB 降採樣**：將 60 個點降至 30 個，保持波形視覺特徵不失真
5. **異常偵測**：以 5 個樣本的滑動窗口 + 2σ 閾值偵測溫度突跳
6. **聚合指標**：計算全機群總功耗 (kW)、平均 PUE、告警數量

#### Rust-Wasm 引擎（選用）

| 函式 | 用途 |
|---|---|
| `lttb_downsample()` | LTTB（最大三角形三桶）降採樣演算法，將密集數據在不失真前提下壓縮 |
| `detect_anomalies()` | 滑動窗口 + 標準差的異常值偵測，輸出 0.0~1.0 的異常分數 |
| `process_server_batch()` | 批次計算每台伺服器的 [平均溫、最高溫、異常分數] 向量 |
| `ema_smooth()` | 指數移動平均平滑，減少數據抖動 |
| `RingBuffer` | 環形緩衝區結構，定容量、自動覆寫最舊數據 |

若未編譯 Wasm，系統自動使用 `processor-fallback.ts` 中完全等效的 TypeScript 實作。

---

## 🎨 視覺設計規格

| 項目 | 值 |
|---|---|
| 設計語言 | Industrial Dark Theme（參考 NVIDIA Base Command / Supermicro Dashboards） |
| 主背景色 | `#0b0e14` |
| 卡片背景 | `#111820` |
| 邊框色 | `#1e2a3a` |
| 主文字色 | `#e6edf3` |
| 次要文字 | `#8b949e` |
| NVIDIA 品牌色 | `#76b900` |
| 正常狀態 | `#76d276`（綠） |
| 警告狀態 | `#f0c040`（黃） |
| 危急狀態 | `#f85149`（紅） |
| 強調色 | `#58a6ff`（藍）、`#39d2c0`（青）、`#bc8cff`（紫） |
| 等寬字體 | JetBrains Mono |
| 比例字體 | Inter |

---

## 🔌 Redfish API 端點

| 端點 | 方法 | 說明 |
|---|---|---|
| `/redfish/v1` | GET | Redfish 服務根目錄，回傳版本與 UUID |
| `/redfish/v1/Chassis/GB200_NVL72/Thermal?serverId=N` | GET | 指定伺服器的熱力數據：進/出水溫、72 顆 GPU 核心溫度、液冷流速 |
| `/redfish/v1/Systems/Self/Gpus?serverId=N` | GET | 指定伺服器的 GPU 運算數據：使用率、HBM3e 記憶體、NVLink 頻寬 |
| `/ws/telemetry` | WebSocket | 即時遙測串流，每秒推播 100 台伺服器的完整 JSON 批次 |
| `/api/panic` | POST | 觸發過熱模擬（可指定 `serverIds` 或隨機 5 台） |
| `/api/reset` | POST | 重設所有伺服器回正常狀態 |
| `/api/servers` | GET | 取得伺服器清單（編號、名稱、機架位置） |

---

## 🛠 技術棧

| 層級 | 技術 |
|---|---|
| BMC 模擬器 | Node.js 20、Fastify 4、@fastify/websocket |
| 數據處理 | Rust → WebAssembly（wasm-bindgen、wasm-pack） |
| 離線程計算 | Web Worker + Float32Array 共享記憶體 |
| 高效能渲染 | Pixi.js 7（批次渲染、Canvas 2D） |
| 前端框架 | React 18、TypeScript 5、Vite 5 |
| 樣式方案 | CSS Modules + CSS 原生變數 |
| 容器化 | Docker、Docker Compose（支援 `scale` 擴縮） |
| 靜態部署 | GitHub Pages 自動偵測模式 |

---

## ⚙️ 編譯 Wasm 模組（選用）

需要安裝 [Rust](https://rustup.rs/) 與 [wasm-pack](https://rustwasm.github.io/wasm-pack/)：

```bash
npm run build:wasm
```

未編譯時，系統自動使用 `processor-fallback.ts` 中完全等效的 TypeScript 回退實作，功能完全相同。

---

## 🔮 後續擴展功能建議

### 短期改進（1-2 週）

| 功能 | 說明 |
|---|---|
| **InfluxDB 時序資料庫** | 接入 InfluxDB 或 TimescaleDB，將歷史遙測數據持久化，支援按時間範圍查詢回放 |
| **Grafana 整合** | 提供 Grafana 數據源外掛，允許使用者在 Grafana 中建立自定義面板與告警規則 |
| **使用者驗證** | 加入 OAuth2 / SSO 登入機制，區分管理員與唯讀使用者角色 |
| **多語系支援 (i18n)** | 整合 react-intl 或 i18next，支援英文/中文/日文切換 |
| **鍵盤快捷鍵** | 支援方向鍵在機櫃格子間導航、Escape 關閉面板、P 鍵觸發 Panic |

### 中期功能（1-2 個月）

| 功能 | 說明 |
|---|---|
| **真實 BMC 對接** | 替換模擬器，直接透過 Redfish API 連線至實體 BMC（如 Supermicro X13、Dell iDRAC） |
| **GPU Shader 特效** | 使用 Pixi.js 自定義 GLSL Shader 實作高溫輝光（Glow）與數據流光條紋效果 |
| **SharedArrayBuffer 雙緩衝** | Worker 與主線程間使用真正的共享記憶體，消除序列化開銷 |
| **3D 機房視圖** | 整合 Three.js 或 Babylon.js，提供等角或透視的 3D 機房佈局，可旋轉/縮放瀏覽機櫃 |
| **批次操作面板** | 支援選取多台伺服器後批次執行重開機、韌體更新、散熱模式切換等操作 |
| **告警規則引擎** | 自定義告警閾值與條件組合（如「連續 3 分鐘 > 85°C 且 GPU 使用率 > 90%」） |
| **E-mail / Webhook 通知** | 告警觸發時自動發送通知至 Slack、Teams、PagerDuty 或自定義 Webhook |

### 長期規劃（3-6 個月）

| 功能 | 說明 |
|---|---|
| **真正的 AI/ML 預測引擎** | 以 TensorFlow.js 或後端 Python 模型取代目前的規則式預測，訓練時序預測模型（如 LSTM/Transformer）進行故障預警 |
| **數位孿生（Digital Twin）** | 建立完整的資料中心數位孿生模型，模擬不同散熱方案、電力配置對 PUE 的影響 |
| **多資料中心聯邦** | 支援跨地域多個資料中心的統一監測，全球地圖視圖 + 各站點下鑽 |
| **IPMI / Redfish 寫入操作** | 不只讀取，還能透過 Redfish 下達控制命令（調整風扇轉速、設定功率上限、遠端重開機） |
| **可觀測性整合** | 接入 OpenTelemetry、Prometheus、Loki 等雲原生可觀測性堆疊，統一 metrics/logs/traces |
| **邊緣推論監控** | 在 BMC 端部署輕量推論模型，在邊緣即時判定異常，降低中心端運算壓力 |
| **合規報表產出** | 自動產出 PUE 月報、碳排放估算、SLA 合規性報告等管理層報表（PDF/CSV 匯出） |

### 效能優化方向

| 方向 | 說明 |
|---|---|
| **WebGPU 遷移** | 將 Pixi.js Canvas 2D 渲染遷移至 WebGPU，支援更大規模（1,000+ 台）的即時渲染 |
| **Protocol Buffers** | 將 WebSocket 傳輸格式從 JSON 改為 Protobuf/FlatBuffers，減少 80% 以上的序列化開銷與傳輸量 |
| **差量更新** | 只傳送與上一幀不同的數據欄位，而非完整批次，大幅降低頻寬需求 |
| **虛擬捲動** | 當伺服器數量超過 1,000 台時，熱力圖改用虛擬化渲染，只繪製可視區域 |
