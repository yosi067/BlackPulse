# OmniCenter AI — Blackwell NVL72 機群遠端監測平台

企業級 NVIDIA Blackwell GB200 NVL72 伺服器機群即時監測系統。整合 Pixi.js 高效能渲染、Three.js 3D 資料中心視圖、GLSL Shader 視覺特效、Rust-Wasm 數據處理引擎、SharedArrayBuffer 零拷貝雙緩衝、i18n 多語系、AI/ML 預測引擎、GPU ECC (DCGM) 追蹤、NVSwitch Fabric 監控、SEL 事件時間軸、自動修復引擎 (Ansible-style)、Webhook/PagerDuty 告警通知，打造媲美 NVIDIA Base Command / Supermicro SuperCloud 的資料中心監控體驗。

![Industrial Dark Theme](https://img.shields.io/badge/主題-Industrial%20Dark-0b0e14)
![Status](https://img.shields.io/badge/狀態-啟用中-76b900)
![i18n](https://img.shields.io/badge/語系-EN%20%7C%20繁中%20%7C%20日文-58a6ff)
![Three.js](https://img.shields.io/badge/3D-Three.js-049ef4)
![InfluxDB](https://img.shields.io/badge/TSDB-InfluxDB%202.7-22adf6)
![Grafana](https://img.shields.io/badge/Dashboard-Grafana%2010-e6522c)

> 📖 **深入瞭解資料流架構、模擬與真實系統差異、後續擴充規劃**：請參閱 [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 📌 專案用途與定位

本專案旨在提供一套**完整的資料中心 GPU 伺服器遠端監測解決方案的概念驗證（PoC）**，適用於以下場景：

| 場景 | 說明 |
|---|---|
| **AI 超級電腦機房管理** | 即時掌握數百台 GB200 NVL72 節點的溫度、功耗、GPU 使用率 |
| **液冷散熱系統監控** | 視覺化冷卻液流速、進/出水溫度，預防散熱異常 |
| **NVLink 互連效能分析** | 觀察 GPU 間高速互連頻寬使用狀態，辨識瓶頸 |
| **AIOps 預測性維護** | 透過遙測數據模式辨識，在故障前提出告警 |
| **AI/ML 預測引擎展示** | 故障預測、異常偵測、容量規劃的可行性 Demo |
| **GPU ECC / NVSwitch 監控** | 追蹤 DCGM 風格的 ECC 錯誤、NVSwitch Fabric 吞吐量與鏈路健康 |
| **自動修復 (Auto-remediation)** | Ansible-style Playbook 自動偵測故障並執行修復流程 |
| **3D 資料中心視圖** | Three.js 等角投影機房模型，點擊下鑽至機櫃 / 伺服器 |
| **事件與告警整合** | SEL 事件時間軸、Webhook / PagerDuty 通知、可設定告警規則 |
| **技術展示 / Demo** | 支援靜態模式部署至 GitHub Pages，無需後端即可完整展示 |

---

## 🏗 系統架構總覽

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  頂層 (The Vision) — React 儀表板 + i18n 多語系 + Three.js 3D              │
│  ┌──────────────┐ ┌───────────────┐ ┌───────────────┐ ┌────────────┐       │
│  │  Pixi.js     │ │  Three.js     │ │  Rust-Wasm    │ │ Web Worker │       │
│  │  渲染引擎     │ │  3D 機房視圖   │ │  數據處理引擎  │ │ + SAB 雙緩衝│       │
│  │  • 機櫃熱力圖 │ │  • 等角投影    │ │  • LTTB 降採樣│ │ • 批次運算  │       │
│  │  • 拓撲圖     │ │  • OrbitControls│ │  • 異常偵測   │ │ • 零拷貝    │       │
│  │  • 火焰圖     │ │  • Raycaster  │ │  • EMA 平滑   │ │ • Atomics   │       │
│  │  • GLSL Shader│ │  • CDU 視覺化 │ │              │ │             │       │
│  └──────────────┘ └───────────────┘ └───────────────┘ └────────────┘       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────────┐     │
│  │ GPU ECC    │ │ NVSwitch   │ │ 事件時間軸  │ │ AI/ML 預測引擎       │     │
│  │ Tracker    │ │ Monitor    │ │ (SEL)      │ │ • 故障概率預測       │     │
│  │ • DCGM 風格│ │ • 64 port  │ │ • 19 事件  │ │ • 溫度趨勢預測       │     │
│  │ • XID error│ │ • Fabric   │ │ • 嚴重度   │ │ • 容量規劃          │     │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────────────┘     │
│  ┌──────────────────┐ ┌───────────────────┐ ┌──────────────────────┐       │
│  │  批次操作 + 篩選  │ │  告警規則引擎       │ │  Webhook / Playbook  │       │
│  │  • 多選伺服器     │ │  • 複合條件組合     │ │  • PagerDuty/Slack   │       │
│  │  • 狀態/機櫃篩選  │ │  • 持續時間觸發     │ │  • Auto-remediation  │       │
│  │  • 排序/搜尋     │ │  • 新增/刪除規則    │ │  • 5 種修復 Playbook │       │
│  └──────────────────┘ └───────────────────┘ └──────────────────────┘       │
├──────────────────────────────────────────────────────────────────────────────┤
│  中台 (The Core) — WebSocket 即時串流（4 種訊息）/ 靜態數據源               │
│  telemetry_batch│events│ecc_summary│nvswitch_summary                       │
├──────────────────────────────────────────────────────────────────────────────┤
│  底層 (The Edge) — Fastify BMC 模擬器 (Redfish 協定)                       │
│  100 台伺服器 × 72 顆 GPU × 2 NVSwitch × 每秒 1 次遙測                     │
│  + InfluxDB Buffer + Event Generator + ECC/NVSwitch Simulator             │
│  + Webhook Manager + Remediation Engine                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  基礎設施 — Docker Compose: InfluxDB 2.7 + Grafana 10.4 (可選)             │
└──────────────────────────────────────────────────────────────────────────────┘
```

> 🔗 完整資料流架構、逐層數據量分析、模擬 vs 真實系統對照，請參閱 **[ARCHITECTURE.md](ARCHITECTURE.md)**

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
npm run build
npm -w packages/dashboard run preview
```

### Docker 模式（含 InfluxDB + Grafana）

```bash
# 啟動全部服務（Simulator + Dashboard + InfluxDB + Grafana）
docker-compose up --build

# Grafana: http://localhost:3000  (admin / omnicenter)
# InfluxDB: http://localhost:8086 (org: omnicenter, bucket: telemetry)
```

---

## 📂 專案結構

```
packages/
├── simulator/                  # Fastify BMC 模擬器後端
│   └── src/
│       ├── index.js                   # HTTP + WebSocket + Redfish API + 全部新端點
│       ├── data-generator.js          # GB200 遙測數據模型與狀態引擎
│       ├── gpu-ecc-generator.js       # GPU ECC 錯誤模擬器（DCGM 風格）
│       ├── nvswitch-generator.js      # NVSwitch 4th-gen Fabric 模擬器
│       ├── event-generator.js         # SEL (System Event Log) 事件產生器
│       ├── influxdb-buffer.js         # In-memory 時序緩衝（InfluxDB Line Protocol 相容）
│       ├── webhook-manager.js         # Webhook 通知管理器（PagerDuty/Slack/Generic）
│       └── remediation-engine.js      # 自動修復引擎（5 個 Ansible-style Playbook）
├── wasm-processor/             # Rust → WebAssembly 數據處理模組
│   └── src/
│       └── lib.rs                     # LTTB・異常偵測・EMA・環形緩衝區
├── grafana/                    # Grafana 10 自動 provisioning
│   ├── dashboards/
│   │   └── omnicenter.json            # 9 面板 Grafana Dashboard（Flux 查詢）
│   └── provisioning/
│       ├── datasources/influxdb.yml   # InfluxDB 數據源配置
│       └── dashboards/dashboard.yml   # 自動載入 Dashboard 配置
└── dashboard/                  # Vite + React + Pixi.js + Three.js 前端儀表板
    └── src/
        ├── App.tsx                    # 主佈局（整合所有面板與快捷鍵）
        ├── main.tsx                   # 入口（載入 i18n）
        ├── types.ts                   # TypeScript 型別定義（含 ECC/NVSwitch/Event）
        ├── i18n/
        │   ├── index.ts               # i18next 初始化
        │   └── locales/
        │       ├── en.ts              # English
        │       ├── zh-TW.ts           # 繁體中文
        │       └── ja.ts             # 日本語
        ├── components/
        │   ├── GlobalHeader.tsx       # 頂部統計列 + 語言切換 + 3D 切換
        │   ├── LanguageSwitcher.tsx   # 🇺🇸🇹🇼🇯🇵 語言切換器
        │   ├── RackHeatmap.tsx        # 10×10 機櫃熱力圖（Pixi.js + GLSL + 篩選調光）
        │   ├── ServerFilter.tsx       # 伺服器搜尋 / 狀態篩選 / 排序
        │   ├── DataCenter3D.tsx       # Three.js 3D 等角投影機房視圖（Lazy-loaded）
        │   ├── GPUFlameGraph.tsx      # 72 GPU 溫度火焰圖
        │   ├── NVLinkTopology.tsx     # NVLink 互連拓撲圖
        │   ├── LiquidCoolingFlow.tsx  # 液冷動態流向圖
        │   ├── AIOpsPanel.tsx         # AIOps 預測告警側邊欄
        │   ├── ServerDetail.tsx       # 伺服器詳細彈窗
        │   ├── BatchOperations.tsx    # 批次操作面板
        │   ├── AlertRuleEngine.tsx    # 自定義告警規則引擎
        │   ├── MLPredictionEngine.tsx # AI/ML 預測引擎展示
        │   ├── GPUEccTracker.tsx      # GPU ECC 錯誤追蹤器（DCGM 風格）
        │   ├── NVSwitchMonitor.tsx    # NVSwitch Fabric 吞吐 / 鏈路監控
        │   ├── EventTimeline.tsx      # SEL 事件時間軸（嚴重度篩選 + 自動捲動）
        │   ├── WebhookSettings.tsx    # Webhook + Playbook + 執行歷史三頁籤
        │   └── ShortcutsHelp.tsx      # 鍵盤快捷鍵說明
        ├── shaders/
        │   └── gpu-effects.ts         # GLSL Fragment Shader（輝光/流光/邊緣脈衝）
        ├── hooks/
        │   ├── useTelemetry.ts        # 數據訂閱 + Worker + SAB + Event/ECC/NVSwitch
        │   └── useKeyboardShortcuts.ts# 全域鍵盤快捷鍵
        ├── workers/
        │   ├── telemetry.worker.ts    # Web Worker 離線程處理 + SAB 寫入
        │   └── shared-buffer.ts       # SharedArrayBuffer 雙緩衝協定
        ├── data/
        │   ├── DataSource.ts          # 統一數據源（WS 4 種訊息 / 靜態自動切換）
        │   └── StaticDataSource.ts    # GitHub Pages 內建模擬
        └── wasm/
            └── processor-fallback.ts  # 純 TS 的 Wasm 回退實作
```

---

## ✨ 功能一覽

### 核心監控

| 功能 | 說明 |
|---|---|
| **10×10 機櫃熱力圖** | Pixi.js Canvas 渲染 100 台伺服器，色彩映射 + 迷你趨勢線 + 即時溫度 |
| **GPU 溫度火焰圖** | 72 根直條對應 72 顆 GPU，高溫頂端輝光效果 |
| **NVLink 拓撲圖** | 8 節點圓形佈局 + 20 條互連 + 流動粒子動畫 |
| **液冷流向圖** | 冷/熱管道迴路粒子動畫，流速隨即時數據連動 |
| **AIOps 預測告警** | 5 種告警類型 × 嚴重度分級 × 機率排序 |

### 進階功能（v2）

| 功能 | 說明 |
|---|---|
| **🌐 多語系 i18n** | `i18next` 整合，支援 English / 繁體中文 / 日本語 即時切換，語言偏好存入 `localStorage` |
| **⌨️ 鍵盤快捷鍵** | `↑↓←→` 機櫃導航、`Enter` 開啟詳情、`Esc` 關閉面板、`P` Panic、`R` Reset、`B` 批次模式、`?` 說明 |
| **✨ GPU Shader 特效** | 自定義 GLSL Fragment Shader：高溫輝光（邊緣脈衝 + 臨界閃爍）、數據流光條紋（水平掃描線 + 對角紋） |
| **🧠 SharedArrayBuffer 雙緩衝** | Worker 寫入非活躍 buffer → `Atomics.store` + `Atomics.notify` 原子交換 → 主線程零拷貝讀取 |
| **☐ 批次操作面板** | 多選伺服器、批次重啟/韌體更新/散熱增強/功耗上限、確認對話框 + 執行動畫 |
| **🔔 告警規則引擎** | 可展開面板：自定義指標、運算符、閾值、持續時間、複合 AND 條件，即時評估觸發 |
| **🤖 AI/ML 預測引擎** | Fleet Health Index、溫度趨勢預測（指數平滑）、Weibull 故障概率、容量規劃 — 標示 ⚠ Demo mode |

### 企業功能（v3）

| 功能 | 說明 |
|---|---|
| **🏗️ 3D 資料中心視圖** | Three.js 等角投影：10 機櫃 × 10 伺服器、OrbitControls 旋轉/縮放/平移、Raycaster 點擊下鑽、CDU 冷卻塔視覺化、伺服器依異常分數著色、LED 狀態指示燈、Lazy-loaded |
| **🔍 伺服器搜尋/篩選** | 即時搜尋框 + 狀態篩選（正常/警告/危急）+ 機櫃篩選（Rack 0-9）+ 排序（ID/溫度/功耗/異常） + RackHeatmap 調光整合 |
| **💾 GPU ECC 錯誤追蹤** | NVIDIA DCGM 風格：每 GPU 追蹤 SRAM/DRAM CE/UE、Retired Pages、Row Remapper、PCIe Replay、XID Error (94/63)、熱力/功耗違規。Fleet 統計 + 可排序表格 + 僅顯示異常篩選 |
| **🔀 NVSwitch Fabric 監控** | NVSwitch 4th-gen (GB200)：每台 2 顆 NVSwitch × 64 NVLink 5.0 ports (100 GB/s each)。追蹤溫度/電壓/功耗/每 port Tx/Rx 頻寬/CRC/ECC/Fatal 錯誤/延遲。Fleet 總吞吐 (TB/s) + port 狀態條 |
| **📋 SEL 事件時間軸** | 19 種事件類型（溫度/PSU/風扇/ECC/NVLink/NVSwitch/XID/散熱/開機/自動修復等）、嚴重度篩選（Critical/Warning/Info）、自動捲動、Resolve 功能、環形緩衝 500 筆 |
| **🔔 Webhook / PagerDuty** | 3 種預設通道（PagerDuty v2 Events API、Slack attachments、Generic HTTP）、每通道獨立啟停、Rate limiting、Dry-run 模式展示、送出歷史 200 筆 |
| **🛠 自動修復引擎** | 5 個 Ansible-style Playbook：Thermal Throttle Mitigation (85%)、GPU ECC Error Response (70%)、NVLink Degraded Recovery (90%)、PSU Redundancy Failover (95%)、Coolant Flow Recovery (80%)。含冷卻時間、逐步驟執行模擬、成功率統計 |
| **📊 InfluxDB 時序緩衝** | In-memory InfluxDB Line Protocol 相容的時序儲存，支援 thermal/power/compute 三種 measurement。1 小時滾動保留 + 自動淘汰 + tag 篩選 + 時間範圍 + 聚合 (mean/max/min/last/sum) |
| **📈 Grafana 整合** | Docker Compose 自動 provisioning：InfluxDB 2.7 數據源 + 9 面板 Dashboard（GPU Temp / Power / PUE / GPU Util / Coolant Flow / HBM3e / NVLink BW / PSU Efficiency / Inlet vs Outlet Temp），全部使用 Flux 查詢 |

### 鍵盤快捷鍵速查

| 按鍵 | 功能 |
|---|---|
| `↑` `↓` `←` `→` | 在 10×10 機櫃格子間導航 |
| `Enter` | 開啟選取伺服器的詳細面板 |
| `Escape` | 關閉目前開啟的面板 |
| `P` | 觸發 Panic 模式（隨機 5 台過熱） |
| `R` | 重置所有伺服器至正常 |
| `B` | 切換批次選取模式 |
| `?` | 顯示快捷鍵說明對話框 |

---

## 🔌 API 端點總覽

### Redfish 標準

| 端點 | 方法 | 說明 |
|---|---|---|
| `/redfish/v1` | GET | Redfish 服務根目錄 |
| `/redfish/v1/Chassis/GB200_NVL72/Thermal?serverId=N` | GET | 熱力數據：溫度、液冷流速 |
| `/redfish/v1/Systems/Self/Gpus?serverId=N` | GET | GPU 運算：使用率、HBM3e、NVLink |

### 核心控制

| 端點 | 方法 | 說明 |
|---|---|---|
| `/ws/telemetry` | WebSocket | 即時遙測，4 種訊息類型 (telemetry_batch / events / ecc_summary / nvswitch_summary) |
| `/api/panic` | POST | 觸發過熱模擬 |
| `/api/reset` | POST | 重設為正常 |
| `/api/servers` | GET | 伺服器清單 |

### GPU ECC 監控

| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/ecc/:serverId` | GET | 單台伺服器 72 顆 GPU 的 ECC 錯誤計數器 |
| `/api/ecc` | GET | 全部伺服器 ECC 摘要 |
| `/api/ecc/:serverId/reset` | POST | 重置該台 ECC 計數器 |

### NVSwitch Fabric

| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/nvswitch/:serverId` | GET | 指定伺服器 2 顆 NVSwitch 摘要 + 64 port 概況 |
| `/api/nvswitch/:serverId/:switchId/ports` | GET | 特定 NVSwitch 完整 port 詳細資訊 |

### 事件管理 (SEL)

| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/events` | GET | 事件清單（支援 `?severity=` 與 `?limit=` 篩選） |
| `/api/events/stats` | GET | 事件統計：依嚴重度 / 類別分類的計數 |
| `/api/events/:eventId/resolve` | POST | 將事件標記為已解決 |

### InfluxDB 時序緩衝

| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/influx/query` | POST | Flux 風格查詢 (measurement, tags, time range, aggregateWindow) |
| `/api/influx/stats` | GET | 緩衝區統計（各 measurement 點數） |
| `/api/influx/measurements` | GET | 可用 measurement 列表 |

### Webhook 通知

| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/webhooks` | GET | 所有 Webhook 配置 |
| `/api/webhooks/:id` | PUT | 更新 Webhook 設定（啟停/URL/Rate limit） |
| `/api/webhooks` | POST | 新增 Webhook |
| `/api/webhooks/:id` | DELETE | 刪除 Webhook |
| `/api/webhooks/history` | GET | 送出歷史紀錄 |
| `/api/webhooks/test` | POST | 測試 Webhook 連線 |

### 自動修復引擎

| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/remediation/playbooks` | GET | 取得所有 Playbook 定義與狀態 |
| `/api/remediation/playbooks/:id` | PUT | 啟停/調整 Playbook |
| `/api/remediation/history` | GET | 修復執行歷史 |
| `/api/remediation/stats` | GET | 修復成功率統計 |

---

## 🛠 技術棧

| 層級 | 技術 |
|---|---|
| BMC 模擬器 | Node.js 20、Fastify 5、@fastify/websocket |
| 子系統模組 | GPU ECC (DCGM)、NVSwitch Fabric、SEL Event、InfluxDB Buffer、Webhook、Remediation |
| 數據處理 | Rust → WebAssembly（wasm-bindgen、wasm-pack） |
| 離線程計算 | Web Worker + SharedArrayBuffer 雙緩衝 + Atomics |
| 2D 渲染 | Pixi.js 7 + 自定義 GLSL Fragment Shader |
| 3D 渲染 | Three.js + OrbitControls + Raycaster |
| 前端框架 | React 18、TypeScript 5、Vite 8 |
| 多語系 | i18next + react-i18next（EN / zh-TW / JA） |
| 樣式方案 | CSS Modules + CSS 原生變數 |
| 時序資料庫 | InfluxDB 2.7（Docker，in-memory buffer 模擬） |
| 可視化平台 | Grafana 10.4（Docker，自動 Provisioning） |
| 容器化 | Docker、Docker Compose（4 服務） |

---

## 🎨 視覺設計規格

| 項目 | 值 |
|---|---|
| 設計語言 | Industrial Dark Theme |
| 主背景色 | `#0b0e14` |
| 卡片背景 | `#111820` |
| 正常/警告/危急 | `#76d276` / `#f0c040` / `#f85149` |
| 強調色 | `#58a6ff`（藍）`#39d2c0`（青）`#bc8cff`（紫） |
| 字體 | JetBrains Mono（等寬） / Inter（比例） |

---

## ⚙️ 編譯 Wasm 模組（選用）

```bash
npm run build:wasm
```

未編譯時自動使用 `processor-fallback.ts` 等效 TypeScript 實作。

---

## 🔮 後續擴展規劃

> 完整的擴充路線圖與技術可行性分析，請參閱 **[ARCHITECTURE.md § 後續擴充路線圖](ARCHITECTURE.md#13-後續擴充路線圖v4-及更遠)**

### ✅ 已完成（原短期/中期規劃）

| 功能 | 狀態 |
|---|---|
| InfluxDB 時序儲存 | ✅ 已實作（in-memory buffer + Docker） |
| Grafana 整合 | ✅ 已實作（9 面板 Flux Dashboard） |
| 伺服器搜尋/篩選 | ✅ 已實作 |
| 3D 機房視圖 | ✅ 已實作（Three.js） |
| 事件時間軸 (SEL) | ✅ 已實作 |
| Webhook / PagerDuty | ✅ 已實作 |
| Auto-remediation | ✅ 已實作（5 Playbook） |
| GPU ECC 追蹤 (DCGM) | ✅ 已實作 |
| NVSwitch 監控 | ✅ 已實作 |

### 🔜 下一階段

| 時程 | 功能亮點 |
|---|---|
| **短期** 1-2 週 | OAuth2/SSO 認證、i18n 新增語系（韓/德/法）、Protocol Buffers 替代 JSON |
| **中期** 1-2 月 | 真實 BMC Redfish 對接、PDF/CSV 報表匯出、Redfish 寫入操作 |
| **長期** 3-6 月 | TF.js/LSTM 真實推論引擎、數位孿生、多資料中心聯邦、OpenTelemetry |

---

## 📄 License

MIT
