import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import type { ServerTelemetry } from '../types';

interface FlowVisualizerProps {
  server: ServerTelemetry | null;
}

export default function LiquidCoolingFlow({ server }: FlowVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const frameRef = useRef(0);

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

    const gfx = new PIXI.Graphics();
    app.stage.addChild(gfx);

    const flowRate = { current: 10 };
    const inletTemp = { current: 22 };
    const outletTemp = { current: 38 };

    const draw = () => {
      frameRef.current++;
      const frame = frameRef.current;
      const w = app.screen.width;
      const h = app.screen.height;

      gfx.clear();

      // Pipe layout
      const pipeW = 14;
      const leftX = 30;
      const rightX = w - 30;
      const topY = 30;
      const botY = h - 30;
      const midY = h / 2;

      // Inlet pipe (cold - blue/cyan)
      gfx.lineStyle(pipeW, 0x1a3a5a, 0.6);
      gfx.moveTo(leftX, topY);
      gfx.lineTo(leftX, botY);
      gfx.lineStyle(pipeW, 0x1a3a5a, 0.6);
      gfx.moveTo(leftX, botY);
      gfx.lineTo(rightX, botY);

      // Outlet pipe (warm - orange/red)
      gfx.lineStyle(pipeW, 0x3a2a1a, 0.6);
      gfx.moveTo(rightX, botY);
      gfx.lineTo(rightX, topY);
      gfx.lineStyle(pipeW, 0x3a2a1a, 0.6);
      gfx.moveTo(rightX, topY);
      gfx.lineTo(leftX, topY);

      // Heat exchange zone in center
      gfx.beginFill(0x111820, 0.5);
      gfx.drawRoundedRect(w * 0.25, midY - 20, w * 0.5, 40, 6);
      gfx.endFill();
      gfx.lineStyle(1, 0x1e2a3a, 0.5);
      gfx.drawRoundedRect(w * 0.25, midY - 20, w * 0.5, 40, 6);

      // Flow particles (inlet - cool)
      const speed = flowRate.current / 15;
      const numParticles = Math.round(8 + speed * 12);
      
      for (let p = 0; p < numParticles; p++) {
        const t = ((frame * speed * 0.01 + p / numParticles) % 1);
        let px: number, py: number;
        
        // Path: top-left -> bottom-left -> bottom-right -> top-right (loop)
        const totalLen = (botY - topY) * 2 + (rightX - leftX) * 2;
        const pos = t * totalLen;
        
        const seg1 = botY - topY; // left side down
        const seg2 = seg1 + (rightX - leftX); // bottom across
        const seg3 = seg2 + (botY - topY); // right side up
        
        if (pos < seg1) {
          // Left pipe going down (inlet)
          px = leftX;
          py = topY + pos;
          const coolness = 1 - pos / seg1 * 0.5;
          gfx.beginFill(lerpColorNum(0x39d2c0, 0x58a6ff, coolness), 0.7);
        } else if (pos < seg2) {
          // Bottom pipe going right
          px = leftX + (pos - seg1);
          py = botY;
          gfx.beginFill(0x39d2c0, 0.6);
        } else if (pos < seg3) {
          // Right pipe going up (outlet - warm)
          px = rightX;
          py = botY - (pos - seg2);
          const warmth = (pos - seg2) / (seg3 - seg2);
          gfx.beginFill(lerpColorNum(0xf0c040, 0xf85149, warmth), 0.7);
        } else {
          // Top pipe going left (return)
          px = rightX - (pos - seg3);
          py = topY;
          gfx.beginFill(0xf0c040, 0.5);
        }
        
        const size = 2 + speed * 1.5;
        gfx.drawCircle(px, py, size);
        gfx.endFill();
      }

      // Labels
      // (Drawn as part of graphics for simplicity)
    };

    app.ticker.add(draw);

    // Update values from telemetry
    const updateInterval = setInterval(() => {
      if (server) {
        flowRate.current = server.thermal.liquidCoolingFlowRate;
        inletTemp.current = server.thermal.inletTemp;
        outletTemp.current = server.thermal.outletTemp;
      }
    }, 100);

    // Workaround: store server ref for interval
    (app as any)._serverRef = server;

    return () => {
      clearInterval(updateInterval);
      app.destroy(true, { children: true });
      appRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update server reference without recreating the app
  useEffect(() => {
    if (appRef.current) {
      (appRef.current as any)._serverRef = server;
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

function lerpColorNum(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
