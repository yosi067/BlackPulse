import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ProcessedData } from '../hooks/useTelemetry';
import styles from './DataCenter3D.module.css';

const RACK_ROWS = 2;
const RACK_COLS = 5;
const SERVERS_PER_RACK = 10;
const RACK_W = 2.4;
const RACK_D = 1.2;
const RACK_H = 4.2;    // 42U standard rack height
const SERVER_H = 0.35;  // ~2U
const RACK_GAP_X = 1.8;
const RACK_GAP_Z = 4.0;
const AISLE_Z = 2.0;

function tempToColor(anomaly: number): THREE.Color {
  if (anomaly <= 0) return new THREE.Color(0x1a3a2a);
  if (anomaly < 0.3) return new THREE.Color(0x76d276).lerp(new THREE.Color(0xf0c040), anomaly / 0.3);
  if (anomaly < 0.7) return new THREE.Color(0xf0c040).lerp(new THREE.Color(0xf85149), (anomaly - 0.3) / 0.4);
  return new THREE.Color(0xf85149);
}

interface DataCenter3DProps {
  data: ProcessedData | null;
  onSelectServer?: (id: number) => void;
  selectedServer?: number | null;
}

export default function DataCenter3D({ data, onSelectServer, selectedServer }: DataCenter3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const serverMeshesRef = useRef<THREE.Mesh[]>([]);
  const ledMeshesRef = useRef<THREE.Mesh[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const frameRef = useRef(0);
  const [hoveredServer, setHoveredServer] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; id: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080b10);
    scene.fog = new THREE.FogExp2(0x080b10, 0.015);
    sceneRef.current = scene;

    // Camera — isometric-like perspective
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 200);
    camera.position.set(18, 14, 18);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 1.5, 0);
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x1a1f2e, 1.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x4488cc, 0.8);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.far = 60;
    mainLight.shadow.camera.left = -20;
    mainLight.shadow.camera.right = 20;
    mainLight.shadow.camera.top = 20;
    mainLight.shadow.camera.bottom = -20;
    scene.add(mainLight);

    // Green uplight for NVIDIA feel
    const upLight = new THREE.PointLight(0x76b900, 0.4, 30);
    upLight.position.set(0, 0.1, 0);
    scene.add(upLight);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(40, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0e14,
      roughness: 0.85,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid helper
    const grid = new THREE.GridHelper(40, 40, 0x152030, 0x0f1820);
    grid.position.y = 0.01;
    scene.add(grid);

    // Build racks and servers
    const rackFrameMat = new THREE.MeshStandardMaterial({
      color: 0x1a1f2e, roughness: 0.6, metalness: 0.8,
    });
    const serverMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a1a, roughness: 0.4, metalness: 0.6,
    });
    const ledGeo = new THREE.BoxGeometry(0.06, 0.06, 0.02);

    for (let rr = 0; rr < RACK_ROWS; rr++) {
      for (let rc = 0; rc < RACK_COLS; rc++) {
        const rackIdx = rr * RACK_COLS + rc;
        const rx = (rc - (RACK_COLS - 1) / 2) * (RACK_W + RACK_GAP_X);
        const rz = rr * (RACK_D + RACK_GAP_Z + AISLE_Z) - RACK_GAP_Z / 2;

        // Rack frame (wireframe)
        const frameGeo = new THREE.BoxGeometry(RACK_W, RACK_H, RACK_D);
        const frameEdges = new THREE.EdgesGeometry(frameGeo);
        const frameLine = new THREE.LineSegments(frameEdges, new THREE.LineBasicMaterial({ color: 0x2a3a4f, opacity: 0.6, transparent: true }));
        frameLine.position.set(rx, RACK_H / 2, rz);
        scene.add(frameLine);

        // Rack label
        // (skip text for performance — use CSS tooltip instead)

        // Rack base
        const baseGeo = new THREE.BoxGeometry(RACK_W + 0.1, 0.05, RACK_D + 0.1);
        const base = new THREE.Mesh(baseGeo, rackFrameMat);
        base.position.set(rx, 0.025, rz);
        base.receiveShadow = true;
        scene.add(base);

        // Servers inside rack
        for (let s = 0; s < SERVERS_PER_RACK; s++) {
          const serverId = rackIdx * SERVERS_PER_RACK + s;
          const sy = 0.2 + s * (SERVER_H + 0.04);

          const sGeo = new THREE.BoxGeometry(RACK_W - 0.2, SERVER_H, RACK_D - 0.15);
          const sMat = serverMat.clone();
          const mesh = new THREE.Mesh(sGeo, sMat);
          mesh.position.set(rx, sy + SERVER_H / 2, rz);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          (mesh as any)._serverId = serverId;
          scene.add(mesh);
          serverMeshesRef.current[serverId] = mesh;

          // Status LED
          const ledMat = new THREE.MeshBasicMaterial({ color: 0x76d276 });
          const led = new THREE.Mesh(ledGeo, ledMat);
          led.position.set(rx - RACK_W / 2 + 0.2, sy + SERVER_H / 2, rz + RACK_D / 2 - 0.02);
          scene.add(led);
          ledMeshesRef.current[serverId] = led;
        }

        // CDU (Coolant Distribution Unit) next to rack
        if (rc === 0 && rr === 0) {
          const cduGeo = new THREE.CylinderGeometry(0.3, 0.3, 3, 12);
          const cduMat = new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.5, metalness: 0.7 });
          const cdu = new THREE.Mesh(cduGeo, cduMat);
          cdu.position.set(rx - RACK_W - 1.5, 1.5, rz);
          cdu.castShadow = true;
          scene.add(cdu);

          // CDU label pipe
          const pipeGeo = new THREE.CylinderGeometry(0.05, 0.05, RACK_COLS * (RACK_W + RACK_GAP_X), 8);
          const pipeMat = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.3, metalness: 0.8 });
          const pipe = new THREE.Mesh(pipeGeo, pipeMat);
          pipe.rotation.z = Math.PI / 2;
          pipe.position.set(0, 0.15, rz + RACK_D / 2 + 0.3);
          scene.add(pipe);
        }
      }
    }

    // Mouse interaction
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(serverMeshesRef.current.filter(Boolean));
      if (intersects.length > 0) {
        const sid = (intersects[0].object as any)._serverId;
        if (sid !== undefined) {
          setHoveredServer(sid);
          setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, id: sid });
          container.style.cursor = 'pointer';
        }
      } else {
        setHoveredServer(null);
        setTooltip(null);
        container.style.cursor = 'grab';
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(new THREE.Vector2(mx, my), camera);
      const intersects = raycasterRef.current.intersectObjects(serverMeshesRef.current.filter(Boolean));
      if (intersects.length > 0) {
        const sid = (intersects[0].object as any)._serverId;
        if (sid !== undefined) onSelectServer?.(sid);
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
      cancelAnimationFrame(frameRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      serverMeshesRef.current = [];
      ledMeshesRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update server colors based on telemetry
  useEffect(() => {
    if (!data) return;
    const numServers = Math.min(Math.floor(data.summaries.length / 3), serverMeshesRef.current.length);

    for (let i = 0; i < numServers; i++) {
      const anomaly = data.summaries[i * 3 + 2];
      const maxTemp = data.summaries[i * 3 + 1];
      const mesh = serverMeshesRef.current[i];
      const led = ledMeshesRef.current[i];
      if (!mesh || !led) continue;

      const color = tempToColor(anomaly);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(color);
      mat.emissive.copy(color).multiplyScalar(anomaly > 0.5 ? 0.3 : 0.05);

      // LED color
      const ledMat = led.material as THREE.MeshBasicMaterial;
      if (maxTemp >= 85) {
        ledMat.color.set(0xf85149);
      } else if (maxTemp >= 75) {
        ledMat.color.set(0xf0c040);
      } else {
        ledMat.color.set(0x76d276);
      }

      // Highlight selected
      if (selectedServer === i) {
        mat.emissive.set(0x58a6ff);
        mat.emissiveIntensity = 0.5;
      } else {
        mat.emissiveIntensity = anomaly > 0.5 ? 0.3 : 0.05;
      }
    }
  }, [data, selectedServer]);

  return (
    <div className={styles.container}>
      <div className={styles.label}>
        <span className={styles.icon3d}>🏗️</span> 3D Datacenter View
        <span className={styles.hint}>Drag to rotate · Scroll to zoom · Click to select</span>
      </div>
      <div ref={containerRef} className={styles.canvas}>
        {tooltip && data && (
          <div
            className={styles.tooltip}
            style={{ left: tooltip.x + 12, top: tooltip.y - 30 }}
          >
            <div className={styles.tooltipTitle}>
              S{String(tooltip.id).padStart(3, '0')}
            </div>
            <div className={styles.tooltipInfo}>
              {data.summaries[tooltip.id * 3 + 1]?.toFixed(1)}°C ·
              Rack {Math.floor(tooltip.id / 10)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
