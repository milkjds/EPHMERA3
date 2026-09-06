/**
 * Shared small utilities: unit conversions, deterministic RNG, canvas helpers,
 * geometry factories. No runtime Math.random() is used for layout anywhere
 * (TECHNICAL_PLAN §12): all randomness flows through seeded generators.
 */

export const PW = 1920; // reference picture width  (rpx)
export const PH = 810; // reference picture height (rpx)
export const HALF_W = PW / 2;
export const HALF_H = PH / 2;
export const ASPECT = PW / PH; // 2.35:1

/** Reference-pixel (rpx) → world units. World origin is the picture centre. */
export const toWorldX = (xRpx: number) => xRpx - HALF_W;
export const toWorldY = (yRpx: number) => HALF_H - yRpx;

/** rgb hex → [r,g,b] 0..255 */
export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
/** hex → GLSL vec3 literal in sRGB 0..1 */
export function hexV3(hex: string): string {
  const [r, g, b] = hexRgb(hex);
  return `vec3(${(r / 255).toFixed(4)}, ${(g / 255).toFixed(4)}, ${(b / 255).toFixed(4)})`;
}
/** hex → plain [r,g,b] 0..1 (TS side) */
export function hex01(hex: string): [number, number, number] {
  const [r, g, b] = hexRgb(hex);
  return [r / 255, g / 255, b / 255];
}
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const smooth = (a: number, b: number, t: number) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lightweight hash for turning small ints into [0,1) — deterministic. */
export function hash1(i: number, seed: number): number {
  let x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
export function hash2(i: number, j: number, seed: number): number {
  let x = Math.sin(i * 12.9898 + j * 78.233 + seed * 3.17) * 43758.5453;
  return x - Math.floor(x);
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return [c, ctx];
}

/**
 * Measure a text's ink metrics (baseline relative) with a given font string.
 * Returns px at that font size: ascent (from baseline up to top of "E" caps),
 * descent, cap (ascent of the cap glyph "E"), width of the string.
 */
export function measureFont(
  ctx: CanvasRenderingContext2D,
  font: string,
  text: string
): { ascent: number; descent: number; width: number } {
  ctx.font = font;
  const m = ctx.measureText(text);
  const mE = ctx.measureText("E");
  return {
    ascent: Math.abs(m.actualBoundingBoxAscent || 0),
    descent: Math.abs(m.actualBoundingBoxDescent || 0),
    width: m.width,
    capE: Math.abs(mE.actualBoundingBoxAscent || 0),
  } as { ascent: number; descent: number; width: number; capE: number };
}

/** Quad geometry with positions already in world units; uv in [0,1]. */
export function quadGeometry(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): { positions: number[]; uvs: number[]; indices: number[] } {
  return {
    positions: [x0, y0, 0, x1, y0, 0, x0, y1, 0, x1, y1, 0],
    uvs: [0, 0, 1, 0, 0, 1, 1, 1],
    indices: [0, 1, 2, 2, 1, 3],
  };
}

/** Full picture quad in world units (the datum plane). */
export const fullPictureQuad = () => quadGeometry(-HALF_W, HALF_H, HALF_W, -HALF_H);

export function fracRgb(hex: string, f: number): string {
  const [r, g, b] = hexRgb(hex);
  return `vec3(${((r / 255) * f).toFixed(4)}, ${((g / 255) * f).toFixed(4)}, ${((b / 255) * f).toFixed(4)})`;
}
