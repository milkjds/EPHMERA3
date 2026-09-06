import * as THREE from "three";
import { mulberry32, hexV3, PW, PH } from "../../util";
import { PlateBase } from "../PlateBase";
import { uniforms } from "../../core/uniforms";
import { GLSL_COMMON } from "../../shaders/chunks";
import type { StarCluster, HeroStar } from "../../data/art";

interface Zone {
  kind: "ellipse";
  cx: number; cy: number; rx: number; ry: number;
  mult: number; // density multiplier inside
  fringe: number; // 0..1 soft edge
}

function ellipseFactor(x: number, y: number, z: Zone): number {
  const m = Math.sqrt(((x - z.cx) / z.rx) ** 2 + ((y - z.cy) / z.ry) ** 2);
  const t = (m - 1) * (1 / Math.max(0.05, z.fringe));
  const s = Math.min(1, Math.max(0, 1 + t)); // 1 outside, 0 deep inside (feathered)
  return 1 - (1 - s) * (1 - z.mult);
}

export interface StarCfg {
  seed: number;
  clip: { left: number; top: number; right: number; bottom: number };
  clusters: StarCluster[];
  dimY?: (x: number) => number; // stars below this fade (planet limb)
  zones: Zone[];
  counts: { pin: number; mid: number };
}

/**
 * Starfield — two populations of *anchored* points (Bible §6/§11): pinpricks
 * (1–2 rpx) and mid soft stars (2–4 rpx). Positions are rejection-sampled from
 * authored clusters with genuinely empty patches between, using a fixed seed —
 * no runtime randomness. Stars have no velocity attribute: they cannot drift
 * relative to the plate by construction.
 */
export class Starfield {
  points: THREE.Points;
  private maxCount: number;

  constructor(plate: PlateBase, cfg: StarCfg) {
    const rnd = mulberry32(cfg.seed);
    const count = cfg.counts.pin + cfg.counts.mid;
    this.maxCount = count;

    const pos: number[] = [];
    const size: number[] = [];
    const bright: number[] = [];
    const phase: number[] = [];
    const period: number[] = [];
    const warm: number[] = [];

    const density = (x: number, y: number) => {
      let d = 0.035;
      for (const c of cfg.clusters) {
        const gx = (x - c.x) / c.rx;
        const gy = (y - c.y) / c.ry;
        d += Math.exp(-(gx * gx + gy * gy)) * c.w * (c.kind === "pin" ? 1.9 : 1.0);
      }
      for (const z of cfg.zones) d *= ellipseFactor(x, y, z);
      if (cfg.dimY) {
        const lim = cfg.dimY(x);
        d *= Math.min(1, Math.max(0, (lim - y) / 46)); // stars dissolve into the limb
      }
      return d;
    };

    let attempts = 0;
    const gen = (isPin: boolean) => {
      while (pos.length / 3 < count && attempts < count * 260) {
        attempts++;
        const x = cfg.clip.left + rnd() * (cfg.clip.right - cfg.clip.left);
        const y = cfg.clip.top + rnd() * (cfg.clip.bottom - cfg.clip.top);
        const d = density(x, y);
        if (rnd() > Math.min(1, d)) continue;
        pos.push(x - PW / 2, PH / 2 - y, 0);
        size.push(isPin ? 1.25 + rnd() * 0.8 : 2.6 + rnd() * 1.4);
        bright.push(isPin ? 0.5 + rnd() * 0.45 : 0.42 + rnd() * 0.5);
        phase.push(rnd() * 6.28);
        period.push(1.2 + rnd() * 2.6);
        warm.push(isPin ? rnd() * 0.35 : 0.5 + rnd() * 0.4);
      }
    };
    gen(true);
    gen(false);

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(size), 1));
    g.setAttribute("aBright", new THREE.BufferAttribute(new Float32Array(bright), 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(phase), 1));
    g.setAttribute("aPeriod", new THREE.BufferAttribute(new Float32Array(period), 1));
    g.setAttribute("aWarm", new THREE.BufferAttribute(new Float32Array(warm), 1));
    const vert = `${GLSL_COMMON}
      attribute float aSize;
      attribute float aBright;
      attribute float aPhase;
      attribute float aPeriod;
      attribute float aWarm;
      varying float vA;
      varying float vTw;
      varying float vWarm;
      void main(){
        float tw = 0.5 + 0.5 * sin(6.28318 * (uTime / aPeriod) + aPhase);
        vTw = 0.86 + 0.28 * tw;
        vA = aBright;
        vWarm = aWarm;
        gl_PointSize = clamp(aSize * uPxPerRpx * (0.82 + 0.5 * tw), 1.0, 42.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`;
    const frag = `${GLSL_COMMON}
      varying float vA;
      varying float vTw;
      varying float vWarm;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        float a = 1.0 - smoothstep(0.36, 1.0, d);
        a *= a;
        vec3 pin = mix(${hexV3("#6E7B93")}, ${hexV3("#E7EBF1")}, 0.35 + 0.65 * vWarm);
        gl_FragColor = vec4(pin, a * vA * vTw);
      }`;
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: uniforms() as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    plate.layer(this.points);
  }

  setCount(fraction: number) {
    this.points.geometry.setDrawRange(0, Math.max(1, Math.round(this.maxCount * fraction)));
  }
}

