# OmniCenter AI — Blackwell NVL72 機群遠端監測平台

企業級 NVIDIA Blackwell GB200 NVL72 伺服器機群即時監測系統。整合 Pixi.js 高效能渲染、GLSL Shader 視覺特效、Rust-Wasm 數據處理引擎、SharedArrayBuffer 零拷貝雙緩衝、i18n 多語系、AI/ML 預測引擎，打造媲美 NVIDIA Base Command / Supermicro SuperCloud 的資料中心監控體驗。

![Industrial Dark Theme](https://img.shields.io/badge/主題-Industrial%20Dark-0b0e14)
![Status](https://img.shields.io/badge/狀態-啟用中-76b900)
![i18n](https://img.shields.io/badge/語系-EN%20%7C%20繁中%20%7C%20日文-58a6ff)

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
| **技術展示 / Demo** | 支援靜態模式部署至 GitHub Pages，無需後端即可完整展示 |

---

## 🏗 系統架構總覽

```
┌────────────────────────────────────────────────────────────────────────┐
│  頂層 (The Vision) — React 儀表板 + i18n 多語系                         │
│  ┌──────────────┐ ┌───────────────┐ ┌───────────────┐ ┌────────────┐ │
│  │  Pixi.js     │ │  GLSL Shader  │ │  Rust-Wasm    │ │ Web Worker │ │
│  │  渲染引擎     │ │  GPU 特效引擎  │ │  數據處理引擎  │ │ + SAB 雙緩衝│ │
│  │  • 機櫃熱力圖 │ │  • 高溫輝光    │ │  • LTTB 降採樣│ │ • 批次運算  │ │
│  │  • 拓撲圖     │ │  • 流光條紋    │ │  • 異常偵測   │ │ • 零拷貝    │ │
│  │  • 火焰圖     │ │  • 邊緣脈衝    │ │  • EMA 平滑   │ │ • Atomics   │ │
│  └──────────────┘ └───────────────┘ └───────────────┘ └────────────┘ │
│  ┌──────────────────┐ ┌───────────────────┐ ┌──────────────────────┐ │
│  │  批次操作面板      │ │  告警規則引擎       │ │  AI/ML 預測引擎       │ │
│  │  • 多選伺服器      │ │  • 複合條件組合     │ │  • 故障概率預測       │ │
│  │  • 重啟/韌體/散熱  │ │  • 持續時間觸發     │ │  • 溫度趨勢預測       │ │
│  │  • 確認與執行動畫  │ │  • 新增/刪除規則    │ │  • 容量規劃          │ │
│  └──────────────────┘ └───────────────────┘ └──────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│  中台 (The Core) — WebSocket 即時串流 / 靜態數據源                       │
├────────────────────────────────────────────────────────────────────────┤
│  底層 (The Edge) — Fastify BMC 模擬器 (Redfish 協定)                    │
│  100 台伺服器 × 72 顆 GPU × 每秒 1 次遙測                               │
└────────────────────────────────────────────────────────────────────────┘
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

### Docker 模式

```bash
docker-compose up --build
```

---

## 📂 專案結構

```
packages/
├── simulator/                  # Fastify BMC 模擬器後端
│   └── src/
│       ├── index.js                   # HTTP + WebSocket + Redfish API
│       └── data-generator.js          # GB200 遙測數據模型與狀態引擎
├── wasm-processor/             # Rust → WebAssembly 數據處理模組
│   └── src/
│       └── lib.rs                     # LTTB・異常偵測・EMA・環形緩衝區
└── dashboard/                  # Vite + React + Pixi.js 前端儀表板
    └── src/
        ├── App.tsx                    # 主佈局（整合所有面板與快捷鍵）
        ├── main.tsx                   # 入口（載入 i18n）
        ├── types.ts                   # TypeScript 型別定義
        ├── i18n/
        │   ├── index.ts               # i18next 初始化
        │   └── locales/
        │       ├── en.ts              # English
        │       ├── zh-TW.ts           # 繁體中文
        │       └── ja.ts             # 日本語
        ├── components/
        │   ├── GlobalHeader.tsx       # 頂部統計列 + 語言切換 + 模式切換
        │   ├── LanguageSwitcher.tsx   # 🇺🇸🇹🇼🇯🇵 語言切換器
        │   ├── RackHeatmap.tsx        # 10×10 機櫃熱力圖（Pixi.js + GLSL Shader）
        │   ├── GPUFlameGraph.tsx      # 72 GPU 溫度火焰圖
        │   ├── NVLinkTopology.tsx     # NVLink 互連拓撲圖
        │   ├── LiquidCoolingFlow.tsx  # 液冷動態流向圖
        │   ├── AIOpsPanel.tsx         # AIOps 預測告警側邊欄
        │   ├── ServerDetail.tsx       # 伺服器詳細彈窗
        │   ├── BatchOperations.tsx    # 批次操作面板
        │   ├── AlertRuleEngine.tsx    # 自定義告警規則引擎
        │   ├── MLPredictionEngine.tsx # AI/ML 預測引擎展示
        │   └── ShortcutsHelp.tsx      # 鍵盤快捷鍵說明
        ├── shaders/
        │   └── gpu-effects.ts         # GLSL Fragment Shader（輝光/流光/邊緣脈衝）
        ├── hooks/
        │   ├── useTelemetry.ts        # 數據訂閱 + Worker + SAB 初始化
        │   └── useKeyboardShortcuts.ts# 全域鍵盤快捷鍵
        ├── workers/
        │   ├── telemetry.worker.ts    # Web Worker 離線程處理 + SAB 寫入
        │   └── shared-buffer.ts       # SharedArrayBuffer 雙緩衝協定
        ├── data/
        │   ├── DataSource.ts          # 統一數據源（WS / 靜態自動切換）
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

## 🔌 Redfish API 端點

| 端點 | 方法 | 說明 |
|---|---|---|
| `/redfish/v1` | GET | Redfish 服務根目錄 |
| `/redfish/v1/Chassis/GB200_NVL72/Thermal?serverId=N` | GET | 熱力數據：溫度、液冷流速 |
| `/redfish/v1/Systems/Self/Gpus?serverId=N` | GET | GPU 運算：使用率、HBM3e、NVLink |
| `/ws/telemetry` | WebSocket | 即時遙測，每秒 100 台伺服器完整 JSON |
| `/api/panic` | POST | 觸發過熱模擬 |
| `/api/reset` | POST | 重設為正常 |
| `/api/servers` | GET | 伺服器清單 |

---

## 🛠 技術棧

| 層級 | 技術 |
|---|---|
| BMC 模擬器 | Node.js 20、Fastify 5、@fastify/websocket |
| 數據處理 | Rust → WebAssembly（wasm-bindgen、wasm-pack） |
| 離線程計算 | Web Worker + SharedArrayBuffer 雙緩衝 + Atomics |
| GPU 渲染 | Pixi.js 7 + 自定義 GLSL Fragment Shader |
| 前端框架 | React 18、TypeScript 5、Vite 8 |
| 多語系 | i18next + react-i18next（EN / zh-TW / JA） |
| 樣式方案 | CSS Modules + CSS 原生變數 |
| 容器化 | Docker、Docker Compose |

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

> 完整的擴充路線圖與技術可行性分析，請參閱 **[ARCHITECTURE.md § 後續擴充路線圖](ARCHITECTURE.md#-後續擴充路線圖)**

| 時程 | 功能亮點 |
|---|---|
| **短期** 1-2 週 | InfluxDB 時序庫、Grafana 外掛、OAuth2 認證 |
| **中期** 1-2 月 | 真實 BMC Redfish 對接、3D 機房視圖、Webhook 告警通知 |
| **長期** 3-6 月 | TF.js/LSTM 推論引擎、數位孿生、多資料中心聯邦、OpenTelemetry |

---

## 📄 License

MIT
