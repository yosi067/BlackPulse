// Auto-Remediation Engine — models Ansible-style automated playbooks
// Reference: Supermicro SSM, NVIDIA Base Command remediation workflows

const playbooks = new Map();
const executionHistory = [];
const MAX_HISTORY = 100;
let executionId = 1;

// Default playbooks — modeled after real DCIM remediation actions
const DEFAULT_PLAYBOOKS = [
  {
    id: 'pb_thermal_throttle',
    name: 'Thermal Throttle Mitigation',
    trigger: { eventType: 'Temperature Critical', minSeverity: 'critical' },
    enabled: true,
    cooldownMs: 120000, // 2 min cooldown per server
    steps: [
      { action: 'increase_fan_speed', target: '100%', description: 'Set fan speed to maximum', durationMs: 2000 },
      { action: 'boost_coolant_flow', target: '18 L/min', description: 'Boost CDU coolant flow to maximum', durationMs: 3000 },
      { action: 'apply_power_cap', target: '10000W', description: 'Apply temporary power cap (10 kW)', durationMs: 1000 },
      { action: 'notify_ops', target: 'PagerDuty', description: 'Notify on-call engineer', durationMs: 500 },
    ],
    successRate: 0.85,  // 85% of the time this resolves the issue
  },
  {
    id: 'pb_ecc_page_retirement',
    name: 'GPU ECC Error Response',
    trigger: { eventType: 'ECC Uncorrectable Error', minSeverity: 'critical' },
    enabled: true,
    cooldownMs: 300000, // 5 min cooldown
    steps: [
      { action: 'log_ecc_details', description: 'Capture DCGM diagnostics', durationMs: 5000 },
      { action: 'schedule_page_retirement', description: 'Queue affected pages for retirement', durationMs: 1000 },
      { action: 'check_retirement_threshold', description: 'Verify retired pages < 256', durationMs: 500 },
      { action: 'schedule_gpu_reset', description: 'Schedule GPU reset at next maintenance window', durationMs: 1000 },
      { action: 'notify_ops', target: 'PagerDuty + Slack', description: 'Escalate to GPU ops team', durationMs: 500 },
    ],
    successRate: 0.70,
  },
  {
    id: 'pb_nvlink_recovery',
    name: 'NVLink Degraded Link Recovery',
    trigger: { eventType: 'NVLink State Change', minSeverity: 'warning' },
    enabled: true,
    cooldownMs: 180000,
    steps: [
      { action: 'nvlink_retrain', description: 'Initiate NVLink link retraining', durationMs: 8000 },
      { action: 'verify_bandwidth', description: 'Verify link bandwidth restored', durationMs: 3000 },
      { action: 'update_topology', description: 'Update NVLink topology map', durationMs: 1000 },
    ],
    successRate: 0.90,
  },
  {
    id: 'pb_psu_failover',
    name: 'PSU Redundancy Failover',
    trigger: { eventType: 'PSU Status Change', minSeverity: 'warning' },
    enabled: true,
    cooldownMs: 600000,
    steps: [
      { action: 'verify_redundancy', description: 'Check N+1 PSU redundancy status', durationMs: 2000 },
      { action: 'redistribute_load', description: 'Redistribute power across remaining PSUs', durationMs: 3000 },
      { action: 'create_rma', description: 'Create RMA ticket for failed PSU', durationMs: 1000 },
      { action: 'notify_ops', target: 'ServiceNow', description: 'Create incident in ITSM', durationMs: 500 },
    ],
    successRate: 0.95,
  },
  {
    id: 'pb_coolant_flow',
    name: 'Coolant Flow Recovery',
    trigger: { eventType: 'Coolant Flow Alert', minSeverity: 'warning' },
    enabled: true,
    cooldownMs: 120000,
    steps: [
      { action: 'check_cdu_status', description: 'Query CDU pump health via Modbus', durationMs: 3000 },
      { action: 'increase_pump_speed', description: 'Increase CDU pump speed to 100%', durationMs: 2000 },
      { action: 'check_valve_positions', description: 'Verify all manifold valves open', durationMs: 2000 },
      { action: 'verify_flow_restored', description: 'Confirm flow rate > 6 L/min', durationMs: 5000 },
    ],
    successRate: 0.80,
  },
];

// Initialize
for (const pb of DEFAULT_PLAYBOOKS) {
  playbooks.set(pb.id, { ...pb, lastExecutedPerServer: new Map() });
}

/**
 * Check if any enabled playbooks should trigger for the given event.
 * Returns execution results.
 */
export function evaluateAndExecute(event) {
  const results = [];

  for (const [id, playbook] of playbooks) {
    if (!playbook.enabled) continue;
    if (!event.type.includes(playbook.trigger.eventType)) continue;

    // Severity check
    const sevOrder = { info: 0, warning: 1, critical: 2 };
    if (sevOrder[event.severity] < sevOrder[playbook.trigger.minSeverity]) continue;

    // Cooldown check
    const lastExec = playbook.lastExecutedPerServer.get(event.serverId) || 0;
    if (Date.now() - lastExec < playbook.cooldownMs) {
      results.push({
        playbookId: id,
        playbookName: playbook.name,
        status: 'cooldown',
        serverId: event.serverId,
      });
      continue;
    }

    // Simulate execution
    const success = Math.random() < playbook.successRate;
    const totalDuration = playbook.steps.reduce((s, step) => s + step.durationMs, 0);

    const execution = {
      id: `exec-${executionId++}`,
      playbookId: id,
      playbookName: playbook.name,
      eventId: event.id,
      serverId: event.serverId,
      startedAt: Date.now(),
      completedAt: Date.now() + totalDuration,
      status: success ? 'success' : 'partial_failure',
      steps: playbook.steps.map((step, idx) => ({
        ...step,
        status: success || idx < playbook.steps.length - 1 ? 'completed' : 'failed',
        startedAt: Date.now() + playbook.steps.slice(0, idx).reduce((s, st) => s + st.durationMs, 0),
        completedAt: Date.now() + playbook.steps.slice(0, idx + 1).reduce((s, st) => s + st.durationMs, 0),
      })),
      durationMs: totalDuration,
    };

    playbook.lastExecutedPerServer.set(event.serverId, Date.now());

    executionHistory.push(execution);
    if (executionHistory.length > MAX_HISTORY) {
      executionHistory.splice(0, executionHistory.length - MAX_HISTORY);
    }

    results.push(execution);
  }

  return results;
}

export function getPlaybooks() {
  return Array.from(playbooks.values()).map(({ lastExecutedPerServer, ...rest }) => rest);
}

export function updatePlaybook(id, updates) {
  const pb = playbooks.get(id);
  if (!pb) return null;
  Object.assign(pb, updates);
  return { ...pb, lastExecutedPerServer: undefined };
}

export function getExecutionHistory(limit = 50) {
  return executionHistory.slice(-limit).reverse();
}

export function getRemediationStats() {
  const recent = executionHistory.filter(e => Date.now() - e.startedAt < 3600000);
  return {
    totalExecutions: executionHistory.length,
    last1h: recent.length,
    successRate: recent.length > 0
      ? recent.filter(e => e.status === 'success').length / recent.length
      : 0,
    byPlaybook: Object.fromEntries(
      Array.from(playbooks.keys()).map(id => [
        id,
        {
          executions: recent.filter(e => e.playbookId === id).length,
          successes: recent.filter(e => e.playbookId === id && e.status === 'success').length,
        },
      ])
    ),
  };
}
