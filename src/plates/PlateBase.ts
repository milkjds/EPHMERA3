import * as THREE from "three";
import { PW, PH } from "../util";

/**
 * PlateBase — a locked-lens plate rig (TECH §2.2/§3). One camera that is never
 * touched after boot; one rig group that carries the single plate drift. Every
 * celestial layer is a child of the rig, so there is structurally *one plate,
 * one speed, zero parallax* (Bible §0 law 2): the only spatial input is the
 * drift accumulator, integrated at a constant rate. No easing exists anywhere.
 */
export class PlateBase {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  rig = new THREE.Group();
  /** layers pushed back→front; renderOrder = index*10 (draw order by depth) */
  layerCount = 0;
  protected readonly camD: number;
  private driftApplied = -1;

  constructor(camD: number) {
    this.camD = camD;
    const fovY = (2 * Math.atan(PH / 2 / camD) * 180) / Math.PI;
    this.camera = new THREE.PerspectiveCamera(fovY, PW / PH, camD * 0.02, camD * 3.4);
    this.camera.position.set(0, 0, camD);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.rig);
  }

  /** add a layer; call in back→front order */
  layer<T extends THREE.Object3D>(obj: T): T {
    obj.renderOrder = this.layerCount * 10;
    this.rig.add(obj);
    this.layerCount++;
    return obj;
  }

  /** constant-velocity drift integration: nothing else may translate layers */
  setDrift(driftRpx: number) {
    if (driftRpx === this.driftApplied) return;
    this.driftApplied = driftRpx;
    this.rig.position.x = -driftRpx;
  }

  protected material(opts: {
    frag: string;
    uniforms?: Record<string, { value: unknown }>;
    transparent?: boolean;
    additive?: boolean;
    tone?: boolean;
  }): THREE.ShaderMaterial {
    const m = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        varying vec2 vW;
        void main(){
          vUv = uv;
          vW = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: opts.frag,
      uniforms: opts.uniforms as Record<string, THREE.IUniform>,
      transparent: opts.transparent ?? false,
      depthTest: false,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: false,
    });
    return m;
  }
}

/** Build a merged BufferGeometry from world-space quads (each 4 verts + uv). */
export interface QuadData {
  positions: number[];
  uvs: number[];
}

export function quadAt(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  z = 0
): QuadData {
  return {
    positions: [
      cx - hw, cy - hh, z,
      cx + hw, cy - hh, z,
      cx - hw, cy + hh, z,
      cx + hw, cy + hh, z,
    ],
    uvs: [0, 1, 1, 1, 0, 0, 1, 0],
  };
}

export function makeGeometry(q: QuadData, extra: Record<string, number[] | Float32Array> = {}): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(q.positions), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(q.uvs), 2));
  for (const k of Object.keys(extra)) {
    const a = extra[k];
    const arr = ArrayBuffer.isView(a) ? (a as Float32Array) : new Float32Array(a as number[]);
    g.setAttribute(k, new THREE.BufferAttribute(arr, 1));
  }
  const idx = [0, 1, 2, 2, 1, 3];
  g.setIndex(idx);
  return g;
}

export function quadGeometryWorld(x0: number, y0: number, x1: number, y1: number, z = 0): QuadData {
  return {
    positions: [x0, y0, z, x1, y0, z, x0, y1, z, x1, y1, z],
    uvs: [0, 0, 1, 0, 0, 1, 1, 1],
  };
}
