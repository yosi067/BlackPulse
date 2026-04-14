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
  const dataRef = useRef({ flowRate: 10, inletTemp: 22, outletTemp: 38 });

  // Update data ref when server changes
  useEffect(() => {
    if (server) {
      dataRef.current = {
        flowRate: server.thermal.liquidCoolingFlowRate,
        inletTemp: server.thermal.inletTemp,
        outletTemp: server.thermal.outletTemp,
      };
    }
  }, [server]);

  useEffect(() => {
    if (!containerRef.current) return;

    const app = new PIXI.Application({
      resizeTo: containerRef.current,
      backgroundColor: 0x131820,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    containerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    const gfx = new PIXI.Graphics();
    app.stage.addChild(gfx);

    // Static labels container
    const labelsContainer = new PIXI.Container();
    app.stage.addChild(labelsContainer);

    // CDU label
    const cduTitle = new PIXI.Text('CDU', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: 0x58a6ff, fontWeight: '700',
    });
    cduTitle.anchor.set(0.5, 0.5);
    cduTitle.name = 'cduTitle';
    labelsContainer.addChild(cduTitle);

    const cduSub = new PIXI.Text('Coolant Distribution Unit', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 6, fill: 0x5c6370,
    });
    cduSub.anchor.set(0.5, 0);
    cduSub.name = 'cduSub';
    labelsContainer.addChild(cduSub);

    // Server heat exchanger label
    const hxTitle = new PIXI.Text('SERVER', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: 0xf0c040, fontWeight: '700',
    });
    hxTitle.anchor.set(0.5, 0.5);
    hxTitle.name = 'hxTitle';
    labelsContainer.addChild(hxTitle);

    const hxSub = new PIXI.Text('Heat Exchanger / Cold Plate', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 6, fill: 0x5c6370,
    });
    hxSub.anchor.set(0.5, 0);
    hxSub.name = 'hxSub';
    labelsContainer.addChild(hxSub);

    // Supply label
    const supplyLabel = new PIXI.Text('', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fill: 0x39d2c0, fontWeight: '600',
    });
    supplyLabel.anchor.set(0.5, 0.5);
    supplyLabel.name = 'supplyLabel';
    labelsContainer.addChild(supplyLabel);

    // Return label
    const returnLabel = new PIXI.Text('', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fill: 0xf85149, fontWeight: '600',
    });
    returnLabel.anchor.set(0.5, 0.5);
    returnLabel.name = 'returnLabel';
    labelsContainer.addChild(returnLabel);

    // Flow rate label
    const flowLabel = new PIXI.Text('', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: 0x58a6ff, fontWeight: '600',
    });
    flowLabel.anchor.set(0.5, 0);
    flowLabel.name = 'flowLabel';
    labelsContainer.addChild(flowLabel);

    // Delta-T label
    const deltaLabel = new PIXI.Text('', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 7, fill: 0x9ba4ae,
    });
    deltaLabel.anchor.set(0.5, 0);
    deltaLabel.name = 'deltaLabel';
    labelsContainer.addChild(deltaLabel);

    // Arrow legend labels
    const supplyArrow = new PIXI.Text('SUPPLY (Cold)', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 6, fill: 0x39d2c0,
    });
    supplyArrow.anchor.set(0, 0.5);
    supplyArrow.name = 'supplyArrow';
    labelsContainer.addChild(supplyArrow);

    const returnArrow = new PIXI.Text('RETURN (Hot)', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 6, fill: 0xf85149,
    });
    returnArrow.anchor.set(1, 0.5);
    returnArrow.name = 'returnArrow';
    labelsContainer.addChild(returnArrow);

    const draw = () => {
      frameRef.current++;
      const frame = frameRef.current;
      const w = app.screen.width;
      const h = app.screen.height;
      const { flowRate, inletTemp, outletTemp } = dataRef.current;

      gfx.clear();

      // Layout
      const margin = 20;
      const cduX = margin + 35;
      const cduY = h / 2;
      const hxX = w - margin - 35;
      const hxY = h / 2;
      const pipeTopY = h * 0.25;
      const pipeBotY = h * 0.75;
      const pipeLeft = cduX + 40;
      const pipeRight = hxX - 40;

      // -- CDU Box --
      gfx.lineStyle(2, 0x58a6ff, 0.7);
      gfx.beginFill(0x1c2430, 0.9);
      gfx.drawRoundedRect(cduX - 32, cduY - 35, 64, 70, 6);
      gfx.endFill();
      // CDU inner coils
      gfx.lineStyle(1, 0x58a6ff, 0.3);
      for (let i = 0; i < 4; i++) {
        const cy = cduY - 18 + i * 12;
        gfx.moveTo(cduX - 18, cy);
        gfx.bezierCurveTo(cduX - 5, cy - 5, cduX + 5, cy + 5, cduX + 18, cy);
      }

      // -- Server Heat Exchanger Box --
      const deltaT = outletTemp - inletTemp;
      const heatIntensity = Math.min(deltaT / 30, 1);
      const hxColor = heatIntensity > 0.6 ? 0xf85149 : heatIntensity > 0.3 ? 0xf0c040 : 0x76d276;
      gfx.lineStyle(2, hxColor, 0.7);
      gfx.beginFill(0x1c2430, 0.9);
      gfx.drawRoundedRect(hxX - 32, hxY - 35, 64, 70, 6);
      gfx.endFill();
      // Heat fins inside
      gfx.lineStyle(1, hxColor, 0.3);
      for (let i = 0; i < 5; i++) {
        const fx = hxX - 20 + i * 10;
        gfx.moveTo(fx, hxY - 20);
        gfx.lineTo(fx, hxY + 20);
      }

      // -- Supply pipe (top, cold, left to right) --
      const pipeW = 10;
      // Supply pipe background
      gfx.lineStyle(pipeW, 0x1a3a5a, 0.5);
      gfx.moveTo(cduX + 32, cduY - 18);
      gfx.lineTo(cduX + 32, pipeTopY);
      gfx.lineTo(pipeRight + 8, pipeTopY);
      gfx.lineTo(hxX - 32, hxY - 18);

      // Supply pipe border
      gfx.lineStyle(1, 0x39d2c0, 0.4);
      gfx.moveTo(cduX + 32, cduY - 18);
      gfx.lineTo(cduX + 32, pipeTopY);
      gfx.lineTo(pipeRight + 8, pipeTopY);
      gfx.lineTo(hxX - 32, hxY - 18);

      // -- Return pipe (bottom, hot, right to left) --
      gfx.lineStyle(pipeW, 0x3a2a1a, 0.5);
      gfx.moveTo(hxX - 32, hxY + 18);
      gfx.lineTo(hxX - 32 - 8, pipeBotY);
      gfx.lineTo(cduX + 32, pipeBotY);
      gfx.lineTo(cduX + 32, cduY + 18);

      // Return pipe border
      gfx.lineStyle(1, 0xf85149, 0.3);
      gfx.moveTo(hxX - 32, hxY + 18);
      gfx.lineTo(hxX - 32 - 8, pipeBotY);
      gfx.lineTo(cduX + 32, pipeBotY);
      gfx.lineTo(cduX + 32, cduY + 18);

      // -- Flow direction arrows on pipes --
      const drawArrow = (x: number, y: number, dir: number, color: number) => {
        gfx.lineStyle(0);
        gfx.beginFill(color, 0.8);
        gfx.moveTo(x + dir * 5, y);
        gfx.lineTo(x - dir * 3, y - 4);
        gfx.lineTo(x - dir * 3, y + 4);
        gfx.closePath();
        gfx.endFill();
      };

      // Supply arrows (moving right)
      for (let i = 0; i < 3; i++) {
        const ax = pipeLeft + (pipeRight - pipeLeft) * (i + 0.5) / 3;
        drawArrow(ax, pipeTopY, 1, 0x39d2c0);
      }
      // Return arrows (moving left)
      for (let i = 0; i < 3; i++) {
        const ax = pipeRight - (pipeRight - pipeLeft) * (i + 0.5) / 3;
        drawArrow(ax, pipeBotY, -1, 0xf85149);
      }

      // -- Flow particles --
      const speed = flowRate / 15;
      const numParticles = Math.round(10 + speed * 15);

      // Supply path segments
      const supplyPath = [
        { x1: cduX + 32, y1: cduY - 18, x2: cduX + 32, y2: pipeTopY },
        { x1: cduX + 32, y1: pipeTopY, x2: pipeRight + 8, y2: pipeTopY },
        { x1: pipeRight + 8, y1: pipeTopY, x2: hxX - 32, y2: hxY - 18 },
      ];
      const returnPath = [
        { x1: hxX - 32, y1: hxY + 18, x2: hxX - 40, y2: pipeBotY },
        { x1: hxX - 40, y1: pipeBotY, x2: cduX + 32, y2: pipeBotY },
        { x1: cduX + 32, y1: pipeBotY, x2: cduX + 32, y2: cduY + 18 },
      ];

      // Calculate total lengths
      const segLen = (s: typeof supplyPath[0]) => Math.sqrt((s.x2 - s.x1) ** 2 + (s.y2 - s.y1) ** 2);
      const supplyLens = supplyPath.map(segLen);
      const returnLens = returnPath.map(segLen);
      const totalSupply = supplyLens.reduce((a, b) => a + b, 0);
      const totalReturn = returnLens.reduce((a, b) => a + b, 0);

      const drawPathParticles = (path: typeof supplyPath, lens: number[], total: number, baseColor: number, warmColor: number) => {
        for (let p = 0; p < numParticles; p++) {
          const t = ((frame * speed * 0.012 + p / numParticles) % 1);
          const dist = t * total;
          let accum = 0;
          for (let si = 0; si < path.length; si++) {
            if (accum + lens[si] >= dist) {
              const lt = (dist - accum) / lens[si];
              const px = path[si].x1 + (path[si].x2 - path[si].x1) * lt;
              const py = path[si].y1 + (path[si].y2 - path[si].y1) * lt;
              const color = lerpColorNum(baseColor, warmColor, t);
              const size = 2 + speed * 1.2;
              gfx.beginFill(color, 0.75);
              gfx.drawCircle(px, py, size);
              gfx.endFill();
              break;
            }
            accum += lens[si];
          }
        }
      };

      drawPathParticles(supplyPath, supplyLens, totalSupply, 0x39d2c0, 0x58a6ff);
      drawPathParticles(returnPath, returnLens, totalReturn, 0xf85149, 0xf0c040);

      // -- Update text labels --
      const cduTitleEl = labelsContainer.getChildByName('cduTitle') as PIXI.Text;
      if (cduTitleEl) cduTitleEl.position.set(cduX, cduY - 8);

      const cduSubEl = labelsContainer.getChildByName('cduSub') as PIXI.Text;
      if (cduSubEl) cduSubEl.position.set(cduX, cduY + 4);

      const hxTitleEl = labelsContainer.getChildByName('hxTitle') as PIXI.Text;
      if (hxTitleEl) hxTitleEl.position.set(hxX, hxY - 8);

      const hxSubEl = labelsContainer.getChildByName('hxSub') as PIXI.Text;
      if (hxSubEl) hxSubEl.position.set(hxX, hxY + 4);

      const supplyLabelEl = labelsContainer.getChildByName('supplyLabel') as PIXI.Text;
      if (supplyLabelEl) {
        supplyLabelEl.text = `${inletTemp.toFixed(1)}°C`;
        supplyLabelEl.position.set((pipeLeft + pipeRight) / 2, pipeTopY - 12);
      }

      const returnLabelEl = labelsContainer.getChildByName('returnLabel') as PIXI.Text;
      if (returnLabelEl) {
        returnLabelEl.text = `${outletTemp.toFixed(1)}°C`;
        returnLabelEl.position.set((pipeLeft + pipeRight) / 2, pipeBotY + 12);
      }

      const flowLabelEl = labelsContainer.getChildByName('flowLabel') as PIXI.Text;
      if (flowLabelEl) {
        flowLabelEl.text = `Flow: ${flowRate.toFixed(1)} L/min`;
        flowLabelEl.position.set(w / 2, 6);
      }

      const deltaLabelEl = labelsContainer.getChildByName('deltaLabel') as PIXI.Text;
      if (deltaLabelEl) {
        deltaLabelEl.text = `ΔT: ${deltaT.toFixed(1)}°C  ·  Heat: ${(deltaT * flowRate * 0.07).toFixed(1)} kW`;
        deltaLabelEl.position.set(w / 2, 20);
      }

      const supplyArrowEl = labelsContainer.getChildByName('supplyArrow') as PIXI.Text;
      if (supplyArrowEl) supplyArrowEl.position.set(pipeLeft + 4, pipeTopY + 10);

      const returnArrowEl = labelsContainer.getChildByName('returnArrow') as PIXI.Text;
      if (returnArrowEl) returnArrowEl.position.set(pipeRight - 4, pipeBotY - 10);
    };

    app.ticker.add(draw);

    return () => {
      app.destroy(true, { children: true });
      appRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
