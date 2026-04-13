import { useState, useCallback } from 'react';
import { useTelemetry } from './hooks/useTelemetry';
import GlobalHeader from './components/GlobalHeader';
import RackHeatmap from './components/RackHeatmap';
import AIOpsPanel from './components/AIOpsPanel';
import ServerDetail from './components/ServerDetail';
import styles from './App.module.css';

export default function App() {
  const { data, connected, triggerPanic, resetPanic } = useTelemetry();
  const [selectedServer, setSelectedServer] = useState<number | null>(null);

  const handlePanic = useCallback(async () => {
    const affected = await triggerPanic();
    console.log('Panic triggered on servers:', affected);
  }, [triggerPanic]);

  const handleReset = useCallback(async () => {
    await resetPanic();
    console.log('All servers reset');
  }, [resetPanic]);

  const agg = data?.aggregation ?? { totalServers: 0, avgPue: 0, totalWattageKW: 0, alertCount: 0 };

  const selectedServerData = selectedServer !== null && data?.rawBatch
    ? data.rawBatch.find(s => s.serverId === selectedServer) ?? null
    : null;

  return (
    <div className={styles.app}>
      <GlobalHeader
        totalServers={agg.totalServers}
        avgPue={agg.avgPue}
        totalWattageKW={agg.totalWattageKW}
        alertCount={agg.alertCount}
        connected={connected}
        onPanic={handlePanic}
        onReset={handleReset}
      />

      <div className={styles.body}>
        <main className={styles.main}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Rack Heatmap</span>
            <span className={styles.sectionSub}>10×10 server grid · real-time temperature</span>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={styles.dot} style={{ background: '#76d276' }} />
                Normal
              </span>
              <span className={styles.legendItem}>
                <span className={styles.dot} style={{ background: '#f0c040' }} />
                Warning
              </span>
              <span className={styles.legendItem}>
                <span className={styles.dot} style={{ background: '#f85149' }} />
                Critical
              </span>
            </div>
          </div>
          <div className={styles.heatmapContainer}>
            <RackHeatmap
              data={data}
              selectedServer={selectedServer}
              onSelectServer={setSelectedServer}
            />
          </div>
        </main>

        <aside className={styles.sidebar}>
          <AIOpsPanel rawBatch={data?.rawBatch ?? null} />
        </aside>
      </div>

      {selectedServer !== null && (
        <ServerDetail
          server={selectedServerData}
          onClose={() => setSelectedServer(null)}
        />
      )}
    </div>
  );
}
