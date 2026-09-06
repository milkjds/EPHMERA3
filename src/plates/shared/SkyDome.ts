import * as THREE from "three";
import { hexV3, PW, PH } from "../../util";
import { PlateBase, quadGeometryWorld, makeGeometry } from "../PlateBase";
import { uniforms } from "../../core/uniforms";
import { GLSL_COMMON } from "../../shaders/chunks";
import type { Wash } from "../../data/art";

/**
 * SkyDome — the matte-paper sky register of a plate (Bible §1/§5 layer 1).
 * Paints the near-black indigo gradient (never pure black), the dark pool
 * behind the title, the galactic dust band (unresolved star-milk) and the
 * whisper accent washes (mauve / steel / nebula) from authored data.
 */
export class SkyDome {
  mesh: THREE.Mesh;

  constructor(plate: PlateBase, cfg: {
    top: string; bottom: string;
    pool: { x: number; y: number; rx: number; ry: number; amt: number };
    dust: { amp: number; yBase: number; tilt: number; sigma: number; sigmaLong: number; color: string; nAmp: number };
    washes: Wash[];
  }) {
    const g = makeGeometry(quadGeometryWorld(-PW / 2, PH / 2, PW / 2, -PH / 2));
    const un = uniforms({
      uSkyTop: { value: new THREE.Vector3(...hexTo3(cfg.top)) },
      uSkyBot: { value: new THREE.Vector3(...hexTo3(cfg.bottom)) },
      uPool: { value: new THREE.Vector4(cfg.pool.x, cfg.pool.y, cfg.pool.rx, cfg.pool.ry) },
      uPoolAmt: { value: cfg.pool.amt },
      uDustColor: { value: new THREE.Vector3(...hexTo3(cfg.dust.color)) },
      uDustAmp: { value: cfg.dust.amp },
      uDustY: { value: cfg.dust.yBase },
      uDustTilt: { value: cfg.dust.tilt },
      uDustSigma: { value: cfg.dust.sigma },
      uDustN: { value: cfg.dust.nAmp },
      uWashN: { value: cfg.washes.length },
      uWashA: { value: new Array(8).fill(0).map((_, i) => new THREE.Vector4(cfg.washes[i]?.x ?? 0, cfg.washes[i]?.y ?? 0, cfg.washes[i]?.rx ?? 1, cfg.washes[i]?.ry ?? 1)) },
      uWashB: { value: new Array(8).fill(0).map((_, i) => { const w = cfg.washes[i]; return w ? new THREE.Vector4(...hexTo3(w.color), w.strength) : new THREE.Vector4(0, 0, 0, 0); }) },
    });

    const frag = `${GLSL_COMMON}
varying vec2 vUv;
uniform vec3 uSkyTop, uSkyBot;
uniform vec4 uPool;
uniform float uPoolAmt;
uniform vec3 uDustColor;
uniform float uDustAmp, uDustY, uDustTilt, uDustSigma, uDustN;
uniform float uWashN;
uniform vec4 uWashA[8];
uniform vec4 uWashB[8];

void main(){
  vec2 px = vUv * vec2(1920.0, 810.0); // authored rpx space, y down
  // base gradient: darkest at the top-centre, slight lift lower
  float t = vUv.y;
  vec3 col = mix(uSkyTop, uSkyBot, smoothstep(0.12, 0.9, t));

  // dark pool behind the title (Bible §3.1)
  vec2 p01 = (px - uPool.xy) / vec2(uPool.z, uPool.w);
  float pe = exp(-dot(p01, p01) * 2.2);
  col -= uPoolAmt * pe * vec3(0.55, 0.6, 0.75);

  // corner + top lift toward the dust band
  float lift = (1.0 - smoothstep(0.0, 0.5, vUv.y)) * 0.012 + smoothstep(0.55, 1.0, vUv.y) * 0.010;
  col += lift * uSkyBot;

  // galactic dust band: an S-curved unresolved star-milk wash
  float bandY = uDustY + uDustTilt * (px.x - 960.0) + 18.0 * sin((px.x - 960.0) / 900.0);
  float dy = (px.y - bandY) / uDustSigma;
  float bx = (px.x - 960.0) / 1900.0;
  float band = exp(-dy * dy * 1.6 - bx * bx * 3.0) * 0.5;
  // fine unresolved structure within the band
  float milk = fbm5(vec2(px.x, px.y) * 0.011 + uTime * 0.002);
  float milk2 = fbm(vec2(px.x, px.y) * 0.05 + 3.7);
  float dustI = band * (0.72 + 0.5 * milk - 0.22 * milk2);
  col += uDustColor * (uDustAmp * dustI * 0.5) * (0.8 + 0.2 * uDustN);
  // pale sheen of unresolved light (kept very low)
  col += uDustColor * uDustAmp * band * 0.35;

  // whisper accent washes
  for (int i = 0; i < 8; i++) {
    if (float(i) >= uWashN) break;
    vec2 d = (px - uWashA[i].xy) / vec2(uWashA[i].z, uWashA[i].w);
    float m = exp(-dot(d, d) * 2.6);
    float wob = 0.85 + 0.3 * fbm(vec2(px.x, px.y) * 0.002 + float(i) * 11.0);
    col += uWashB[i].xyz * uWashB[i].w * m * wob * 0.5;
  }

  gl_FragColor = vec4(col, 1.0);
}`;

    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: frag,
      uniforms: un as Record<string, THREE.IUniform>,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }));
    this.mesh = mesh;
    plate.layer(mesh);
  }
}

function hexTo3(h: string): [number, number, number] {
  const s = hexV3(h);
  const nums = s.replace("vec3(", "").replace(")", "").split(",").map(Number);
  return [nums[0], nums[1], nums[2]];
}