/**
 * HeroStars — engraved 4-point sparkles (Bible §2.1/§6): thin cross flares,
 * never lens discs. Twinkle = small scale + cross-flare gain over 1–2 s;
 * hovering within ~40 rpx shortens the period (~0.6×) — the star answers you.
 */
export class HeroStars {
  mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  heroes: HeroStar[];

  constructor(plate: PlateBase, heroes: HeroStar[]) {
    this.heroes = heroes;
    const pos: number[] = [];
    const off: number[] = [];
    const size: number[] = [];
    const ph: number[] = [];
    const per: number[] = [];
    const br: number[] = [];
    const rot: number[] = [];
    const idx: number[] = [];
    heroes.forEach((h, hi) => {
      const cx = h.x - PW / 2;
      const cy = PH / 2 - h.y;
      const local = [
        [-1, -1], [1, -1], [-1, 1], [1, 1],
      ] as const;
      local.forEach(([sx, sy]) => {
        pos.push(cx, cy, 0); // centre — offset is applied in the vertex shader
        off.push(sx, sy, 0);
        size.push(h.size);
        ph.push(h.phase);
        per.push(h.period);
        br.push(h.bright);
        rot.push(hi % 3 === 2 ? 0.785398 : 0);
      });
      const b = hi * 4;
      idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("aOff", new THREE.BufferAttribute(new Float32Array(off), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(size), 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(ph), 1));
    g.setAttribute("aPeriod", new THREE.BufferAttribute(new Float32Array(per), 1));
    g.setAttribute("aBright", new THREE.BufferAttribute(new Float32Array(br), 1));
    g.setAttribute("aRot", new THREE.BufferAttribute(new Float32Array(rot), 1));
    g.setIndex(idx);
    this.geo = g;

    const vert = `${GLSL_COMMON}
      attribute vec3 aOff;
      attribute float aSize;
      attribute float aPhase;
      attribute float aPeriod;
      attribute float aBright;
      attribute float aRot;
      varying vec2 vN;
      varying float vTw;
      varying float vBr;
      void main(){        // cursor hover shortens the twinkle period (~0.6×) within ~40 rpx
        vec2 screenRpx = vec2(position.x + 960.0 - uDrift, 405.0 - position.y);
        vec2 cur = uCursorUV * vec2(1920.0, 810.0);
        float d = distance(screenRpx, cur);
        float hov = 1.0 - smoothstep(18.0, 80.0, d);
        float pe = max(0.35, aPeriod * (1.0 - 0.4 * hov));
        float tw = sin(6.28318 * (uTime / pe) + aPhase);
        vTw = 0.86 + 0.3 * tw;
        vBr = aBright * (1.0 + 0.22 * hov);
        float ca = cos(aRot);
        float sa = sin(aRot);
        vec2 o = vec2(ca * aOff.x - sa * aOff.y, sa * aOff.x + ca * aOff.y);
        vec3 p = position + vec3(o * (aSize * 2.1), 0.0);
        vN = o;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`;
    const frag = `${GLSL_COMMON}
      varying vec2 vN;
      varying float vTw;
      varying float vBr;
      void main(){
        vec2 n = vN;
        float ax = exp(-n.y * n.y * 26.0) * exp(-abs(n.x) * 3.1);
        float ay = exp(-n.x * n.x * 26.0) * exp(-abs(n.y) * 3.1);
        float d = length(n);
        float core = exp(-d * d * 7.0);
        float i = core * 1.5 + (ax + ay) * 1.15;
        i = pow(i, 1.5);
        vec3 col = ${hexV3("#F4F1EA")};
        gl_FragColor = vec4(col, clamp(i * 0.85 * vBr * vTw, 0.0, 1.0));
      }`;
    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: uniforms() as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.mesh = mesh;
    mesh.frustumCulled = false;
    plate.layer(mesh);
  }
}
