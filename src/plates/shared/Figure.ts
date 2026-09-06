import * as THREE from "three";
import { PlateBase } from "../PlateBase";
import { uniforms } from "../../core/uniforms";
import { GLSL_COMMON } from "../../shaders/chunks";
import { ART } from "../../data/art";
import { PH } from "../../util";

/**
 * Figure — the one painted character (Bible §6/§3.2): ivory hair catching the
 * moonlight, dark dress near-silhouette, at the exact pivot of the clock. She
 * is deliberately the smallest element in the piece (11% PH) and never moves;
 * only a 1–2 s hair/cloth idle (a shader-level uv sway — no vertex motion) and
 * the little cloud wisp at her feet breathe.
 */
export class Figure {
  constructor(plate: PlateBase) {
    const cfg = ART.plateII.figure;
    const hairTone = "#EDE7D8";
    // painted vector art — authored once, rasterised crisp at 2×
    const W = 120;
    const H = 176;
    const cv = document.createElement("canvas");
    cv.width = W * 2;
    cv.height = H * 2;
    const ctx = cv.getContext("2d");
    if (!ctx) throw new Error("no 2d");
    ctx.scale(2, 2);
    ctx.imageSmoothingEnabled = true;
    drawFigure(ctx, W, H, hairTone);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;

    // pivot: the dial centre (935, 375) — her feet rest exactly on it
    const cxw = cfg.x - 960;
    const cyw = PH / 2 - cfg.y;
    // the art's figure spans ~91.5% of the canvas height, feet at the bottom
    const qH = cfg.h / 0.915; // displayed full-canvas height ⇒ figure = cfg.h rpx
    const qW = qH * (W / H);
    const g = new THREE.BufferGeometry();
    const top = cyw + qH / 2; // quad top
    const bot = cyw - qH / 2; // quad bottom (≈ feet, slightly below pivot)
    const verts = new Float32Array([
      cxw - qW / 2, top, 0,
      cxw + qW / 2, top, 0,
      cxw - qW / 2, bot, 0,
      cxw + qW / 2, bot, 0,
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
    g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    g.setIndex([0, 1, 2, 2, 1, 3]);

    const frag = `${GLSL_COMMON}
      uniform sampler2D uMap;
      varying vec2 vUv;
      void main(){
        // 1–2 s idle: a shader-level hair sway (no vertex motion — she stays put)
        float sway = 0.0;
        if (uReduced < 0.5) {
          float ph = sin(6.28318 * uTime / 1.9 + 1.3);
          float m = smoothstep(0.2, 0.95, vUv.y);
          m *= m;
          float spread = 1.0 - smoothstep(0.25, 0.75, abs(vUv.x - 0.5) * 2.0);
          sway = ph * 0.010 * m * (0.35 + 0.65 * spread);
        }
        vec2 uv2 = vec2(vUv.x + sway, vUv.y);
        vec4 c = texture2D(uMap, uv2);
        gl_FragColor = vec4(c.rgb, c.a * 0.985);
      }`;
    const mat = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: frag,
      uniforms: uniforms({ uMap: { value: tex } }) as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    plate.layer(mesh);

    // ---- wisp: a small cloud puff at her feet, slowly billowing (2 s cycle) ----
    const wisps = this.buildWisp(plate, cxw, cyw - qH * 0.5);
    mesh.renderOrder = 620;
    wisps.renderOrder = 621;
  }

  private buildWisp(plate: PlateBase, cxw: number, cyw: number): THREE.Mesh {
    const cfg = ART.plateII.figure;
    const s = cfg.h * 0.42;
    const g = new THREE.BufferGeometry();
    const verts = new Float32Array([-s, cyw + s, 0, s, cyw + s, 0, -s, cyw - s * 0.5, 0, s, cyw - s * 0.5, 0]);
    const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
    g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    g.setIndex([0, 1, 2, 2, 1, 3]);
    const frag = `${GLSL_COMMON}
      uniform vec3 uCol;
      varying vec2 vUv;
      void main(){
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float n = fbm3(p * 3.2 + uTime * 0.12);
        float puff = exp(-r * r * 4.0);
        float cloud = puff * smoothstep(0.28, 0.95, n * 0.6 + 0.5);
        float a = cloud * (0.5 + 0.25 * sin(uTime * 2.6)) * 0.55;
        gl_FragColor = vec4(uCol, clamp(a, 0.0, 0.7));
      }`;
    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: frag,
      uniforms: uniforms({ uCol: { value: new THREE.Vector3(0.82, 0.84, 0.88) } }) as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
    }));
    mesh.frustumCulled = false;
    plate.layer(mesh);
    return mesh;
  }
}

