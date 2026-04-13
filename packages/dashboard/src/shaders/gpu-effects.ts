// Custom GLSL Shader fragments for Pixi.js v7
// Glow effect for high-temperature cells and data flow stripe effect

import * as PIXI from 'pixi.js';

// ─── High Temperature Glow Shader ─────────────────────────────────────
const glowVertexSrc = `
  attribute vec2 aVertexPosition;
  attribute vec2 aTextureCoord;
  uniform mat3 projectionMatrix;
  varying vec2 vTextureCoord;
  void main(void) {
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
  }
`;

const glowFragmentSrc = `
  precision mediump float;
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler;
  uniform float uTime;
  uniform float uIntensity;   // 0..1 anomaly score
  uniform vec3 uGlowColor;    // RGB glow color

  void main(void) {
    vec4 color = texture2D(uSampler, vTextureCoord);

    // Radial distance from center
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vTextureCoord, center);

    // Pulsing glow based on anomaly intensity
    float pulse = sin(uTime * 3.0) * 0.15 + 0.85;
    float glowStrength = uIntensity * pulse * smoothstep(0.6, 0.0, dist);

    // Edge glow (stronger at edges)
    float edge = smoothstep(0.3, 0.5, dist) * uIntensity * pulse * 0.8;

    // Combine
    vec3 glow = uGlowColor * (glowStrength + edge);
    color.rgb += glow;

    // Add subtle color shift for critical servers
    if (uIntensity > 0.7) {
      float flicker = sin(uTime * 8.0 + dist * 12.0) * 0.03;
      color.rgb += vec3(flicker, -flicker * 0.5, -flicker);
    }

    gl_FragColor = color;
  }
`;

// ─── Data Flow Stripe Shader ──────────────────────────────────────────
const stripeFragmentSrc = `
  precision mediump float;
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler;
  uniform float uTime;
  uniform float uSpeed;        // Flow speed multiplier
  uniform float uBandwidth;    // 0..1 bandwidth utilization
  uniform vec3 uFlowColor;     // RGB flow color

  void main(void) {
    vec4 color = texture2D(uSampler, vTextureCoord);

    // Diagonal flow stripes
    float stripe = sin((vTextureCoord.x + vTextureCoord.y) * 20.0 - uTime * uSpeed * 5.0);
    stripe = smoothstep(0.3, 0.7, stripe);

    // Secondary stripe layer for depth
    float stripe2 = sin((vTextureCoord.x - vTextureCoord.y * 0.5) * 30.0 - uTime * uSpeed * 3.0);
    stripe2 = smoothstep(0.4, 0.6, stripe2) * 0.5;

    // Combine stripes with bandwidth intensity
    float intensity = (stripe + stripe2) * uBandwidth * 0.25;
    color.rgb += uFlowColor * intensity;

    // Scanning line effect
    float scan = sin(vTextureCoord.y * 50.0 - uTime * 2.0) * 0.02 * uBandwidth;
    color.rgb += vec3(scan);

    gl_FragColor = color;
  }
`;

// ─── Heatmap Cell Shader (combined glow + data flow) ─────────────────
const heatCellFragmentSrc = `
  precision mediump float;
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler;
  uniform float uTime;
  uniform float uAnomaly;      // 0..1
  uniform float uBandwidth;    // 0..1
  uniform vec3 uCellColor;     // Base cell color

  void main(void) {
    vec4 base = texture2D(uSampler, vTextureCoord);
    vec2 uv = vTextureCoord;

    // Soft inner glow
    vec2 center = vec2(0.5);
    float dist = distance(uv, center);
    float glow = smoothstep(0.55, 0.0, dist) * uAnomaly;
    float pulse = sin(uTime * 2.5) * 0.1 + 0.9;

    // Data flow lines (horizontal streaming)
    float flow = sin(uv.x * 25.0 - uTime * 4.0 * (0.5 + uBandwidth)) * 0.5 + 0.5;
    flow = smoothstep(0.6, 0.8, flow) * uBandwidth * 0.15;

    // Edge highlight
    float edgeX = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x);
    float edgeY = smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.92, uv.y);
    float edgeMask = 1.0 - edgeX * edgeY;
    float edgeGlow = edgeMask * uAnomaly * pulse * 0.6;

    // Combine
    vec3 finalColor = base.rgb;
    finalColor += uCellColor * glow * pulse * 0.3;
    finalColor += vec3(0.3, 0.6, 1.0) * flow;
    finalColor += uCellColor * edgeGlow;

    // Critical flash
    if (uAnomaly > 0.8) {
      float flash = pow(sin(uTime * 6.0) * 0.5 + 0.5, 4.0) * 0.15;
      finalColor += vec3(1.0, 0.3, 0.2) * flash;
    }

    gl_FragColor = vec4(finalColor, base.a);
  }
`;

export interface GlowFilterUniforms {
  uTime: number;
  uIntensity: number;
  uGlowColor: [number, number, number];
}

export interface StripeFilterUniforms {
  uTime: number;
  uSpeed: number;
  uBandwidth: number;
  uFlowColor: [number, number, number];
}

export interface HeatCellUniforms {
  uTime: number;
  uAnomaly: number;
  uBandwidth: number;
  uCellColor: [number, number, number];
}

export function createGlowFilter(): PIXI.Filter {
  return new PIXI.Filter(glowVertexSrc, glowFragmentSrc, {
    uTime: 0,
    uIntensity: 0,
    uGlowColor: [1.0, 0.32, 0.29], // red glow
  });
}

export function createStripeFilter(): PIXI.Filter {
  return new PIXI.Filter(undefined, stripeFragmentSrc, {
    uTime: 0,
    uSpeed: 1.0,
    uBandwidth: 0.5,
    uFlowColor: [0.35, 0.65, 1.0], // blue flow
  });
}

export function createHeatCellFilter(): PIXI.Filter {
  return new PIXI.Filter(undefined, heatCellFragmentSrc, {
    uTime: 0,
    uAnomaly: 0,
    uBandwidth: 0,
    uCellColor: [0.46, 0.82, 0.46], // green default
  });
}

// Helper to convert hex color to [r, g, b] float array
export function hexToRgb(hex: number): [number, number, number] {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  ];
}

// Helper to update all glow filter uniforms
export function updateShaderTime(filter: PIXI.Filter, time: number) {
  if (filter.uniforms.uTime !== undefined) {
    filter.uniforms.uTime = time;
  }
}
