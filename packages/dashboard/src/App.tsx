import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTelemetry } from './hooks/useTelemetry';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import GlobalHeader from './components/GlobalHeader';
import RackHeatmap from './components/RackHeatmap';
import AIOpsPanel from './components/AIOpsPanel';
import ServerDetail from './components/ServerDetail';
import BatchOperations from './components/BatchOperations';
import AlertRuleEngine from './components/AlertRuleEngine';
import MLPredictionEngine from './components/MLPredictionEngine';
import ShortcutsHelp from './components/ShortcutsHelp';
import styles from './App.module.css';

export default function App() {
  const { t } = useTranslation();
  const { data, connected, triggerPanic, resetPanic } = useTelemetry();
  const [selectedServer, setSelectedServer] = useState<number | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<number>>(new Set());
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showMLPanel, setShowMLPanel] = useState(true);

  const handlePanic = useCallback(async () => {
    const affected = await triggerPanic();
    console.log('Panic triggered on servers:', affected);
  }, [triggerPanic]);

  const handleReset = useCallback(async () => {
    await resetPanic();
    console.log('All servers reset');
  }, [resetPanic]);

  // Batch operations handlers
  const handleToggleBatchServer = useCallback((id: number) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setBatchSelected(new Set(Array.from({ length: 100 }, (_, i) => i)));
  }, []);

  const handleDeselectAll = useCallback(() => {
    setBatchSelected(new Set());
  }, []);

  // Server selection handler (supports batch mode)
  const handleSelectServer = useCallback((id: number) => {
    if (batchMode) {
      handleToggleBatchServer(id);
    } else {
      setSelectedServer(id);
    }
  }, [batchMode, handleToggleBatchServer]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    selectedServer,
    setSelectedServer: handleSelectServer,
    onPanic: handlePanic,
    onReset: handleReset,
    batchMode,
    setBatchMode,
    panelOpen: selectedServer !== null,
    onClosePanel: () => setSelectedServer(null),
    showShortcuts,
    setShowShortcuts,
  });

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
        batchMode={batchMode}
        onToggleBatch={() => setBatchMode(prev => !prev)}
        onToggleML={() => setShowMLPanel(prev => !prev)}
        showMLPanel={showMLPanel}
      />

      <div className={styles.body}>
        <main className={styles.main}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>{t('rack.title')}</span>
            <span className={styles.sectionSub}>{t('rack.subtitle')}</span>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={styles.dot} style={{ background: '#76d276' }} />
                {t('rack.normal')}
              </span>
              <span className={styles.legendItem}>
                <span className={styles.dot} style={{ background: '#f0c040' }} />
                {t('rack.warning')}
              </span>
              <span className={styles.legendItem}>
                <span className={styles.dot} style={{ background: '#f85149' }} />
                {t('rack.critical')}
              </span>
            </div>
          </div>
          <div className={styles.heatmapContainer}>
            <RackHeatmap
              data={data}
              selectedServer={selectedServer}
              onSelectServer={handleSelectServer}
              batchMode={batchMode}
              batchSelected={batchSelected}
            />
          </div>
          {showMLPanel && (
            <MLPredictionEngine rawBatch={data?.rawBatch ?? null} />
          )}
        </main>

        <aside className={styles.sidebar}>
          <AIOpsPanel rawBatch={data?.rawBatch ?? null} />
        </aside>
      </div>

      <AlertRuleEngine rawBatch={data?.rawBatch ?? null} />

      {batchMode && (
        <BatchOperations
          batchMode={batchMode}
          selectedServers={batchSelected}
          onToggleServer={handleToggleBatchServer}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onClose={() => { setBatchMode(false); setBatchSelected(new Set()); }}
        />
      )}

      {selectedServer !== null && !batchMode && (
        <ServerDetail
          server={selectedServerData}
          onClose={() => setSelectedServer(null)}
        />
      )}

      {showShortcuts && (
        <ShortcutsHelp onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}
