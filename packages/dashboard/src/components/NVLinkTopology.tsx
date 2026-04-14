import { useEffect, useRef, useMemo } from 'react';
import * as PIXI from 'pixi.js';
import type { ServerTelemetry } from '../types';

// GB200 NVL72: 72 GPUs grouped into 8 GPU groups (9 GPUs each)
const NODES = 8;
const NODE_RADIUS = 22;

// Define connections between GPU groups (simplified representation of NVLink mesh)
const LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7],
  [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7],
  [0, 3], [1, 4], [2, 5], [3, 6], [4, 7],
  [0, 7], [1, 6], [2, 7],
];

interface TopologyViewProps {
  server: ServerTelemetry | null;
}

export default function NVLinkTopology({ server }: TopologyViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const gfxRef = useRef<PIXI.Graphics | null>(null);
  const nodesRef = useRef<PIXI.Container | null>(null);
  const particlesRef = useRef<PIXI.Graphics | null>(null);
  const linkLabelsRef = useRef<PIXI.Text[]>([]);
  const statsRef = useRef<PIXI.Container | null>(null);
  const frameRef = useRef(0);
  const bandwidthData = useRef<number[]>(new Array(NODES).fill(50));

  // Compute per-group stats
  const groupStats = useMemo(() => {
    if (!server) return null;
    const bws = server.compute.nvlinkBandwidth;
    const utils = server.compute.gpuUtilization;
    const temps = server.thermal.gpuCoreTemps;
    const gpusPerGroup = Math.ceil(bws.length / NODES);
    const groups = [];
    for (let g = 0; g < NODES; g++) {
      let bwSum = 0, utilSum = 0, tempMax = 0, count = 0;
      for (let j = g * gpusPerGroup; j < Math.min((g + 1) * gpusPerGroup, bws.length); j++) {
        bwSum += bws[j]; utilSum += utils[j]; tempMax = Math.max(tempMax, temps[j]); count++;
      }
      groups.push({
        avgBw: count > 0 ? bwSum / count : 0,
        avgUtil: count > 0 ? utilSum / count : 0,
        maxTemp: tempMax,
      });
    }
    return groups;
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

    const linkGfx = new PIXI.Graphics();
    app.stage.addChild(linkGfx);
    gfxRef.current = linkGfx;

    const particles = new PIXI.Graphics();
    app.stage.addChild(particles);
    particlesRef.current = particles;

    // Link bandwidth labels
    for (let i = 0; i < LINKS.length; i++) {
      const lt = new PIXI.Text('', {
        fontFamily: 'JetBrains Mono, monospace', fontSize: 7, fill: 0x8b949e,
      });
      lt.anchor.set(0.5, 0.5);
      lt.alpha = 0;
      app.stage.addChild(lt);
      linkLabelsRef.current.push(lt);
    }

    const nodes = new PIXI.Container();
    app.stage.addChild(nodes);
    nodesRef.current = nodes;

    // Create nodes with richer info
    for (let i = 0; i < NODES; i++) {
      const nc = new PIXI.Container();

      const outerGlow = new PIXI.Graphics();
      outerGlow.name = 'outerGlow';
      nc.addChild(outerGlow);

      const circle = new PIXI.Graphics();
      circle.name = 'circle';
      nc.addChild(circle);

      const rangeLabel = new PIXI.Text(`G${i * 9}-${i * 9 + 8}`, {
        fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fill: 0xe6edf3, fontWeight: '600',
      });
      rangeLabel.anchor.set(0.5, 0.5);
      nc.addChild(rangeLabel);

      const bwLabel = new PIXI.Text('', {
        fontFamily: 'JetBrains Mono, monospace', fontSize: 7, fill: 0x58a6ff,
      });
      bwLabel.anchor.set(0.5, 0);
      bwLabel.name = 'bwLabel';
      nc.addChild(bwLabel);

      const utilBar = new PIXI.Graphics();
      utilBar.name = 'utilBar';
      nc.addChild(utilBar);

      const tempLabel = new PIXI.Text('', {
        fontFamily: 'JetBrains Mono, monospace', fontSize: 6, fill: 0x76d276,
      });
      tempLabel.anchor.set(0.5, 0);
      tempLabel.name = 'tempLabel';
      nc.addChild(tempLabel);

      nodes.addChild(nc);
    }

    // Stats overlay (top-left)
    const stats = new PIXI.Container();
    app.stage.addChild(stats);
    statsRef.current = stats;

    const title = new PIXI.Text('NVLink 5.0 Mesh', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: 0x58a6ff, fontWeight: '600',
    });
    title.position.set(8, 6);
    stats.addChild(title);

    const subtitle = new PIXI.Text('100 GB/s per link · 72 GPUs', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 7, fill: 0x5c6370,
    });
    subtitle.position.set(8, 18);
    stats.addChild(subtitle);

    const aggText = new PIXI.Text('', {
      fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fill: 0x39d2c0,
    });
    aggText.name = 'aggBw';
    aggText.position.set(8, 32);
    stats.addChild(aggText);

    // Legend dots
    const legend = new PIXI.Graphics();
    legend.name = 'legend';
    stats.addChild(legend);

    app.ticker.add(() => {
      frameRef.current++;
      drawParticles();
    });

    return () => {
      linkLabelsRef.current = [];
      app.destroy(true, { children: true });
      appRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getNodePositions = () => {
    if (!appRef.current) return [];
    const w = appRef.current.screen.width;
    const h = appRef.current.screen.height;
    const cx = w / 2;
    const cy = h / 2 + 10;
    const rx = Math.min(w, h) * 0.32;
    const ry = rx * 0.85;

    return Array.from({ length: NODES }, (_, i) => {
      const angle = (i / NODES) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
    });
  };

  const drawParticles = () => {
    const particles = particlesRef.current;
    if (!particles || !appRef.current) return;
    const positions = getNodePositions();
    if (positions.length === 0) return;

    particles.clear();
    const frame = frameRef.current;
    const bw = bandwidthData.current;

    for (const [a, b] of LINKS) {
      const pa = positions[a];
      const pb = positions[b];
      if (!pa || !pb) continue;

      const avgBw = (bw[a] + bw[b]) / 2;
      const speed = 0.3 + (avgBw / 100) * 2.5;
      const numP = Math.round(2 + (avgBw / 100) * 4);

      for (let p = 0; p < numP; p++) {
        const t = ((frame * speed * 0.015 + p / numP) % 1);
        const px = pa.x + (pb.x - pa.x) * t;
        const py = pa.y + (pb.y - pa.y) * t;
        const alpha = avgBw > 70 ? 0.85 : avgBw > 40 ? 0.45 : 0.15;
        const size = avgBw > 70 ? 2.5 : avgBw > 40 ? 1.8 : 1;
        const color = avgBw > 80 ? 0x58a6ff : avgBw > 50 ? 0x39d2c0 : 0x2a3848;

        particles.beginFill(color, alpha);
        particles.drawCircle(px, py, size);
        particles.endFill();
      }
    }
  };

  useEffect(() => {
    if (!appRef.current || !gfxRef.current || !nodesRef.current || !groupStats) return;

    const positions = getNodePositions();
    const gfx = gfxRef.current;
    const nodes = nodesRef.current;

    const bwPerGroup = groupStats.map(g => g.avgBw);
    bandwidthData.current = bwPerGroup;
    const avgBw = bwPerGroup.reduce((s, v) => s + v, 0) / NODES;

    // Draw links
    gfx.clear();
    for (let li = 0; li < LINKS.length; li++) {
      const [a, b] = LINKS[li];
      const pa = positions[a]; const pb = positions[b];
      if (!pa || !pb) continue;

      const linkBw = (bwPerGroup[a] + bwPerGroup[b]) / 2;
      const thickness = 0.5 + (linkBw / 100) * 3;
      const color = linkBw > 80 ? 0x58a6ff : linkBw > 50 ? 0x39d2c0 : 0x2a3848;
      const alpha = 0.15 + (linkBw / 100) * 0.7;

      gfx.lineStyle(thickness, color, alpha);
      gfx.moveTo(pa.x, pa.y);
      gfx.lineTo(pb.x, pb.y);

      // Show % on high-bandwidth links
      const lt = linkLabelsRef.current[li];
      if (lt) {
        lt.position.set((pa.x + pb.x) / 2, (pa.y + pb.y) / 2);
        if (linkBw > 60) {
          lt.text = `${Math.round(linkBw)}%`;
          lt.alpha = 0.6;
          lt.style.fill = color;
        } else {
          lt.alpha = 0;
        }
      }
    }

    // Update nodes
    for (let i = 0; i < NODES; i++) {
      const pos = positions[i];
      const nc = nodes.children[i] as PIXI.Container;
      if (!nc || !pos) continue;
      nc.position.set(pos.x, pos.y);

      const gs = groupStats[i];
      const bw = gs.avgBw;
      const nodeColor = bw > 80 ? 0x58a6ff : bw > 50 ? 0x39d2c0 : 0x2a3848;
      const tempColor = gs.maxTemp >= 85 ? 0xf85149 : gs.maxTemp >= 75 ? 0xf0c040 : 0x76d276;

      const outerGlow = nc.getChildByName('outerGlow') as PIXI.Graphics;
      if (outerGlow) {
        outerGlow.clear();
        if (bw > 60) {
          outerGlow.beginFill(nodeColor, 0.12);
          outerGlow.drawCircle(0, 0, NODE_RADIUS + 6);
          outerGlow.endFill();
        }
      }

      const circle = nc.getChildByName('circle') as PIXI.Graphics;
      if (circle) {
        circle.clear();
        circle.beginFill(0x1c2430, 0.95);
        circle.drawCircle(0, 0, NODE_RADIUS);
        circle.endFill();
        circle.lineStyle(2, nodeColor, 0.9);
        circle.drawCircle(0, 0, NODE_RADIUS);
        // Inner temperature arc indicator
        const tempFrac = Math.min(gs.maxTemp / 100, 1);
        circle.lineStyle(2, tempColor, 0.7);
        circle.arc(0, 0, NODE_RADIUS - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * tempFrac);
      }

      const bwLabel = nc.getChildByName('bwLabel') as PIXI.Text;
      if (bwLabel) {
        bwLabel.text = `${Math.round(bw)}% BW`;
        bwLabel.style.fill = nodeColor;
        bwLabel.position.set(0, NODE_RADIUS + 4);
      }

      const utilBar = nc.getChildByName('utilBar') as PIXI.Graphics;
      if (utilBar) {
        utilBar.clear();
        const barW = NODE_RADIUS * 2 - 6;
        const barH = 3;
        const barX = -barW / 2;
        const barY = NODE_RADIUS + 16;
        utilBar.beginFill(0x1e2a3a, 0.5);
        utilBar.drawRoundedRect(barX, barY, barW, barH, 1.5);
        utilBar.endFill();
        const utilFrac = gs.avgUtil / 100;
        const utilColor = gs.avgUtil > 80 ? 0x76d276 : gs.avgUtil > 50 ? 0xf0c040 : 0x5c6370;
        utilBar.beginFill(utilColor, 0.8);
        utilBar.drawRoundedRect(barX, barY, barW * utilFrac, barH, 1.5);
        utilBar.endFill();
      }

      const tempLabel = nc.getChildByName('tempLabel') as PIXI.Text;
      if (tempLabel) {
        tempLabel.text = `${Math.round(gs.maxTemp)}°C`;
        tempLabel.style.fill = tempColor;
        tempLabel.position.set(0, NODE_RADIUS + 22);
      }
    }

    // Aggregate stats
    if (statsRef.current) {
      const aggText = statsRef.current.getChildByName('aggBw') as PIXI.Text;
      if (aggText) {
        const color = avgBw > 70 ? '#39d2c0' : avgBw > 40 ? '#f0c040' : '#f85149';
        aggText.text = `Avg BW: ${Math.round(avgBw)}%  ·  Links: ${LINKS.length} active`;
        aggText.style.fill = color;
      }

      const legend = statsRef.current.getChildByName('legend') as PIXI.Graphics;
      if (legend) {
        legend.clear();
        const ly = 46;
        legend.beginFill(0x58a6ff, 1); legend.drawCircle(14, ly, 3); legend.endFill();
        legend.beginFill(0x39d2c0, 1); legend.drawCircle(60, ly, 3); legend.endFill();
        legend.beginFill(0x2a3848, 1); legend.drawCircle(106, ly, 3); legend.endFill();
      }

      if (statsRef.current.children.length <= 5) {
        const lTexts = [
          { x: 20, label: '>80%', color: 0x58a6ff },
          { x: 66, label: '50-80%', color: 0x39d2c0 },
          { x: 112, label: '<50%', color: 0x5c6370 },
        ];
        for (const lt of lTexts) {
          const t = new PIXI.Text(lt.label, {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 6, fill: lt.color,
          });
          t.position.set(lt.x, 40);
          statsRef.current.addChild(t);
        }
      }
    }
  }, [groupStats]);

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
