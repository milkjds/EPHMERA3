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

export interface GearCfg {
  x: number; y: number; r: number;
  teeth: number; rot: number; inner: number; tone: number;
}

/**
 * Gears — cut-paper silhouettes with circular voids (Plate II upper-right
 * mass; Bible §6). Matte near-black shapes, flat after the dissolve — the
 * leftovers of the previous scene's world, now background. Procedurally
 * generated *shapes* with authored parameters; dark & quiet by design.
 */
export class Gears {
  mesh: THREE.Mesh;

  constructor(plate: PlateBase, gears: GearCfg[]) {
    // region covering the upper-right mass
    const g = makeGeometry(quadGeometryWorld(1000 - PW / 2, PH / 2 - (-140), 2280 - PW / 2, PH / 2 - 800));
    const n = Math.min(8, gears.length);
    const A: THREE.Vector4[] = [];
    const B: THREE.Vector4[] = [];
    for (let i = 0; i < 8; i++) {
      const gr = gears[i];
      if (gr) A.push(new THREE.Vector4(gr.x, gr.y, gr.r, gr.teeth));
      else A.push(new THREE.Vector4(0, 0, 1, 8));
      B.push(new THREE.Vector4(gr ? gr.rot : 0, gr ? gr.inner : 0.6, gr ? gr.tone : 1, i));
    }
    const frag = `${GLSL_COMMON}
      varying vec2 vUv;
      uniform vec4 uRect;
      uniform vec4 uGearA[8]; // x y r teeth
      uniform vec4 uGearB[8]; // rot inner tone idx
      uniform float uN;
      uniform vec3 uCol;
      // f(a): toothy gear profile, slightly hand-cut
      float profile(float a, vec4 ga, vec4 gb){
        float wob = 0.85 + 0.25 * noise2(vec2(floor(a * 22.0), ga.z * 0.1 + gb.w));
        float teeth = 1.0 + 0.085 * cos(ga.w * a + gb.x)
                           + 0.028 * cos(2.0 * ga.w * a + 1.7 + gb.x * 3.0);
        return ga.z * teeth * wob;
      }
      void main(){
        vec2 px = mix(uRect.xy, uRect.zw, vUv);
        float cov = 0.0;
        for (int i = 0; i < 8; i++) {
          if (float(i) >= uN) break;
          vec2 c = uGearA[i].xy;
          vec2 d = px - c;
          float l = length(d);
          float a = atan(d.y, d.x) + 1.5708 + uGearB[i].x;
          float f = profile(a, uGearA[i], uGearB[i]);
          // solid + AA + tooth voids
          float c1 = smoothstep(-0.6, 0.6, (f - l) * uPxPerRpx);
          float innerR = uGearA[i].z * uGearB[i].y;
          float hole1 = smoothstep(-0.6, 0.6, (l - innerR) * uPxPerRpx);
          // axle hole
          float axle = smoothstep(-0.6, 0.6, (l - innerR * 0.42) * uPxPerRpx);
          // decorative small voids at 3 o'clock-ish angles
          float vo = 0.0;
          for (int k = 0; k < 3; k++) {
            float ang = float(k) * 2.0944 + uGearB[i].x;
            vec2 vc2 = uGearA[i].xy + vec2(cos(ang), sin(ang)) * uGearA[i].z * 0.68;
            vo += smoothstep(-0.6, 0.6, (length(px - vc2) - uGearA[i].z * 0.16) * uPxPerRpx);
          }
          float thisCov = c1 * hole1 * axle * (1.0 - clamp(vo, 0.0, 1.0));
          cov = max(cov, thisCov * uGearB[i].z);
        }
        gl_FragColor = vec4(uCol, cov * 0.98);
      }`;
    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: frag,
      uniforms: uniforms({
        uRect: { value: new THREE.Vector4(1000, -140, 2280, 800) },
        uGearA: { value: A },
        uGearB: { value: B },
        uN: { value: n },
        uCol: { value: new THREE.Vector3(...v3("#0A0C12")) },
      }) as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
    }));
    this.mesh = mesh;
    mesh.frustumCulled = false;
    plate.layer(mesh);
  }
}