/** hand-painted figure: ivory hair catching the moonlight, dress near-silhouette */
function drawFigure(ctx: CanvasRenderingContext2D, W: number, H: number, hair: string): void {
  const cx = W / 2;
  // soft moonlit halo behind the hair
  const lg = ctx.createRadialGradient(cx, H * 0.18, 2, cx, H * 0.22, W * 0.52);
  lg.addColorStop(0, "rgba(240,237,228,0.10)");
  lg.addColorStop(1, "rgba(240,237,228,0)");
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, H);

  // ---- dress: dark watercolour near-silhouette, moonlit left edge ----
  ctx.beginPath();
  ctx.moveTo(cx, H * 0.32);
  ctx.bezierCurveTo(cx - W * 0.20, H * 0.33, cx - W * 0.19, H * 0.60, cx - W * 0.14, H * 0.80);
  ctx.bezierCurveTo(cx - W * 0.10, H * 0.95, cx - W * 0.16, H * 0.99, cx - W * 0.24, H * 0.99);
  ctx.lineTo(cx + W * 0.24, H * 0.99);
  ctx.bezierCurveTo(cx + W * 0.16, H * 0.99, cx + W * 0.10, H * 0.95, cx + W * 0.14, H * 0.80);
  ctx.bezierCurveTo(cx + W * 0.19, H * 0.60, cx + W * 0.20, H * 0.33, cx, H * 0.32);
  ctx.closePath();
  const dg = ctx.createLinearGradient(cx - W * 0.2, 0, cx + W * 0.2, 0);
  dg.addColorStop(0, "#3C4660"); // moonlit edge
  dg.addColorStop(0.28, "#232B3D");
  dg.addColorStop(0.8, "#1B2231");
  dg.addColorStop(1, "#182030");
  ctx.fillStyle = dg;
  ctx.fill();
  // skirt shading hint
  ctx.fillStyle = "rgba(10,14,22,0.5)";
  ctx.beginPath();
  ctx.ellipse(cx, H * 0.97, W * 0.2, H * 0.018, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- head + ivory hair mass (back view, hair catching the light) ----
  // shoulders / neck silhouette darker than dress top
  ctx.beginPath();
  ctx.ellipse(cx, H * 0.315, W * 0.1, H * 0.035, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#141A27";
  ctx.fill();

  // back hair: large smooth mass
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.145, H * 0.14);
  ctx.bezierCurveTo(cx - W * 0.26, H * 0.16, cx - W * 0.235, H * 0.42, cx - W * 0.175, H * 0.52);
  ctx.bezierCurveTo(cx - W * 0.155, H * 0.60, cx - W * 0.10, H * 0.62, cx - W * 0.075, H * 0.52);
  ctx.bezierCurveTo(cx - W * 0.05, H * 0.44, cx - W * 0.075, H * 0.30, cx, H * 0.24);
  ctx.bezierCurveTo(cx + W * 0.075, H * 0.30, cx + W * 0.05, H * 0.44, cx + W * 0.075, H * 0.52);
  ctx.bezierCurveTo(cx + W * 0.10, H * 0.62, cx + W * 0.155, H * 0.60, cx + W * 0.175, H * 0.52);
  ctx.bezierCurveTo(cx + W * 0.235, H * 0.42, cx + W * 0.26, H * 0.16, cx + W * 0.145, H * 0.14);
  ctx.bezierCurveTo(cx + W * 0.09, H * 0.075, cx - W * 0.09, H * 0.075, cx - W * 0.145, H * 0.14);
  ctx.closePath();
  const hg = ctx.createLinearGradient(cx - W * 0.26, 0, cx + W * 0.26, 0);
  hg.addColorStop(0, hair);
  hg.addColorStop(0.45, "#EFEADF");
  hg.addColorStop(1, "#D8D2C4");
  ctx.fillStyle = hg;
  ctx.fill();

  // hair strand structure (engraved feel, low contrast)
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(150,144,132,0.5)";
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.04, H * 0.16);
  ctx.quadraticCurveTo(cx - W * 0.06, H * 0.32, cx - W * 0.11, H * 0.42);
  ctx.moveTo(cx + W * 0.02, H * 0.155);
  ctx.quadraticCurveTo(cx + W * 0.05, H * 0.3, cx + W * 0.08, H * 0.4);
  ctx.moveTo(cx - W * 0.09, H * 0.155);
  ctx.quadraticCurveTo(cx - W * 0.12, H * 0.26, cx - W * 0.135, H * 0.35);
  ctx.stroke();

  // bright moonlit rim on her hair (upper-left light)
  ctx.strokeStyle = "rgba(255,252,244,0.55)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.145, H * 0.13);
  ctx.quadraticCurveTo(cx - W * 0.19, H * 0.22, cx - W * 0.16, H * 0.42);
  ctx.stroke();

  // feet shadow at hem
  ctx.fillStyle = "rgba(8,10,16,0.6)";
  ctx.beginPath();
  ctx.ellipse(cx, H * 0.985, W * 0.11, H * 0.012, 0, 0, Math.PI * 2);
  ctx.fill();
}
