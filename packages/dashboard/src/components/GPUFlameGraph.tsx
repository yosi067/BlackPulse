import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import type { ServerTelemetry } from '../types';

const NUM_GPUS = 72;
const BAR_GAP = 1;

function tempToColor(temp: number): number {
  if (temp < 50) return 0x1a3a2a;
  if (temp < 60) {
    const t = (temp - 50) / 10;
    return lerpColor(0x1a5a2a, 0x76d276, t);
  }
  if (temp < 75) {
    const t = (temp - 60) / 15;
    return lerpColor(0x76d276, 0xf0c040, t);
  }
  if (temp < 85) {
    const t = (temp - 75) / 10;
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

interface FlameGraphProps {
  server: ServerTelemetry | null;
}

export default function GPUFlameGraph({ server }: FlameGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const barsRef = useRef<PIXI.Graphics | null>(null);
  const labelsRef = useRef<PIXI.Container | null>(null);

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

    const bars = new PIXI.Graphics();
    app.stage.addChild(bars);
    barsRef.current = bars;

    const labels = new PIXI.Container();
    app.stage.addChild(labels);
    labelsRef.current = labels;

    // Y-axis labels
    const axisLabels = [100, 80, 60, 40];
    for (const val of axisLabels) {
      const txt = new PIXI.Text(`${val}°`, {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 8,
        fill: 0x484f58,
      });
      txt.anchor.set(1, 0.5);
      txt.name = `axis_${val}`;
      labels.addChild(txt);
    }

    return () => {
      app.destroy(true, { children: true });
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!appRef.current || !barsRef.current || !labelsRef.current) return;

    const app = appRef.current;
    const gfx = barsRef.current;
    const labels = labelsRef.current;

    gfx.clear();

    const w = app.screen.width;
    const h = app.screen.height;
    const leftMargin = 30;
    const bottomMargin = 4;
    const topMargin = 8;
    const chartW = w - leftMargin - 8;
    const chartH = h - topMargin - bottomMargin;
    const barW = Math.max(1, (chartW - BAR_GAP * (NUM_GPUS - 1)) / NUM_GPUS);

    // Grid lines
    const gridValues = [100, 80, 60, 40];
    gfx.lineStyle(0.5, 0x1e2a3a, 0.5);
    for (const val of gridValues) {
      const y = topMargin + chartH - (val / 105) * chartH;
      gfx.moveTo(leftMargin, y);
      gfx.lineTo(w - 8, y);

      const label = labels.getChildByName(`axis_${val}`) as PIXI.Text;
      if (label) {
        label.position.set(leftMargin - 4, y);
      }
    }

    if (!server) {
      // No data - draw empty bars
      gfx.lineStyle(0);
      for (let i = 0; i < NUM_GPUS; i++) {
        const x = leftMargin + i * (barW + BAR_GAP);
        gfx.beginFill(0x111820, 0.5);
        gfx.drawRect(x, topMargin + chartH - 2, barW, 2);
        gfx.endFill();
      }
      return;
    }

    const temps = server.thermal.gpuCoreTemps;
    gfx.lineStyle(0);

    for (let i = 0; i < NUM_GPUS; i++) {
      const temp = temps[i] ?? 0;
      const barH = Math.max(2, (temp / 105) * chartH);
      const x = leftMargin + i * (barW + BAR_GAP);
      const y = topMargin + chartH - barH;
      const color = tempToColor(temp);

      // Bar with gradient effect (bottom darker)
      gfx.beginFill(color, 0.85);
      gfx.drawRect(x, y, barW, barH);
      gfx.endFill();

      // Top glow for hot GPUs
      if (temp > 80) {
        gfx.beginFill(0xf85149, 0.3);
        gfx.drawRect(x - 1, y - 2, barW + 2, 4);
        gfx.endFill();
      }
    }
  }, [server]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    />
  );
}
