import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsOptions {
  selectedServer: number | null;
  setSelectedServer: (id: number | null) => void;
  onPanic: () => void;
  onReset: () => void;
  batchMode: boolean;
  setBatchMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  panelOpen: boolean;
  onClosePanel: () => void;
  showShortcuts: boolean;
  setShowShortcuts: (v: boolean | ((prev: boolean) => boolean)) => void;
}

const GRID_COLS = 10;
const GRID_ROWS = 10;
const TOTAL = GRID_COLS * GRID_ROWS;

export function useKeyboardShortcuts({
  selectedServer,
  setSelectedServer,
  onPanic,
  onReset,
  batchMode,
  setBatchMode,
  panelOpen,
  onClosePanel,
  showShortcuts,
  setShowShortcuts,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case 'Escape':
          if (showShortcuts) {
            setShowShortcuts(false);
          } else if (panelOpen) {
            onClosePanel();
          } else if (batchMode) {
            setBatchMode(false);
          }
          e.preventDefault();
          break;

        case 'ArrowUp': {
          e.preventDefault();
          const cur = selectedServer ?? GRID_COLS; // default to first row+1
          const next = cur - GRID_COLS;
          if (next >= 0) setSelectedServer(next);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const cur = selectedServer ?? -GRID_COLS; // default to row -1
          const next = cur + GRID_COLS;
          if (next < TOTAL) setSelectedServer(next);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const cur = selectedServer ?? 1;
          const next = cur - 1;
          if (next >= 0) setSelectedServer(next);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const cur = selectedServer ?? -1;
          const next = cur + 1;
          if (next < TOTAL) setSelectedServer(next);
          break;
        }

        case 'Enter':
          // Enter opens detail, already handled by selection
          break;

        case 'p':
        case 'P':
          if (!panelOpen) {
            onPanic();
            e.preventDefault();
          }
          break;

        case 'r':
        case 'R':
          if (!panelOpen) {
            onReset();
            e.preventDefault();
          }
          break;

        case 'b':
        case 'B':
          if (!panelOpen) {
            setBatchMode((prev: boolean) => !prev);
            e.preventDefault();
          }
          break;

        case '?':
          setShowShortcuts((prev: boolean) => !prev);
          e.preventDefault();
          break;
      }
    },
    [selectedServer, setSelectedServer, onPanic, onReset, batchMode, setBatchMode, panelOpen, onClosePanel, showShortcuts, setShowShortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
