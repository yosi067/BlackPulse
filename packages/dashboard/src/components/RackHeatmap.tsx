import { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import type { ProcessedData } from '../hooks/useTelemetry';
import type { ServerTelemetry } from '../types';
import { createHeatCellFilter, hexToRgb } from '../shaders/gpu-effects';

const GRID_COLS = 10;
const GRID_ROWS = 10;
const CELL_PAD = 4;
const SPARKLINE_POINTS = 30;
const HEADER_H = 20;

// Color interpolation: green -> yellow -> red based on anomaly score
function tempToColor(anomaly: number): number {
  if (anomaly <= 0) return 0x1a3a2a; // dark green
  if (anomaly < 0.3) {
    const t = anomaly / 0.3;
    return lerpColor(0x76d276, 0xf0c040, t);
  }
  if (anomaly < 0.7) {
    const t = (anomaly - 0.3) / 0.4;
    return lerpColor(0xf0c040, 0xf85149, t);
  }
  return 0xf85149;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function statusText(maxTemp: number): string {
  if (maxTemp >= 85) return 'CRIT';
  if (maxTemp >= 75) return 'WARN';
  return 'OK';
}

interface RackHeatmapProps {
  data: ProcessedData | null;
  onSelectServer?: (serverId: number) => void;
  selectedServer?: number | null;
  batchMode?: boolean;
  batchSelected?: Set<number>;
  filteredIds?: number[];
}

export default function RackHeatmap({ data, onSelectServer, selectedServer, batchMode, batchSelected, filteredIds }: RackHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const cellsRef = useRef<PIXI.Container[]>([]);
  const cellBgRef = useRef<PIXI.Graphics[]>([]);
  const sparkGfxRef = useRef<PIXI.Graphics[]>([]);
  const labelRef = useRef<PIXI.Text[]>([]);
  const tempLabelRef = useRef<PIXI.Text[]>([]);
  const borderRef = useRef<PIXI.Graphics[]>([]);
  const glowRef = useRef<PIXI.Graphics[]>([]);
  const filtersRef = useRef<PIXI.Filter[]>([]);
  const startTimeRef = useRef(Date.now());

  // Initialize Pixi application
  useEffect(() => {
    if (!containerRef.current) return;

    const app = new PIXI.Application({
      resizeTo: containerRef.current,
      backgroundColor: 0x0b0e14,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    containerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    // Create cells
    const numServers = GRID_COLS * GRID_ROWS;
    for (let i = 0; i < numServers; i++) {
      const cell = new PIXI.Container();
      cell.eventMode = 'static';
      cell.cursor = 'pointer';
      cell.on('pointertap', () => onSelectServer?.(i));

      const glow = new PIXI.Graphics();
      cell.addChild(glow);
      glowRef.current.push(glow);

      const bg = new PIXI.Graphics();
      cell.addChild(bg);
      cellBgRef.current.push(bg);

      const border = new PIXI.Graphics();
      cell.addChild(border);
      borderRef.current.push(border);

      const label = new PIXI.Text(`S${String(i).padStart(3, '0')}`, {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9,
        fill: 0x8b949e,
      });
      label.anchor.set(0, 0);
      cell.addChild(label);
      labelRef.current.push(label);

      const tempLabel = new PIXI.Text('--°C', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9,
        fill: 0xe6edf3,
      });
      tempLabel.anchor.set(1, 0);
      cell.addChild(tempLabel);
      tempLabelRef.current.push(tempLabel);

      const spark = new PIXI.Graphics();
      cell.addChild(spark);
      sparkGfxRef.current.push(spark);

      // Create GLSL heat cell shader filter
      try {
        const filter = createHeatCellFilter();
        cell.filters = [filter];
        filtersRef.current.push(filter);
      } catch {
        // Shader not supported, skip
        filtersRef.current.push(null as any);
      }

      app.stage.addChild(cell);
      cellsRef.current.push(cell);
    }

    const resize = () => layoutCells(app);
    window.addEventListener('resize', resize);
    layoutCells(app);

    // Animate shader time uniforms
    app.ticker.add(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      for (const filter of filtersRef.current) {
        if (filter && filter.uniforms) {
          filter.uniforms.uTime = elapsed;
        }
      }
    });

    return () => {
      window.removeEventListener('resize', resize);
      app.destroy(true, { children: true, texture: true });
      appRef.current = null;
      cellsRef.current = [];
      cellBgRef.current = [];
      sparkGfxRef.current = [];
      labelRef.current = [];
      tempLabelRef.current = [];
      borderRef.current = [];
      glowRef.current = [];
      filtersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layoutCells = useCallback((app: PIXI.Application) => {
    const w = app.screen.width;
    const h = app.screen.height;
    const cellW = (w - CELL_PAD * (GRID_COLS + 1)) / GRID_COLS;
    const cellH = (h - CELL_PAD * (GRID_ROWS + 1)) / GRID_ROWS;

    for (let i = 0; i < cellsRef.current.length; i++) {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = CELL_PAD + col * (cellW + CELL_PAD);
      const y = CELL_PAD + row * (cellH + CELL_PAD);

      cellsRef.current[i].position.set(x, y);

      // Draw background
      cellBgRef.current[i].clear();
      cellBgRef.current[i].beginFill(0x111820, 0.9);
      cellBgRef.current[i].drawRoundedRect(0, 0, cellW, cellH, 3);
      cellBgRef.current[i].endFill();

      // Position labels
      labelRef.current[i].position.set(4, 2);
      tempLabelRef.current[i].position.set(cellW - 4, 2);

      // Store dimensions for sparkline drawing
      (cellsRef.current[i] as any)._cellW = cellW;
      (cellsRef.current[i] as any)._cellH = cellH;
    }
  }, []);

  // Update cells with telemetry data
  useEffect(() => {
    if (!data || !appRef.current) return;

    const numServers = Math.min(data.summaries.length / 3, cellsRef.current.length);

    for (let i = 0; i < numServers; i++) {
      const avgTemp = data.summaries[i * 3];
      const maxTemp = data.summaries[i * 3 + 1];
      const anomaly = data.summaries[i * 3 + 2];

      // Dim servers not in filter
      const isFiltered = filteredIds ? filteredIds.includes(i) : true;
      const cellW = (cellsRef.current[i] as any)._cellW || 80;
      const cellH = (cellsRef.current[i] as any)._cellH || 60;
      const color = tempToColor(anomaly);

      // Background with gradient fill
      const bg = cellBgRef.current[i];
      bg.clear();
      bg.beginFill(color, isFiltered ? 0.15 : 0.03);
      bg.drawRoundedRect(0, 0, cellW, cellH, 3);
      bg.endFill();

      // Dim non-filtered cells
      cellsRef.current[i].alpha = isFiltered ? 1 : 0.25;

      // Border
      const border = borderRef.current[i];
      border.clear();
      const isSelected = selectedServer === i;
      const isBatchSelected = batchMode && batchSelected?.has(i);
      const borderColor = isBatchSelected ? 0x39d2c0 : isSelected ? 0x58a6ff : anomaly > 0.7 ? 0xf85149 : 0x1e2a3a;
      const borderAlpha = isBatchSelected ? 1 : isSelected ? 1 : anomaly > 0.7 ? 0.8 + Math.sin(Date.now() / 200) * 0.2 : 0.5;
      border.lineStyle(isSelected || isBatchSelected ? 2 : 1, borderColor, borderAlpha);
      border.drawRoundedRect(0, 0, cellW, cellH, 3);

      // Batch mode check indicator
      if (isBatchSelected) {
        border.lineStyle(0);
        border.beginFill(0x39d2c0, 0.9);
        border.drawRoundedRect(cellW - 12, 2, 10, 10, 2);
        border.endFill();
        border.lineStyle(1.5, 0x000000, 1);
        border.moveTo(cellW - 10, 7);
        border.lineTo(cellW - 7, 10);
        border.lineTo(cellW - 4, 4);
      }

      // Glow effect for critical servers
      const glow = glowRef.current[i];
      glow.clear();
      if (anomaly > 0.7) {
        glow.beginFill(0xf85149, 0.08 + Math.sin(Date.now() / 300) * 0.04);
        glow.drawRoundedRect(-2, -2, cellW + 4, cellH + 4, 5);
        glow.endFill();
      }

      // Update temp label
      tempLabelRef.current[i].text = `${Math.round(maxTemp)}°C`;
      tempLabelRef.current[i].style.fill = anomaly > 0.7 ? 0xf85149 : anomaly > 0.3 ? 0xf0c040 : 0x76d276;

      // Update shader uniforms for glow and flow effects
      const filter = filtersRef.current[i];
      if (filter && filter.uniforms) {
        filter.uniforms.uAnomaly = anomaly;
        filter.uniforms.uBandwidth = anomaly * 0.5; // Use anomaly as proxy for data flow
        filter.uniforms.uCellColor = hexToRgb(color);
      }

      // Draw sparkline
      const spark = sparkGfxRef.current[i];
      spark.clear();
      const sparkData = data.sparklines[i];
      if (sparkData && sparkData.length > 1) {
        const sparkY = HEADER_H + 2;
        const sparkH = cellH - sparkY - 4;
        const sparkW = cellW - 8;
        const x0 = 4;

        // Find data range
        let min = Infinity, max = -Infinity;
        for (let j = 0; j < sparkData.length; j++) {
          if (sparkData[j] < min) min = sparkData[j];
          if (sparkData[j] > max) max = sparkData[j];
        }
        const range = max - min || 1;

        // Fill area under the curve
        spark.beginFill(color, 0.1);
        spark.moveTo(x0, sparkY + sparkH);
        for (let j = 0; j < sparkData.length; j++) {
          const px = x0 + (j / (sparkData.length - 1)) * sparkW;
          const py = sparkY + sparkH - ((sparkData[j] - min) / range) * sparkH;
          spark.lineTo(px, py);
        }
        spark.lineTo(x0 + sparkW, sparkY + sparkH);
        spark.closePath();
        spark.endFill();

        // Draw line
        spark.lineStyle(1.5, color, 0.8);
        for (let j = 0; j < sparkData.length; j++) {
          const px = x0 + (j / (sparkData.length - 1)) * sparkW;
          const py = sparkY + sparkH - ((sparkData[j] - min) / range) * sparkH;
          if (j === 0) spark.moveTo(px, py);
          else spark.lineTo(px, py);
        }
      }
    }
  }, [data, selectedServer, batchMode, batchSelected, filteredIds]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    />
  );
}
