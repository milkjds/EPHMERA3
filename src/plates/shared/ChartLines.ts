import * as THREE from "three";
import { hexV3, PW, PH } from "../../util";
import { PlateBase } from "../PlateBase";
import { uniforms } from "../../core/uniforms";
import { GLSL_COMMON } from "../../shaders/chunks";
import type { ChartSeg } from "../../data/art";

function hexTo3Arr(h: string): [number, number, number] {
  const s = hexV3(h);
  const parts = s.replace("vec3(", "").replace(")", "").split(",");
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

/**
 * ChartLines — fine-liner dash segments on the plate (Bible §11): hand-ruled,
 * never vector-perfect. Ribbon quads (never gl.LINES) with analytic AA; dash
 * lengths are uneven (±20% via a per-segment wobble seed). Additive line-art =
 * the cosmos always shows through (TECH §5.2). Straight segments and arcs
 * following limb curvature are both supported.
 */
export class ChartLines {
  group = new THREE.Group();

  constructor(plate: PlateBase, segs: ChartSeg[]) {
    const vert = `${GLSL_COMMON}
      varying vec2 vUv;
      varying vec2 vScreen;
      void main(){
        vUv = uv;
        vScreen = vec2(position.x + 960.0 - uDrift, 405.0 - position.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`;

    for (const s of segs) {
      const pts: [number, number][] = [];
      if (s.kind === "line") {
        pts.push([s.x1!, s.y1!], [s.x2!, s.y2!]);
      } else {
        const n = Math.max(8, Math.ceil(Math.abs(s.a1! - s.a0!) / 1.2));
        for (let i = 0; i <= n; i++) {
          const a = ((s.a0! + ((s.a1! - s.a0!) * i) / n) * Math.PI) / 180;
          pts.push([s.cx! + Math.cos(a) * s.r!, s.cy! - Math.sin(a) * s.r!]);
        }
      }
      const width = 1.3;
      const dash = s.style === "long" ? 20 : 4;
      const gap = s.style === "long" ? 12 : 6;

      const pos: number[] = [];
      const uvs: number[] = [];
      const idx: number[] = [];
      let lenSoFar = 0;
      let vc = 0;
      for (let p = 0; p < pts.length - 1; p++) {
        const [ax, ay] = pts[p];
        const [bx, by] = pts[p + 1];
        const wx = ax - PW / 2;
        const wy = PH / 2 - ay;
        const dx = bx - ax;
        const dy = by - ay;
        const L = Math.hypot(dx, dy);
        if (L < 1e-3) continue;
        const nx = -dy / L;
        const ny = dx / L;
        const hw = width / 2;
        const base = vc;
        const push = (px2: number, py2: number, u: number, v: number) => {
          pos.push(px2, py2, 0);
          uvs.push(u, v);
        };
        push(wx - nx * hw, wy - ny * hw, -0.5, lenSoFar);
        push(wx + nx * hw, wy + ny * hw, 0.5, lenSoFar);
        push(bx - PW / 2 - nx * hw, PH / 2 - by - ny * hw, -0.5, lenSoFar + L);
        push(bx - PW / 2 + nx * hw, PH / 2 - by + ny * hw, 0.5, lenSoFar + L);
        idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        lenSoFar += L;
        vc += 4;
      }
      if (idx.length === 0) continue;

      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
      g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
      g.setIndex(idx);

      const frag = `${GLSL_COMMON}
        varying vec2 vUv;
        varying vec2 vScreen;
        uniform float uWidth;
        uniform float uDash;
        uniform float uGap;
        uniform float uOpacity;
        uniform float uWobble;
        uniform vec3 uColor;
        void main(){
          float acrossPx = abs(vUv.x) * uWidth * uPxPerRpx;
          float halfPx = uWidth * uPxPerRpx * 0.5;
          float aEdge = 1.0 - smoothstep(halfPx - 0.75, halfPx + 0.75, acrossPx);
          // uneven hand-ruled dashes (±20% wobble per segment)
          float L0 = uDash + uGap;
          float idx = floor(vUv.y / L0);
          float ld = uDash * (0.8 + 0.4 * hash11(idx * 1.71 + uWobble));
          float lg = uGap  * (0.8 + 0.4 * hash11(idx * 2.93 + uWobble * 7.0));
          float start = idx * L0;
          float local = vUv.y - start;
          float on = 0.0;
          if (local < ld) {
            float e0 = smoothstep(0.0, 2.6, local);
            float e1 = 1.0 - smoothstep(0.0, 2.6, ld - local);
            on = e0 * e1;
          }
          // the cursor is light on glass: lines brighten near it (Bible §12.3)
          vec2 cur = uCursorUV * vec2(1920.0, 810.0);
          float cd = distance(vScreen, cur);
          float curGlow = uCursorGain * (1.0 - smoothstep(60.0, 620.0, cd));
          float a = aEdge * on * uOpacity * (1.0 + curGlow * 0.28);
          gl_FragColor = vec4(uColor, a);
        }`;

      const un = uniforms({
        uWidth: { value: width },
        uDash: { value: dash },
        uGap: { value: gap },
        uOpacity: { value: s.opacity },
        uWobble: { value: s.wobble },
        uColor: { value: new THREE.Vector3(...hexTo3Arr("#D3DAE3")) },
      });
      const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: un as Record<string, THREE.IUniform>,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    plate.layer(this.group);
  }
}
