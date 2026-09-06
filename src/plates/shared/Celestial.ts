import * as THREE from "three";
import { hexV3, PW, PH } from "../../util";
import { PlateBase, quadGeometryWorld, makeGeometry } from "../PlateBase";
import { uniforms } from "../../core/uniforms";
import { GLSL_COMMON } from "../../shaders/chunks";

function v3(h: string): [number, number, number] {
  const s = hexV3(h);
  const p = s.replace("vec3(", "").replace(")", "").split(",");
  return [Number(p[0]), Number(p[1]), Number(p[2])];
}

interface BodyCfg {
  cx: number; cy: number; r: number;
  rect: [number, number, number, number]; // rpx quad x0 y0 x1 y1
  mode: "planet" | "moon" | "limb";
}

function makeBodyShader(mode: string): string {
  const m = mode;
  const body = m === "planet"
    ? `
      // ---- watercolour planet face (Bible §6) ----
      float kx = px.x;
      // key from lower-left limb; the visible rim catches it
      vec3 base = mix(uFace, uFaceBot, smoothstep(uFadeY0, uFadeY1, px.y));
      // large watercolour blooms
      float n1 = fbm5(warp(vec2(px.x, px.y) * 0.0019 + uSeed));
      float n2 = fbm(vec2(px.x, px.y) * 0.008 + uSeed * 3.1);
      vec3 col = base + (n1 - 0.5) * uMottleAmp * vec3(0.5, 0.62, 0.9)
                      + (n2 - 0.5) * uMottleAmp * 0.45;
      // craters — visible where the surface is lit, dissolving below
      float cr = fbm3(vec2(px.x, px.y) * 0.0045 + 21.0);
      float cr2 = fbm3(vec2(px.x, px.y) * 0.013 + 77.0);
      float craterMask = smoothstep(0.42, 0.66, cr) * smoothstep(0.7, 0.3, cr2);
      col -= craterMask * vec3(0.03, 0.04, 0.06) * uCratAmp;
      // smoky terminator: surface dissolves into the limb fog, never crisp
      float toEdge = uR - d;
      col = mix(col, uHazeCol, exp(-toEdge / max(1.0, uHazeIn + 30.0)) * 0.5);
      // brilliant limb core — the only white heat of the plate
      float e = exp(-toEdge / max(1.0, uLimbSpread));
      float side = 1.0 - 0.55 * smoothstep(-1100.0, 700.0, kx); // left limb brighter
      col += uLimbCol * e * (0.55 + 0.5 * side) * uLimbAmp;
      // soft face veil toward the bottom (texture dissolves into fog)
      float veil = smoothstep(uFadeY0, uFadeY1, px.y);
      col = mix(col, uVeilCol, veil * 0.5);
      color = col;
      alpha = 1.0;
      // fade to the fog band near very bottom
      alpha = mix(1.0, 0.45, smoothstep(560.0, 810.0, px.y));
      // no dark edge under the limb: keep the arc soft
      alpha *= aInside;
    `
    : m === "moon"
      ? `
      // ---- the far moon: dark face barely Δ5–8% above the sky (Bible §3.1) ----
      vec3 col = uFace;
      // face mottle — felt, not seen
      float n1 = fbm5(vec2(px.x, px.y) * 0.0016 + uSeed);
      float n2 = fbm3(vec2(px.x, px.y) * 0.006 + uSeed * 9.0);
      col += (n1 - 0.5) * 0.045 + (n2 - 0.5) * 0.02;
      // the key light (same direction as the planet — consistency is mandatory)
      vec2 nrm = (px - uC) / max(1.0, uR);
      vec2 ldir = normalize(uKey - px);
      float lit = pow(max(dot(nrm, ldir), 0.0), 4.5);
      // craters / maria in the lit zone only
      float maria = smoothstep(0.3, 0.85, fbm3(vec2(px.x, px.y) * 0.004 + 55.0));
      float maria2 = smoothstep(0.25, 0.8, fbm3(vec2(px.x, px.y) * 0.009 + 3.0));
      col += maria * maria2 * 0.028 * lit * 1.6;
      // terminator: smoky, soft (a veil only near the limb, never a wash)
      float toEdge = uR - d;
      col = mix(col, uHazeCol * 0.5, exp(-toEdge / 60.0) * 0.35);
      // lit ivory crescent on the lower-left rim + faint inner lift on lit side
      float cres = pow(max(dot(nrm, ldir), 0.0), 3.0);
      float cresN = pow(max(dot(nrm, ldir), 0.0), 10.0);
      float edgeFade = exp(-toEdge / 26.0);
      col += uCrescentCol * (cres * 0.55 + cresN) * edgeFade * uLimbAmp;
      // maria glow inside the lit zone so the crescent is not a hard line
      col += uCrescentCol * pow(max(dot(nrm, ldir), 0.0), 5.0) * 0.05;
      // edge lift so the disc reads against the sky — barely
      col += uEdgeLift * exp(-toEdge / 10.0) * 0.35;
      // soft veil under it near the limb band
      float veil = smoothstep(500.0, 720.0, px.y);
      col = mix(col, uHazeCol, veil * 0.22);
      color = col;
      alpha = aInside * 0.998;
    `
      : `
      // ---- moon limb (Plate II corner): a glowing arc, eaten by the vignette ----
      float tE = abs(d - uR);
      float gCore = exp(-tE * tE / (2.0 * 90.0 * 90.0));
      float gHalo = exp(-tE * tE / (2.0 * 240.0 * 240.0));
      // only one side (outer) haze reads in the corner; inner is quiet
      vec3 col = uCrescentCol * (gCore * 0.9 + gHalo * 0.30) * uLimbAmp;
      // disc interior just perceptibly lighter than the sky
      float insideA = smoothstep(uR, uR - 90.0, d);
      col += uFace * 0.5 * insideA * 0.16;
      color = col;
      alpha = 1.0;
      // feathered by the glow itself
    `;
  return body;
}

