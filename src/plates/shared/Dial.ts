import * as THREE from "three";
import { hexV3 } from "../../util";
import { PlateBase } from "../PlateBase";
import { uniforms } from "../../core/uniforms";
import { GLSL_COMMON } from "../../shaders/chunks";
import { ART } from "../../data/art";

function v3(h: string): [number, number, number] {
  const s = hexV3(h);
  const p = s.replace("vec3(", "").replace(")", "").split(",");
  return [Number(p[0]), Number(p[1]), Number(p[2])];
}

export interface DialParams {
  R: number;
  numeralH: number;
  tiltCos: number;
}

const SAMPLER_FRAG = `${GLSL_COMMON}
  uniform sampler2D uMap;
  varying vec2 vUv;
  void main(){
    vec4 t = texture2D(uMap, vUv);
    gl_FragColor = t;
  }`;

/**
 * Dial — the clock drawn as an astronomical instrument (Plate II).
 * A perfect circle in real foreshortening: the dial plane group is pitched
 * about X by acos(0.48) inside a perspective camera, so the rim runs off both
 * frame edges, near numerals enlarge and far numerals compress automatically.
 * Everything is transparent annotation line-art (additive): the cosmos shows
 * through dial, hands and numerals — enforced by blend mode (Bible §5).
 */
export class Dial {
  group = new THREE.Group();
  hourHand!: THREE.Mesh;
  minuteHand!: THREE.Mesh;
  private handAngles = { hour: ART.plateII.dial.handDeg.hour, min: ART.plateII.dial.handDeg.min };

  constructor(plate: PlateBase, params: DialParams) {
    const c = ART.plateII.dial;
    const phi = Math.acos(Math.min(0.999, params.tiltCos));
    this.group.position.set(c.cx - 960, 405 - c.cy, 0);
    this.group.rotation.x = -phi;

    const lineMat = this.strokeMaterial("#E4E9EE", 0.8);
    this.buildRings(c, lineMat);
    this.buildTicks(c, lineMat);
    this.buildNumerals(c, params);
    // w = shaft half-width in plane units (rpx)
    this.hourHand = this.makeHand((c.hourHand.len + 0.02) * c.R, c.hourHand.tail * c.R, 6);
    this.minuteHand = this.makeHand(c.minHand.len * c.R, c.minHand.tail * c.R, 4.4);
    this.hourHand.renderOrder = 4;
    this.minuteHand.renderOrder = 4;
    this.applyHandAngles();

    plate.layer(this.group);
  }

  private strokeMaterial(color: string, opacity: number): THREE.ShaderMaterial {
    const frag = `${GLSL_COMMON}
      uniform vec3 uCol;
      uniform float uOp;
      void main(){ gl_FragColor = vec4(uCol, uOp); }`;
    return new THREE.ShaderMaterial({
      vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: frag,
      uniforms: uniforms({ uCol: { value: new THREE.Vector3(...v3(color)) }, uOp: { value: opacity } }) as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    });
  }

