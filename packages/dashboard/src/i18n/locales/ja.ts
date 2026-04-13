export default {
  // Header
  'header.title': 'OmniCenter AI',
  'header.subtitle': 'Blackwell NVL72 フリート監視',
  'header.machines': 'マシン数',
  'header.avgPue': '平均 PUE',
  'header.totalPower': '総電力',
  'header.alerts': 'アラート',
  'header.panic': '⚡ パニック',
  'header.reset': '↻ リセット',

  // Rack heatmap
  'rack.title': 'ラックヒートマップ',
  'rack.subtitle': '10×10 サーバーグリッド · リアルタイム温度',
  'rack.normal': '正常',
  'rack.warning': '警告',
  'rack.critical': '重大',

  // Server detail
  'detail.maxTemp': '最高温度',
  'detail.avgTemp': '平均温度',
  'detail.gpuUtil': 'GPU 使用率',
  'detail.power': '電力',
  'detail.pue': 'PUE',
  'detail.flowRate': '冷却流量',
  'detail.rack': 'ラック {{rack}} · ポジション {{pos}}',
  'detail.gpuFlame': 'GPU サーマルフレームグラフ — 72 コア',
  'detail.nvlink': 'NVLink インターコネクトトポロジー',
  'detail.liquidCooling': '液冷循環フロー',

  // AIOps
  'aiops.title': 'AIOps 予測分析',
  'aiops.activeAlerts': '{{count}} 件のアクティブアラート',
  'aiops.nominal': '全システム正常稼働中',

  // Batch Operations
  'batch.title': 'バッチ操作',
  'batch.selectedCount': '{{count}} 台のサーバーを選択',
  'batch.selectAll': '全選択',
  'batch.deselectAll': '選択解除',
  'batch.reboot': '再起動',
  'batch.firmwareUpdate': 'ファームウェア更新',
  'batch.coolingBoost': '冷却ブースト',
  'batch.powerCap': '電力上限',
  'batch.confirm': '{{count}} 台のサーバーで「{{action}}」を実行しますか？',
  'batch.executing': '実行中...',
  'batch.success': '{{count}} 台のサーバーで操作完了',

  // Alert Rule Engine
  'alertEngine.title': 'アラートルール',
  'alertEngine.addRule': '+ ルール追加',
  'alertEngine.metric': 'メトリック',
  'alertEngine.operator': '演算子',
  'alertEngine.threshold': '閾値',
  'alertEngine.duration': '持続時間',
  'alertEngine.enabled': '有効',
  'alertEngine.active': 'アクティブ',
  'alertEngine.triggered': 'トリガー済み',
  'alertEngine.temp': 'GPU 温度',
  'alertEngine.util': 'GPU 使用率',
  'alertEngine.power': '電力使用量',
  'alertEngine.flow': '冷却流量',
  'alertEngine.seconds': '{{val}}秒',

  // AI/ML Prediction Engine
  'mlEngine.title': 'AI/ML 予測エンジン',
  'mlEngine.subtitle': '予知保全 · 異常検知 · キャパシティプランニング',
  'mlEngine.prediction': '障害予測',
  'mlEngine.anomaly': '異常スコア',
  'mlEngine.capacity': 'キャパシティ予測',
  'mlEngine.health': 'フリートヘルスインデックス',
  'mlEngine.trend': 'トレンド分析',
  'mlEngine.confidence': '信頼度',
  'mlEngine.nextFailure': '次の予測障害',
  'mlEngine.hours': '{{val}}時間',
  'mlEngine.demoNote': '⚠ デモモード — シミュレートされたML推論',
  'mlEngine.thermalForecast': '温度予測（今後24時間）',
  'mlEngine.failureProbability': 'コンポーネント障害確率',
  'mlEngine.capacityPlanning': 'キャパシティプランニング',

  // Keyboard shortcuts
  'shortcuts.title': 'キーボードショートカット',
  'shortcuts.arrows': '矢印キー — ラックグリッドのナビゲーション',
  'shortcuts.enter': 'Enter — サーバー詳細を開く',
  'shortcuts.escape': 'Escape — パネルを閉じる',
  'shortcuts.p': 'P — パニックモード発動',
  'shortcuts.r': 'R — 全サーバーリセット',
  'shortcuts.b': 'B — バッチモード切替',
  'shortcuts.questionMark': '? — ショートカットヘルプ表示',

  // Server Filter
  'filter.searchPlaceholder': 'サーバー検索 (ID、名前、ラック)...',
  'filter.allStatus': '全ステータス',
  'filter.normal': '正常',
  'filter.warning': '警告',
  'filter.critical': '重大',
  'filter.allRacks': '全ラック',
  'filter.rack': 'ラック',
  'filter.sortId': 'ソート：ID',
  'filter.sortTemp': 'ソート：温度 ↓',
  'filter.sortPower': 'ソート：電力 ↓',
  'filter.sortAnomaly': 'ソート：異常 ↓',

  // Event Timeline
  'events.title': 'システムイベントログ (SEL)',
  'events.all': '全て',
  'events.autoScroll': '自動スクロール',
  'events.noEvents': 'イベントなし',

  // GPU ECC Tracker
  'ecc.title': 'GPU メモリ ECC トラッカー (DCGM)',
  'ecc.correctableErrors': '訂正可能',
  'ecc.uncorrectableErrors': '訂正不能',
  'ecc.retiredPages': 'リタイアページ',
  'ecc.xidServers': 'XID サーバー',
  'ecc.sortUE': 'ソート：訂正不能',
  'ecc.sortCE': 'ソート：訂正可能',
  'ecc.sortRetired': 'ソート：リタイアページ',
  'ecc.sortXid': 'ソート：XID エラー',
  'ecc.onlyErrors': 'エラーのみ',
  'ecc.server': 'サーバー',
  'ecc.retired': 'リタイア',
  'ecc.demoNote': 'シミュレートされたDCGMデータ — 本番ではnvidia-smi / DCGMに接続',

  // NVSwitch Monitor
  'nvswitch.title': 'NVSwitch ファブリック監視',
  'nvswitch.totalBw': '総スループット',
  'nvswitch.maxTemp': '最高スイッチ温度',
  'nvswitch.degradedLinks': '劣化リンク',
  'nvswitch.totalPower': 'スイッチ電力',
  'nvswitch.detail': '詳細',
  'nvswitch.topServers': 'NVSwitch アクティビティ上位サーバー',
  'nvswitch.backToFleet': 'フリートビューに戻る',

  // Webhook & Remediation
  'webhook.title': 'Webhook & 自動修復',
  'webhook.test': 'Webhook テスト',
  'webhook.noHistory': '修復実行履歴なし',
};