/** Builds & installs one celestial body quad on the plate. */
export class CelestialBody {
  mesh: THREE.Mesh;

  constructor(
    plate: PlateBase,
    cfg: BodyCfg,
    colors: {
      face?: string;
      faceBot?: string;
      limb?: string;
      crescent?: string;
      edgeLift?: string;
      haze?: string;
    },
    opts: {
      mottleAmp?: number;
      cratAmp?: number;
      seed?: number;
      limbAmp?: number;
      hazeIn?: number;
      key?: [number, number];
    } = {}
  ) {
    const [x0, y0, x1, y1] = cfg.rect;
    const g = makeGeometry(
      quadGeometryWorld(x0 - PW / 2, PH / 2 - y0, x1 - PW / 2, PH / 2 - y1)
    );
    const key = opts.key ?? [cfg.cx - cfg.r, cfg.cy];
    const un = uniforms({
      uRect: { value: new THREE.Vector4(x0, y0, x1, y1) },
      uC: { value: new THREE.Vector2(cfg.cx, cfg.cy) },
      uR: { value: cfg.r },
      uKey: { value: new THREE.Vector2(key[0], key[1]) },
      uFace: { value: new THREE.Vector3(...v3(colors.face ?? "#2A3140")) },
      uFaceBot: { value: new THREE.Vector3(...v3(colors.faceBot ?? "#4A5468")) },
      uLimbCol: { value: new THREE.Vector3(...v3(colors.limb ?? "#F4F1EA")) },
      uHazeCol: { value: new THREE.Vector3(...v3(colors.haze ?? "#C7CDD6")) },
      uCrescentCol: { value: new THREE.Vector3(...v3(colors.crescent ?? "#EDE9DF")) },
      uEdgeLift: { value: new THREE.Vector3(...v3(colors.edgeLift ?? "#1C2334")) },
      uMottleAmp: { value: opts.mottleAmp ?? 0.1 },
      uCratAmp: { value: opts.cratAmp ?? 0.3 },
      uSeed: { value: opts.seed ?? 7.3 },
      uLimbAmp: { value: opts.limbAmp ?? 1 },
      uHazeIn: { value: opts.hazeIn ?? 20 },
      uFadeY0: { value: 440 },
      uFadeY1: { value: 790 },
      uLimbSpread: { value: 4.0 },
      uVeilCol: { value: new THREE.Vector3(...v3("#9BA6B8")) },
    });

    const bodyCode = makeBodyShader(cfg.mode);
    const frag = `${GLSL_COMMON}
      varying vec2 vUv;
      uniform vec4 uRect;
      uniform vec2 uC;
      uniform float uR;
      uniform vec2 uKey;
      uniform vec3 uFace, uFaceBot, uLimbCol, uHazeCol, uCrescentCol, uEdgeLift, uVeilCol;
      uniform float uMottleAmp, uCratAmp, uSeed, uLimbAmp, uHazeIn, uFadeY0, uFadeY1, uLimbSpread;
      void main(){
        vec2 px = mix(uRect.xy, uRect.zw, vUv);
        float d = distance(px, uC);
        float aInside = 1.0 - smoothstep(uR - 1.2, uR + 1.2, d);
        vec3 color = uFace;
        float alpha = 0.0;
        ${bodyCode}
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
      }`;

    const mat = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: frag,
      uniforms: un as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    plate.layer(this.mesh);
  }
}

