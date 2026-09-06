/**
 * GLSL chunk library (TECHNICAL_PLAN §5.1). Raw strings concatenated into
 * ShaderMaterials. Written in three.js-compatible GLSL1 style (three rewrites
 * it for WebGL2 automatically).
 */

export const GLSL_COMMON = /* glsl */ `
uniform float uTime;
uniform float uExposure;
uniform float uDrift;
uniform float uDissolve;
uniform float uRise;
uniform float uFade;
uniform float uReduced;
uniform vec2  uCursorUV;      // cursor in picture uv (0..1, y down)
uniform float uCursorGain;    // 0 → 1 cursor presence
uniform float uPxPerRpx;      // device px per reference px (for stroke widths)
uniform float uTier;
uniform float uGrainSeed;

const float PI = 3.141592653589793;

vec2 hash21(float px, float py) {
  vec2 p = vec2(px, py);
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract((p.xx + p.yx) * p.xy);
}
float hash11(float n) {
  return fract(sin(n) * 43758.5453123);
}
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash11(i.x + i.y * 57.0);
  float b = hash11(i.x + 1.0 + i.y * 57.0);
  float c = hash11(i.x + (i.y + 1.0) * 57.0);
  float d = hash11(i.x + 1.0 + (i.y + 1.0) * 57.0);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float noise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float a = hash11(i.x + i.y * 57.0 + i.z * 113.0);
  float b = hash11(i.x + 1.0 + i.y * 57.0 + i.z * 113.0);
  float c = hash11(i.x + (i.y + 1.0) * 57.0 + i.z * 113.0);
  float d = hash11(i.x + 1.0 + (i.y + 1.0) * 57.0 + i.z * 113.0);
  float e = hash11(i.x + i.y * 57.0 + (i.z + 1.0) * 113.0);
  float f2 = hash11(i.x + 1.0 + i.y * 57.0 + (i.z + 1.0) * 113.0);
  float g = hash11(i.x + (i.y + 1.0) * 57.0 + (i.z + 1.0) * 113.0);
  float h = hash11(i.x + 1.0 + (i.y + 1.0) * 57.0 + (i.z + 1.0) * 113.0);
  float ab = mix(a, b, u.x), cd = mix(c, d, u.x), ef = mix(e, f2, u.x), gh = mix(g, h, u.x);
  return mix(mix(ab, cd, u.y), mix(ef, gh, u.y), u.z);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise2(p);
    p = m * p * 2.02;
    a *= 0.5;
  }
  return v;
}
float fbm5(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise2(p);
    p = m * p * 2.02;
    a *= 0.5;
  }
  return v;
}
float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 3; i++) {
    v += a * noise2(p);
    p = m * p * 2.02;
    a *= 0.5;
  }
  return v;
}
vec2 warp(vec2 p) {
  float w = 4.2;
  vec2 q = vec2(fbm(p + vec2(0.0, 0.0)), fbm(p + vec2(5.2, 1.3)));
  return p + (q - 0.5) * w;
}
float softEdge(float d, float w) {
  return smoothstep(w, -w, d);
}
`;

/** Basic fullscreen / quad vertex that passes uv (0..1, y down) and world xy. */
export const VERT_UV_WORLD = /* glsl */ `
varying vec2 vUv;
varying vec2 vW;
void main() {
  vUv = uv;
  vW = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Quad vertex for *unlit sRGB* materials whose fragment outputs color directly. */
export const VERT_PLAIN = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