  private samplerMaterial(map: THREE.Texture): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: SAMPLER_FRAG,
      uniforms: uniforms({ uMap: { value: map } }) as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    });
  }

  // ---------------- chapter rings ----------------
  private buildRings(c: typeof ART.plateII.dial, mat: THREE.Material) {
    const rings: { r: number; w: number }[] = [
      { r: c.R * 1.0, w: 1.5 },
      { r: c.R * 0.952, w: 1.3 },
    ];
    for (const ring of rings) {
      const mesh = new THREE.Mesh(ringGeometry(ring.r, ring.w, 480), mat);
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
  }

  // ---------------- radial ticks ----------------
  private buildTicks(c: typeof ART.plateII.dial, mat: THREE.Material) {
    const pos: number[] = [];
    const idx: number[] = [];
    let vc = 0;
    const n = c.tickCount;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const hour = i % 5 === 0;
      const r0 = c.R * (hour ? c.tickIn - 0.018 : c.tickIn);
      const r1 = c.R * c.tickOut;
      const wTan = hour ? 2.8 : 1.4;
      const da = wTan / ((r0 + r1) / 2);
      const a0 = a - da / 2;
      const a1 = a + da / 2;
      pos.push(
        Math.cos(a0) * r0, Math.sin(a0) * r0, 0,
        Math.cos(a1) * r0, Math.sin(a1) * r0, 0,
        Math.cos(a0) * r1, Math.sin(a0) * r1, 0,
        Math.cos(a1) * r1, Math.sin(a1) * r1, 0
      );
      idx.push(vc, vc + 1, vc + 2, vc + 2, vc + 1, vc + 3);
      vc += 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    this.group.add(mesh);
  }

  // ---------------- hollow Roman numerals (stroke atlas) ----------------
  private buildNumerals(c: typeof ART.plateII.dial, p: DialParams) {
    const numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    const fam = '"Cinzel", "Times New Roman", serif';
    const inkH = 200;
    const cv = document.createElement("canvas");
    const ctx = cv.getContext("2d");
    if (!ctx) throw new Error("no 2d");

    type R = { w: number; asc: number; desc: number };
    const rects: R[] = numerals.map((txt) => {
      ctx.font = `500 ${inkH}px ${fam}`;
      const m = ctx.measureText(txt);
      return {
        w: m.width,
        asc: Math.abs(m.actualBoundingBoxAscent || 0),
        desc: Math.abs(m.actualBoundingBoxDescent || 0),
      };
    });
    const pad = 20;
    const rowH = inkH + pad * 2 + 8;
    const atlasW = 2048;
    cv.width = atlasW;
    cv.height = rowH * 2;
    const cellX: number[] = [];
    const cellY: number[] = [];
    let curX = 0;
    let curY = 0;
    numerals.forEach((txt, i) => {
      const w = rects[i].w + pad * 2;
      if (curX + w > atlasW && curX > 0) {
        curX = 0;
        curY += rowH;
      }
      cellX.push(curX);
      cellY.push(curY);
      ctx.save();
      ctx.clearRect(curX - 1, curY - 1, w + 2, rowH + 2);
      ctx.font = `500 ${inkH}px ${fam}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.lineJoin = "round";
      const baseY = curY + pad + rects[i].asc;
      ctx.strokeStyle = "#F2F5F8";
      // soft outer pass (halo) then crisp inner stroke — etched line catch-light
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 7;
      ctx.strokeText(txt, curX + pad, baseY);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3.4;
      ctx.strokeText(txt, curX + pad, baseY);
      ctx.restore();
      curX += w + 8;
    });
    const atlas = new THREE.CanvasTexture(cv);
    atlas.anisotropy = 8;
    const mat = this.samplerMaterial(atlas);

    // merged geometry: one quad per numeral, tangent-baseline, radial-out
    const pos: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    let vc = 0;
    const rn = c.R * c.numeralR;
    numerals.forEach((_, i) => {
      const rect = rects[i];
      const th = p.numeralH;
      const ascPx = rect.asc;
      const inkHpx = ascPx + rect.desc;
      const u0 = (cellX[i] + pad) / atlasW;
      const u1 = (cellX[i] + pad + rect.w) / atlasW;
      const rowTop = cellY[i] + pad; // top of ink
      const vTop = 1 - rowTop / cv.height;
      const vBot = 1 - (rowTop + inkHpx) / cv.height;
      // dial-plane size (units): glyph ascender height = th
      const asc = th;
      const desc = (th * rect.desc) / ascPx;
      const halfW = (th * rect.w) / ascPx / 2;
      const ang = (i * 30 * Math.PI) / 180;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const px0 = Math.sin(ang) * rn;
      const py0 = Math.cos(ang) * rn;
      // local corners: y from -desc (baseline) to +asc (top)
      const corners: [number, number][] = [
        [-halfW, asc],
        [halfW, asc],
        [-halfW, -desc],
        [halfW, -desc],
      ];
      const uvC: [number, number][] = [
        [u0, vTop],
        [u1, vTop],
        [u0, vBot],
        [u1, vBot],
      ];
      for (let k = 0; k < 4; k++) {
        const [lx, ly] = corners[k];
        // rotate so glyph-up points radially outward; baseline = rim tangent
        const rx = lx * ca - ly * sa;
        const ry = lx * sa + ly * ca;
        pos.push(px0 + rx, py0 + ry, 0);
        uvs.push(uvC[k][0], uvC[k][1]);
      }
      idx.push(vc, vc + 1, vc + 2, vc + 2, vc + 1, vc + 3);
      vc += 4;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    this.group.add(mesh);
  }

  // ---------------- hands (spade line-art, constant creep) ----------------
  private makeHand(len: number, tail: number, halfW: number): THREE.Mesh {
    const rs = 2;
    const cvW = Math.max(96, Math.round((halfW * 2 * 1.6 + 30) * rs));
    const cvH = Math.max(96, Math.round((len + tail + 16) * rs));
    const cv = document.createElement("canvas");
    cv.width = cvW;
    cv.height = cvH;
    const ctx = cv.getContext("2d");
    if (!ctx) throw new Error("no 2d");
    ctx.translate(cvW / 2, cvH / 2);
    ctx.scale(rs, rs);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const path = handOutline(len, tail, halfW);
    ctx.shadowColor = "rgba(240,243,246,0.55)";
    ctx.shadowBlur = 1.6 * rs;
    strokePath(ctx, path, 2.8, 0.38); // soft engraved glow
    ctx.shadowColor = "transparent";
    strokePath(ctx, path, 1.15, 0.92); // crisp etched stroke
    strokePath(ctx, path, 0.5, 0.3); // hairline inner
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 8;

    const g = new THREE.BufferGeometry();
    const hhw = (halfW * 1.6 + 30) / 2;
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
      -hhw, len + 8, 0, hhw, len + 8, 0, -hhw, -tail - 8, 0, hhw, -tail - 8, 0,
    ]), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
    g.setIndex([0, 1, 2, 2, 1, 3]);
    const mesh = new THREE.Mesh(g, this.samplerMaterial(tex));
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return mesh;
  }

  private applyHandAngles() {
    const rad = (d: number) => (-d * Math.PI) / 180;
    this.hourHand.rotation.z = rad(this.handAngles.hour);
    this.minuteHand.rotation.z = rad(this.handAngles.min);
  }

  /** near-still hand creep: constant 0.3–0.6 °/s (no easing), frozen under reduced motion */
  update(visualT: number, reduced: boolean) {
    const c = ART.motion;
    const d0 = ART.plateII.dial.handDeg;
    const t = reduced ? 0 : Math.max(0, visualT - ART.times.dissolveEnd);
    this.handAngles.hour = d0.hour + c.handHourDeg * t;
    this.handAngles.min = d0.min + c.handMinDeg * t;
    this.applyHandAngles();
  }
}

function ringGeometry(r: number, w: number, seg: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  let vc = 0;
  const ri = r - w / 2;
  const ro = r + w / 2;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    pos.push(Math.cos(a0) * ri, Math.sin(a0) * ri, 0, Math.cos(a0) * ro, Math.sin(a0) * ro, 0);
    pos.push(Math.cos(a1) * ri, Math.sin(a1) * ri, 0, Math.cos(a1) * ro, Math.sin(a1) * ro, 0);
    idx.push(vc, vc + 1, vc + 2, vc + 2, vc + 1, vc + 3);
    vc += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  return g;
}

function strokePath(ctx: CanvasRenderingContext2D, path: [number, number][], width: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(path[0][0], path[0][1]);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** spade hand outline — pivot at origin, tip toward +y (12), counterweight tail. */
function handOutline(len: number, tail: number, w: number): [number, number][] {
  const pts: [number, number][] = [];
  const lobe = w * 1.35;
  // right side, tip → tail
  const right: [number, number][] = [
    [0, len],
    [lobe, len * 0.9],
    [lobe * 0.72, len * 0.66],
    [w * 0.5, len * 0.52],
    [w * 0.62, len * 0.3],
    [w * 0.5, len * 0.05],
    [w * 0.34, -tail * 0.4],
    [w * 0.6, -tail * 0.75],
    [0, -tail],
  ];
  pts.push(...right);
  // left side mirrored upward
  for (let i = right.length - 2; i >= 1; i--) {
    pts.push([-right[i][0], right[i][1]]);
  }
  pts.push([0, len]);
  return pts;
}