/**
 * LimbFogBand (Plate I §8.1) — the luminous fog blanket hugging the planet's
 * edge above the limb, brightest element after the limb itself.
 */
export class LimbFogBand {
  constructor(plate: PlateBase, cx: number, cy: number, r: number) {
    const g = makeGeometry(quadGeometryWorld(-PW / 2, PH / 2, PW / 2, -PH / 2));
    const frag = `${GLSL_COMMON}
      varying vec2 vUv;
      uniform vec2 uC;
      uniform float uR;
      uniform vec3 uCol;
      void main(){
        vec2 px = vUv * vec2(1920.0, 810.0);
        float d = distance(px, uC);
        float above = d - uR; // >0 above the limb
        // 12–18.5% PH deep blanket, feathered, drifting left with the plate
        float band = exp(-above / 110.0) * step(0.0, above) * 0.6;
        band *= smoothstep(0.0, 1.0, -d + uR + 160.0);
        // internal structure, never a flat gradient
        float billow = fbm(vec2(px.x, px.y) * 0.0026 + uTime * 0.004);
        float fine = fbm(vec2(px.x, px.y) * 0.016);
        float a = band * (0.5 + 0.55 * billow - 0.25 * fine) * (0.55 + 0.4 * uExposure);
        // brightest at the limb, gone beyond ~110 rpx above
        a *= smoothstep(150.0, 5.0, above);
        gl_FragColor = vec4(uCol, clamp(a * 0.32, 0.0, 1.0));
      }`;
    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: frag,
      uniforms: uniforms({
        uC: { value: new THREE.Vector2(cx, cy) },
        uR: { value: r },
        uCol: { value: new THREE.Vector3(...v3("#CDD4DE")) },
      }) as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    }));
    mesh.frustumCulled = false;
    plate.layer(mesh);
  }
}

/** BottomVeil (Plate I §8.4) — softening fog, bottom edge of the frame. */
export class BottomVeil {
  constructor(plate: PlateBase) {
    const g = makeGeometry(quadGeometryWorld(-PW / 2, PH / 2, PW / 2, -PH / 2));
    const frag = `${GLSL_COMMON}
      varying vec2 vUv;
      uniform vec3 uCol;
      void main(){
        vec2 px = vUv * vec2(1920.0, 810.0);
        float base = smoothstep(600.0, 812.0, px.y);
        // veil lift tied to the developing exposure (Bible §8)
        base *= 0.55 + 0.45 * uExposure;
        float billow = fbm(vec2(px.x, px.y) * 0.0022 + uTime * 0.002);
        float streak = fbm(vec2(px.x, px.y * 0.35) * 0.004);
        float a = base * (0.28 + 0.72 * billow) * (0.6 + 0.4 * streak);
        gl_FragColor = vec4(uCol * a, a);
      }`;
    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: frag,
      uniforms: uniforms({
        uCol: { value: new THREE.Vector3(...v3("#B9C1CD")) },
      }) as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
    }));
    mesh.frustumCulled = false;
    plate.layer(mesh);
  }
}
