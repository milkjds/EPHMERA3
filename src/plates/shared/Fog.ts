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

export interface BankCfg {
  y0: number; y1: number; // mask anchors at rise 0 (rpx)
  yEnd0: number; yEnd1: number; // mask anchors at rise 1
  colorTop: string; colorBot: string;
  density: number;
}

/**
 * FogSheets — cotton / frosted-diffusion banks (Plate II, Bible §8.5).
 * The expressive lead: a deep bank at the bottom that thickens and rises over
 * a 5–10 s crescendo (uRise 0→1), swallowing the dial's near rim as time ends.
 * Internal billow comes from domain-warped fBm with lateral drift + rise;
 * the brightest region lands where the moonlight falls (lower-left → bottom).
 * These planes are drawn after the dial — fog in front of the near rim.
 */
export class FogSheets {
  group = new THREE.Group();
  private mats: THREE.ShaderMaterial[] = [];
  constructor(plate: PlateBase, cfg: BankCfg) {
    const base = this.buildBank(cfg);
    this.group.add(base);
    plate.layer(this.group);
    this.group.renderOrder = 500;
  }

  private buildBank(cfg: BankCfg): THREE.Mesh {
    const g = makeGeometry(quadGeometryWorld(-PW / 2, PH / 2, PW / 2, -PH / 2));
    const frag = `${GLSL_COMMON}
      varying vec2 vUv;
      uniform vec4 uAnchors; // y0 y1 yEnd0 yEnd1
      uniform vec3 uColTop;
      uniform vec3 uColBot;
      uniform float uDensity;
      void main(){
        vec2 px = vUv * vec2(1920.0, 810.0);
        float r = uRise;
        float edge = mix(uAnchors.x, uAnchors.z, r);        // feathered top boundary
        float soft = mix(uAnchors.y, uAnchors.w, r) * 2.0;   // transition depth
        float cover = smoothstep(edge, edge + soft, px.y);
        // fog brightest where the moonlight lands: lower-left → bottom
        float light = mix(1.45, 0.7, smoothstep(0.0, 1920.0, px.x));
        light *= mix(1.0, 1.18, smoothstep(810.0, 200.0, px.y));
        // internal billow: domain-warped fBm with lateral drift + rise
        vec2 p = vec2(px.x, px.y) * 0.0017;
        p.x += uTime * 0.0022 + uRise * 0.6;
        p.y += uRise * 0.9;
        float n = fbm5(warp(p));
        float n2 = fbm3(vec2(px.x * 0.004, px.y * 0.004 - uTime * 0.001));
        float dens = cover * (0.16 + 1.05 * n) * (0.8 + 0.4 * n2);
        float a = clamp(dens * uDensity * light, 0.0, 1.0);
        vec3 col = mix(uColTop, uColBot, clamp(a * 1.25, 0.0, 1.0));
        // soft feather near the top edge
        a *= smoothstep(edge, edge + 90.0, px.y);
        gl_FragColor = vec4(col, a * 0.96);
      }`;
    const m = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: frag,
      uniforms: uniforms({
        uAnchors: { value: new THREE.Vector4(cfg.y0, cfg.y1, cfg.yEnd0, cfg.yEnd1) },
        uColTop: { value: new THREE.Vector3(...v3(cfg.colorTop)) },
        uColBot: { value: new THREE.Vector3(...v3(cfg.colorBot)) },
        uDensity: { value: cfg.density },
      }) as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
    });
    this.mats.push(m);
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    return mesh;
  }

  /** thin translucent wisps crossing mid-frame over the glass */
  addWisp(y: number, h: number, scale: number, strength: number, driftDir: number, speed: number) {
    const g = makeGeometry(quadGeometryWorld(-PW / 2, PH / 2, PW / 2, -PH / 2));
    const frag = `${GLSL_COMMON}
      varying vec2 vUv;
      uniform float uY, uH, uScale, uStrength, uDriftDir, uSpeed;
      uniform vec3 uCol;
      void main(){
        vec2 px = vUv * vec2(1920.0, 810.0);
        float gy = exp(-pow((px.y - uY) / uH, 2.0) * 3.0);
        vec2 p = vec2(px.x, px.y) * (0.0009 * uScale);
        p.x += uTime * uSpeed * uDriftDir * 0.004;
        float n = fbm3(warp(p));
        float band = smoothstep(0.35, 0.9, n);
        // horizontal elongation
        float ex = smoothstep(0.0, 60.0, px.x) * smoothstep(1920.0, 1860.0, px.x);
        float a = gy * band * uStrength * ex;
        gl_FragColor = vec4(uCol, a);
      }`;
    const m = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: frag,
      uniforms: uniforms({
        uY: { value: y }, uH: { value: h }, uScale: { value: scale },
        uStrength: { value: strength }, uDriftDir: { value: driftDir }, uSpeed: { value: speed },
        uCol: { value: new THREE.Vector3(...v3("#C9D2DC")) },
      }) as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
    });
    this.mats.push(m);
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    this.group.add(mesh);
  }
}
