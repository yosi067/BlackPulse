export default {
  // Header
  'header.title': 'OmniCenter AI',
  'header.subtitle': 'Blackwell NVL72 Fleet Monitor',
  'header.machines': 'MACHINES',
  'header.avgPue': 'AVG PUE',
  'header.totalPower': 'TOTAL POWER',
  'header.alerts': 'ALERTS',
  'header.panic': '⚡ PANIC',
  'header.reset': '↻ RESET',

  // Rack heatmap
  'rack.title': 'Rack Heatmap',
  'rack.subtitle': '10×10 server grid · real-time temperature',
  'rack.normal': 'Normal',
  'rack.warning': 'Warning',
  'rack.critical': 'Critical',

  // Server detail
  'detail.maxTemp': 'Max Temp',
  'detail.avgTemp': 'Avg Temp',
  'detail.gpuUtil': 'GPU Util',
  'detail.power': 'Power',
  'detail.pue': 'PUE',
  'detail.flowRate': 'Flow Rate',
  'detail.rack': 'Rack {{rack}} · Position {{pos}}',
  'detail.gpuFlame': 'GPU Thermal Flame Graph — 72 Cores',
  'detail.nvlink': 'NVLink Interconnect Topology',
  'detail.liquidCooling': 'Liquid Cooling Flow',

  // AIOps
  'aiops.title': 'AIOps Predictions',
  'aiops.activeAlerts': '{{count}} active alerts',
  'aiops.nominal': 'All systems nominal',

  // Batch Operations
  'batch.title': 'Batch Operations',
  'batch.selectedCount': '{{count}} servers selected',
  'batch.selectAll': 'Select All',
  'batch.deselectAll': 'Deselect All',
  'batch.reboot': 'Reboot',
  'batch.firmwareUpdate': 'Firmware Update',
  'batch.coolingBoost': 'Cooling Boost',
  'batch.powerCap': 'Power Cap',
  'batch.confirm': 'Confirm {{action}} on {{count}} servers?',
  'batch.executing': 'Executing...',
  'batch.success': 'Operation completed on {{count}} servers',

  // Alert Rule Engine
  'alertEngine.title': 'Alert Rules',
  'alertEngine.addRule': '+ Add Rule',
  'alertEngine.metric': 'Metric',
  'alertEngine.operator': 'Operator',
  'alertEngine.threshold': 'Threshold',
  'alertEngine.duration': 'Duration',
  'alertEngine.enabled': 'Enabled',
  'alertEngine.active': 'Active',
  'alertEngine.triggered': 'Triggered',
  'alertEngine.temp': 'GPU Temperature',
  'alertEngine.util': 'GPU Utilization',
  'alertEngine.power': 'Power Usage',
  'alertEngine.flow': 'Coolant Flow',
  'alertEngine.seconds': '{{val}}s',

  // AI/ML Prediction Engine
  'mlEngine.title': 'AI/ML Prediction Engine',
  'mlEngine.subtitle': 'Predictive Maintenance · Anomaly Detection · Capacity Planning',
  'mlEngine.prediction': 'Failure Prediction',
  'mlEngine.anomaly': 'Anomaly Score',
  'mlEngine.capacity': 'Capacity Forecast',
  'mlEngine.health': 'Fleet Health Index',
  'mlEngine.trend': 'Trend Analysis',
  'mlEngine.confidence': 'Confidence',
  'mlEngine.nextFailure': 'Next Predicted Failure',
  'mlEngine.hours': '{{val}}h',
  'mlEngine.demoNote': '⚠ Demo mode — simulated ML inference',
  'mlEngine.thermalForecast': 'Thermal Forecast (next 24h)',
  'mlEngine.failureProbability': 'Component Failure Probability',
  'mlEngine.capacityPlanning': 'Capacity Planning',

  // Keyboard shortcuts
  'shortcuts.title': 'Keyboard Shortcuts',
  'shortcuts.arrows': 'Arrow Keys — Navigate rack grid',
  'shortcuts.enter': 'Enter — Open server detail',
  'shortcuts.escape': 'Escape — Close panel',
  'shortcuts.p': 'P — Trigger Panic mode',
  'shortcuts.r': 'R — Reset all servers',
  'shortcuts.b': 'B — Toggle batch mode',
  'shortcuts.questionMark': '? — Show shortcuts help',

  // Server Filter
  'filter.searchPlaceholder': 'Search servers (ID, name, rack)...',
  'filter.allStatus': 'All Status',
  'filter.normal': 'Normal',
  'filter.warning': 'Warning',
  'filter.critical': 'Critical',
  'filter.allRacks': 'All Racks',
  'filter.rack': 'Rack',
  'filter.sortId': 'Sort: ID',
  'filter.sortTemp': 'Sort: Temp ↓',
  'filter.sortPower': 'Sort: Power ↓',
  'filter.sortAnomaly': 'Sort: Anomaly ↓',

  // Event Timeline
  'events.title': 'System Event Log (SEL)',
  'events.all': 'All',
  'events.autoScroll': 'Auto-scroll',
  'events.noEvents': 'No events recorded',

  // GPU ECC Tracker
  'ecc.title': 'GPU Memory ECC Tracker (DCGM)',
  'ecc.correctableErrors': 'Correctable',
  'ecc.uncorrectableErrors': 'Uncorrectable',
  'ecc.retiredPages': 'Retired Pages',
  'ecc.xidServers': 'XID Servers',
  'ecc.sortUE': 'Sort: Uncorrectable',
  'ecc.sortCE': 'Sort: Correctable',
  'ecc.sortRetired': 'Sort: Retired Pages',
  'ecc.sortXid': 'Sort: XID Errors',
  'ecc.onlyErrors': 'Errors only',
  'ecc.server': 'Server',
  'ecc.retired': 'Retired',
  'ecc.demoNote': 'Simulated DCGM data — connect to real nvidia-smi / DCGM for production',

  // NVSwitch Monitor
  'nvswitch.title': 'NVSwitch Fabric Monitor',
  'nvswitch.totalBw': 'Total Throughput',
  'nvswitch.maxTemp': 'Max Switch Temp',
  'nvswitch.degradedLinks': 'Degraded Links',
  'nvswitch.totalPower': 'Switch Power',
  'nvswitch.detail': 'Detail',
  'nvswitch.topServers': 'Top Servers by NVSwitch Activity',
  'nvswitch.backToFleet': 'Back to Fleet View',

  // Webhook & Remediation
  'webhook.title': 'Webhooks & Auto-Remediation',
  'webhook.test': 'Test Webhook',
  'webhook.noHistory': 'No remediation executions yet',
};
