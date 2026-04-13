import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import type { ServerTelemetry } from '../types';

// Simplified 8-node NVLink topology for display
const NODES = 8;
const NODE_RADIUS = 18;

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

    const linkGfx = new PIXI.Graphics();
    app.stage.addChild(linkGfx);
    gfxRef.current = linkGfx;

    const particles = new PIXI.Graphics();
    app.stage.addChild(particles);
    particlesRef.current = particles;

    const nodes = new PIXI.Container();
    app.stage.addChild(nodes);
    nodesRef.current = nodes;

    // Create node circles with labels
    for (let i = 0; i < NODES; i++) {
      const nodeContainer = new PIXI.Container();

      const circle = new PIXI.Graphics();
      circle.name = 'circle';
      nodeContainer.addChild(circle);

      const label = new PIXI.Text(`G${i * 9}-${i * 9 + 8}`, {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 7,
        fill: 0xe6edf3,
      });
      label.anchor.set(0.5, 0.5);
      nodeContainer.addChild(label);

      const bwLabel = new PIXI.Text('', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 7,
        fill: 0x8b949e,
      });
      bwLabel.anchor.set(0.5, 0);
      bwLabel.name = 'bwLabel';
      nodeContainer.addChild(bwLabel);

      nodes.addChild(nodeContainer);
    }

    // Animation ticker for flowing particles
    app.ticker.add(() => {
      frameRef.current++;
      drawParticles();
    });

    return () => {
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
    const cy = h / 2;
    const rx = Math.min(w, h) * 0.35;
    const ry = rx * 0.85;

    return Array.from({ length: NODES }, (_, i) => {
      const angle = (i / NODES) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
    });
  };

  const bandwidthData = useRef<number[]>(new Array(NODES).fill(50));

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
      const speed = 0.5 + (avgBw / 100) * 2;
      const numParticles = Math.round(1 + (avgBw / 100) * 3);

      for (let p = 0; p < numParticles; p++) {
        const t = ((frame * speed * 0.02 + p / numParticles) % 1);
        const px = pa.x + (pb.x - pa.x) * t;
        const py = pa.y + (pb.y - pa.y) * t;
        const alpha = avgBw > 70 ? 0.9 : avgBw > 40 ? 0.5 : 0.2;
        const size = avgBw > 70 ? 2.5 : 1.5;

        particles.beginFill(avgBw > 80 ? 0x58a6ff : 0x39d2c0, alpha);
        particles.drawCircle(px, py, size);
        particles.endFill();
      }
    }
  };

  useEffect(() => {
    if (!appRef.current || !gfxRef.current || !nodesRef.current) return;

    const positions = getNodePositions();
    const gfx = gfxRef.current;
    const nodes = nodesRef.current;

    // Compute average bandwidth per node group
    const bwPerGroup = new Array(NODES).fill(0);
    if (server) {
      const bws = server.compute.nvlinkBandwidth;
      const gpusPerGroup = Math.ceil(bws.length / NODES);
      for (let g = 0; g < NODES; g++) {
        let sum = 0;
        let count = 0;
        for (let j = g * gpusPerGroup; j < Math.min((g + 1) * gpusPerGroup, bws.length); j++) {
          sum += bws[j];
          count++;
        }
        bwPerGroup[g] = count > 0 ? sum / count : 0;
      }
    }
    bandwidthData.current = bwPerGroup;

    // Draw links
    gfx.clear();
    for (const [a, b] of LINKS) {
      const pa = positions[a];
      const pb = positions[b];
      if (!pa || !pb) continue;

      const avgBw = (bwPerGroup[a] + bwPerGroup[b]) / 2;
      const thickness = 0.5 + (avgBw / 100) * 3;
      const color = avgBw > 80 ? 0x58a6ff : avgBw > 50 ? 0x39d2c0 : 0x1e2a3a;
      const alpha = 0.2 + (avgBw / 100) * 0.6;

      gfx.lineStyle(thickness, color, alpha);
      gfx.moveTo(pa.x, pa.y);
      gfx.lineTo(pb.x, pb.y);
    }

    // Update node positions and appearance
    for (let i = 0; i < NODES; i++) {
      const pos = positions[i];
      const nodeContainer = nodes.children[i] as PIXI.Container;
      if (!nodeContainer || !pos) continue;

      nodeContainer.position.set(pos.x, pos.y);

      const circle = nodeContainer.getChildByName('circle') as PIXI.Graphics;
      if (circle) {
        circle.clear();
        const bw = bwPerGroup[i];
        const color = bw > 80 ? 0x58a6ff : bw > 50 ? 0x39d2c0 : 0x1e2a3a;
        
        // Glow
        if (bw > 70) {
          circle.beginFill(color, 0.15);
          circle.drawCircle(0, 0, NODE_RADIUS + 4);
          circle.endFill();
        }

        circle.beginFill(0x111820, 0.9);
        circle.drawCircle(0, 0, NODE_RADIUS);
        circle.endFill();
        circle.lineStyle(1.5, color, 0.8);
        circle.drawCircle(0, 0, NODE_RADIUS);
      }

      const bwLabel = nodeContainer.getChildByName('bwLabel') as PIXI.Text;
      if (bwLabel) {
        bwLabel.text = `${Math.round(bwPerGroup[i])}%`;
        bwLabel.position.set(0, NODE_RADIUS + 6);
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
