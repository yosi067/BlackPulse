export default {
  // Header
  'header.title': 'OmniCenter AI',
  'header.subtitle': 'Blackwell NVL72 叢集監控平台',
  'header.machines': '機器數',
  'header.avgPue': '平均 PUE',
  'header.totalPower': '總功耗',
  'header.alerts': '告警',
  'header.panic': '⚡ 緊急',
  'header.reset': '↻ 重置',

  // Rack heatmap
  'rack.title': '機櫃熱圖',
  'rack.subtitle': '10×10 伺服器矩陣 · 即時溫度監控',
  'rack.normal': '正常',
  'rack.warning': '警告',
  'rack.critical': '嚴重',

  // Server detail
  'detail.maxTemp': '最高溫度',
  'detail.avgTemp': '平均溫度',
  'detail.gpuUtil': 'GPU 使用率',
  'detail.power': '功耗',
  'detail.pue': 'PUE',
  'detail.flowRate': '冷卻流速',
  'detail.rack': '機櫃 {{rack}} · 位置 {{pos}}',
  'detail.gpuFlame': 'GPU 溫度火焰圖 — 72 核心',
  'detail.nvlink': 'NVLink 互連拓撲',
  'detail.liquidCooling': '液冷循環流量',

  // AIOps
  'aiops.title': 'AIOps 預測分析',
  'aiops.activeAlerts': '{{count}} 個活躍告警',
  'aiops.nominal': '所有系統正常運行',

  // Batch Operations
  'batch.title': '批次操作',
  'batch.selectedCount': '已選取 {{count}} 台伺服器',
  'batch.selectAll': '全選',
  'batch.deselectAll': '取消全選',
  'batch.reboot': '重新啟動',
  'batch.firmwareUpdate': '韌體更新',
  'batch.coolingBoost': '散熱增強',
  'batch.powerCap': '功耗上限',
  'batch.confirm': '確定對 {{count}} 台伺服器執行「{{action}}」？',
  'batch.executing': '執行中...',
  'batch.success': '已完成 {{count}} 台伺服器的操作',

  // Alert Rule Engine
  'alertEngine.title': '告警規則',
  'alertEngine.addRule': '+ 新增規則',
  'alertEngine.metric': '指標',
  'alertEngine.operator': '運算符',
  'alertEngine.threshold': '閾值',
  'alertEngine.duration': '持續時間',
  'alertEngine.enabled': '已啟用',
  'alertEngine.active': '運行中',
  'alertEngine.triggered': '已觸發',
  'alertEngine.temp': 'GPU 溫度',
  'alertEngine.util': 'GPU 使用率',
  'alertEngine.power': '功耗',
  'alertEngine.flow': '冷卻流量',
  'alertEngine.seconds': '{{val}} 秒',

  // AI/ML Prediction Engine
  'mlEngine.title': 'AI/ML 預測引擎',
  'mlEngine.subtitle': '預測性維護 · 異常檢測 · 容量規劃',
  'mlEngine.prediction': '故障預測',
  'mlEngine.anomaly': '異常分數',
  'mlEngine.capacity': '容量預測',
  'mlEngine.health': '叢集健康指數',
  'mlEngine.trend': '趨勢分析',
  'mlEngine.confidence': '信心度',
  'mlEngine.nextFailure': '下次預測故障',
  'mlEngine.hours': '{{val}} 小時',
  'mlEngine.demoNote': '⚠ 展示模式 — 模擬 ML 推論',
  'mlEngine.thermalForecast': '溫度預測（未來 24 小時）',
  'mlEngine.failureProbability': '組件故障概率',
  'mlEngine.capacityPlanning': '容量規劃',

  // Keyboard shortcuts
  'shortcuts.title': '鍵盤快捷鍵',
  'shortcuts.arrows': '方向鍵 — 在機櫃格子間導航',
  'shortcuts.enter': 'Enter — 開啟伺服器詳情',
  'shortcuts.escape': 'Escape — 關閉面板',
  'shortcuts.p': 'P — 觸發緊急模式',
  'shortcuts.r': 'R — 重置所有伺服器',
  'shortcuts.b': 'B — 切換批次模式',
  'shortcuts.questionMark': '? — 顯示快捷鍵說明',

  // Server Filter
  'filter.searchPlaceholder': '搜尋伺服器 (ID、名稱、機櫃)...',
  'filter.allStatus': '所有狀態',
  'filter.normal': '正常',
  'filter.warning': '警告',
  'filter.critical': '嚴重',
  'filter.allRacks': '所有機櫃',
  'filter.rack': '機櫃',
  'filter.sortId': '排序：ID',
  'filter.sortTemp': '排序：溫度 ↓',
  'filter.sortPower': '排序：功耗 ↓',
  'filter.sortAnomaly': '排序：異常 ↓',

  // Event Timeline
  'events.title': '系統事件日誌 (SEL)',
  'events.all': '全部',
  'events.autoScroll': '自動捲動',
  'events.noEvents': '尚無事件紀錄',

  // GPU ECC Tracker
  'ecc.title': 'GPU 記憶體 ECC 追蹤 (DCGM)',
  'ecc.correctableErrors': '可修正錯誤',
  'ecc.uncorrectableErrors': '不可修正錯誤',
  'ecc.retiredPages': '已退役頁面',
  'ecc.xidServers': 'XID 錯誤伺服器',
  'ecc.sortUE': '排序：不可修正',
  'ecc.sortCE': '排序：可修正',
  'ecc.sortRetired': '排序：已退役頁面',
  'ecc.sortXid': '排序：XID 錯誤',
  'ecc.onlyErrors': '僅顯示異常',
  'ecc.server': '伺服器',
  'ecc.retired': '退役',
  'ecc.demoNote': '模擬 DCGM 資料 — 正式環境請連接真實 nvidia-smi / DCGM',

  // NVSwitch Monitor
  'nvswitch.title': 'NVSwitch 互連結構監控',
  'nvswitch.totalBw': '總吞吐量',
  'nvswitch.maxTemp': '最高交換器溫度',
  'nvswitch.degradedLinks': '降級鏈路',
  'nvswitch.totalPower': '交換器功耗',
  'nvswitch.detail': '詳情',
  'nvswitch.topServers': 'NVSwitch 活動最高伺服器',
  'nvswitch.backToFleet': '返回叢集檢視',

  // Webhook & Remediation
  'webhook.title': 'Webhooks 與自動修復',
  'webhook.test': '測試 Webhook',
  'webhook.noHistory': '尚無修復執行紀錄',
};
