import type { ServerTelemetry } from '../types';
import { getHealthStatus, getHealthCSSColor } from '../types';
import styles from './ServerDetail.module.css';
import GPUFlameGraph from './GPUFlameGraph';
import NVLinkTopology from './NVLinkTopology';
import LiquidCoolingFlow from './LiquidCoolingFlow';

interface ServerDetailProps {
  server: ServerTelemetry | null;
  onClose: () => void;
}

export default function ServerDetail({ server, onClose }: ServerDetailProps) {
  if (!server) return null;

  const maxTemp = Math.max(...server.thermal.gpuCoreTemps);
  const avgTemp = server.thermal.gpuCoreTemps.reduce((a, b) => a + b, 0) / server.thermal.gpuCoreTemps.length;
  const avgUtil = server.compute.gpuUtilization.reduce((a, b) => a + b, 0) / server.compute.gpuUtilization.length;
  const status = getHealthStatus(maxTemp);
  const statusColor = getHealthCSSColor(status);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.serverName}>
              GB200-NVL72-{String(server.serverId).padStart(3, '0')}
            </div>
            <div className={styles.serverMeta}>
              Rack {Math.floor(server.serverId / 10)} · Position {server.serverId % 10}
            </div>
          </div>
          <div className={styles.statusGroup}>
            <div className={styles.statusBadge} style={{ borderColor: statusColor, color: statusColor }}>
              {status.toUpperCase()}
            </div>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div className={styles.quickStats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Max Temp</span>
            <span className={styles.statValue} style={{ color: statusColor }}>{maxTemp.toFixed(1)}°C</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Avg Temp</span>
            <span className={styles.statValue}>{avgTemp.toFixed(1)}°C</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>GPU Util</span>
            <span className={styles.statValue}>{avgUtil.toFixed(1)}%</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Power</span>
            <span className={styles.statValue}>{(server.power.chassisWattage / 1000).toFixed(1)} kW</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>PUE</span>
            <span className={styles.statValue}>{server.power.pue.toFixed(2)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Flow Rate</span>
            <span className={styles.statValue}>{server.thermal.liquidCoolingFlowRate.toFixed(1)} L/min</span>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.cell}>
            <div className={styles.cellTitle}>GPU Thermal Flame Graph — 72 Cores</div>
            <div className={styles.cellContent}>
              <GPUFlameGraph server={server} />
            </div>
          </div>
          <div className={styles.cell}>
            <div className={styles.cellTitle}>NVLink Interconnect Topology</div>
            <div className={styles.cellContentSmall}>
              <NVLinkTopology server={server} />
            </div>
          </div>
          <div className={styles.cell}>
            <div className={styles.cellTitle}>Liquid Cooling Flow</div>
            <div className={styles.cellContentSmall}>
              <LiquidCoolingFlow server={server} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
