import * as THREE from "three";
import { uniforms, U } from "../core/uniforms";
import { GLSL_COMMON } from "../shaders/chunks";
import { PW, PH } from "../util";
import { ART } from "../data/art";
import type { PlateBase } from "../plates/PlateBase";

/**
 * Compositor — the custom lean compositor (TECHNICAL_PLAN §7). Four passes,
 * hand-written (no EffectComposer):
 *   plate render(s) → bright-pass (¼ res) → separable gaussian ×N → final quad.
 * The final quad runs the art-direction chain in order:
 *   dissolve mix → +bloom (rationed light) → veiling glare → grade(uExposure)
 *   → elliptical vignette → film grain (12 fps steps) → triangular dither
 *   → letterbox mask (pure #000 bars last — bars stay clean).
 */
export class Compositor {
  renderer: THREE.WebGLRenderer;
  private rtA!: THREE.WebGLRenderTarget;
  private rtB!: THREE.WebGLRenderTarget;
  private bright!: THREE.WebGLRenderTarget;
  private blurA!: THREE.WebGLRenderTarget;
  private blurB!: THREE.WebGLRenderTarget;

  private screen = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private tri: THREE.Mesh;
  private quad: THREE.Mesh;

  private matBright: THREE.ShaderMaterial;
  private matBlur: THREE.ShaderMaterial;
  private matFinal: THREE.ShaderMaterial;

  private pwDev = 0;
  private phDev = 0;
  private winDevW = 0;
  private winDevH = 0;
  private blurRes = 1;
  private picRect = { x: 0, y: 0, w: 1, h: 1 }; // device px of the picture

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;

    // full-viewport triangle (covers any aspect; uv linearly spans the view)
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    tg.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.tri = new THREE.Mesh(tg, this.placeholderMat());
    this.screen.add(this.tri);

    // picture-shaped quad used by blur passes (aspect from RT)
    this.quad = this.tri;
    void this.quad;

    this.matBright = this.brightMaterial();
    this.matBlur = this.blurMaterial();
    this.matFinal = this.finalMaterial();
  }

  private placeholderMat() {
    return new THREE.MeshBasicMaterial({ color: 0x000000 });
  }

  private makeRT(w: number, h: number): THREE.WebGLRenderTarget {
    const rt = new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    });
    rt.texture.generateMipmaps = false;
    return rt;
  }

  private byteRT: THREE.WebGLRenderTarget | null = null;

  /** render the final pass into an RGBA8 RT and read it back (review stills) */
  grabFrame(): { w: number; h: number; data: Uint8Array } {
    const w = this.winDevW;
    const h = this.winDevH;
    if (!this.byteRT || this.byteRT.width !== w || this.byteRT.height !== h) {
      this.byteRT?.dispose();
      this.byteRT = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false,
      });
      this.byteRT.texture.generateMipmaps = false;
    }
    const r = this.renderer;
    r.setRenderTarget(this.byteRT);
    r.setViewport(0, 0, w, h);
    r.setScissorTest(false);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    // rasterise exactly as on screen (picture rect; bars stay clean black)
    const pr = this.picRect;
    r.setViewport(pr.x, pr.y, pr.w, pr.h);
    r.setScissor(pr.x, pr.y, pr.w, pr.h);
    r.setScissorTest(true);
    this.tri.material = this.matFinal;
    r.render(this.screen, this.cam);
    const data = new Uint8Array(w * h * 4);
    // SwiftShader fails on very large single readbacks — read in tiles
    const T = 64;
    for (let y0 = 0; y0 < h; y0 += T) {
      const th = Math.min(T, h - y0);
      for (let x0 = 0; x0 < w; x0 += T) {
        const tw = Math.min(T, w - x0);
        const tmp = new Uint8Array(tw * th * 4);
        r.readRenderTargetPixels(this.byteRT, x0, y0, tw, th, tmp);
        for (let yy = 0; yy < th; yy++) {
          const dstOff = (y0 + yy) * w * 4 + x0 * 4;
          data.set(tmp.subarray(yy * tw * 4, (yy + 1) * tw * 4), dstOff);
        }
      }
    }
    return { w, h, data };
  }

  /** recreate targets when device sizes change (window resize / tier change) */
  ensure(pwDev: number, phDev: number, winW: number, winH: number, blurRes: number) {
    if (
      pwDev === this.pwDev &&
      phDev === this.phDev &&
      winW === this.winDevW &&
      winH === this.winDevH &&
      blurRes === this.blurRes
    ) {
      return;
    }
    this.pwDev = pwDev;
    this.phDev = phDev;
    this.winDevW = winW;
    this.winDevH = winH;
    this.blurRes = blurRes;
    const bw = Math.max(16, Math.round((pwDev / 4) * blurRes));
    const bh = Math.max(16, Math.round((phDev / 4) * blurRes));
    this.disposeRTs();
    this.rtA = this.makeRT(pwDev, phDev);
    this.rtB = this.makeRT(pwDev, phDev);
    this.bright = this.makeRT(bw, bh);
    this.blurA = this.makeRT(bw, bh);
    this.blurB = this.makeRT(bw, bh);
    this.matBright.uniforms.uMapA = { value: this.rtA.texture };
    this.matBright.uniforms.uMapB = { value: this.rtB.texture };
    this.matFinal.uniforms.uPlateA = { value: this.rtA.texture };
    this.matFinal.uniforms.uPlateB = { value: this.rtB.texture };
    this.matFinal.uniforms.uBloom = { value: this.blurB.texture };
  }

  private disposeRTs() {
    for (const rt of [this.rtA, this.rtB, this.bright, this.blurA, this.blurB]) {
      if (rt) rt.dispose();
    }
  }

  // ------------------------------------------------------------------ passes
  private brightMaterial(): THREE.ShaderMaterial {
    const frag = `${GLSL_COMMON}
      uniform sampler2D uMapA;
      uniform sampler2D uMapB;
      uniform float uThresh;
      varying vec2 vUv;
      void main(){
        vec3 a = texture2D(uMapA, vUv).rgb;
        vec3 b = texture2D(uMapB, vUv).rgb;
        vec3 col = mix(a, b, uDissolve);
        float l = max(col.r, max(col.g, col.b));
        // soft-knee bright pass — rationed light only
        float k = smoothstep(uThresh, uThresh + 0.16, l);
        gl_FragColor = vec4(col * k, 1.0);
      }`;
    return new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: frag,
      uniforms: uniforms({
        uMapA: { value: null },
        uMapB: { value: null },
        uDissolve: U.uDissolve,
        uThresh: { value: ART.post.bloom.threshold },
      }) as Record<string, THREE.IUniform>,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  private blurMaterial(): THREE.ShaderMaterial {
    const frag = `${GLSL_COMMON}
      uniform sampler2D uMap;
      uniform vec2 uDir;
      uniform vec2 uTexel;
      uniform float uSigma;
      varying vec2 vUv;
      void main(){
        vec2 off = uDir * uTexel * uSigma;
        vec4 sum = texture2D(uMap, vUv) * 0.227027;
        sum += texture2D(uMap, vUv + off * 1.3846) * 0.3162162 * 2.0;
        sum += texture2D(uMap, vUv + off * 3.2307) * 0.0702703 * 2.0;
        gl_FragColor = vec4(sum.rgb, 1.0);
      }`;
    return new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: frag,
      uniforms: uniforms({
        uMap: { value: null },
        uDir: { value: new THREE.Vector2(1, 0) },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uSigma: { value: 1 },
      }) as Record<string, THREE.IUniform>,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  private finalMaterial(): THREE.ShaderMaterial {
    const p = ART.post;
    const frag = `${GLSL_COMMON}
      uniform sampler2D uPlateA;
      uniform sampler2D uPlateB;
      uniform sampler2D uBloom;
      uniform vec4 uPic; // picture rect in viewport uv: x y w h
      uniform vec2 uRes;
      uniform float uBloomGain;
      uniform float uGlare;
      uniform vec3 uGlareCol;
      uniform float uVigIn, uVigOut, uVigStr;
      uniform float uGrainAmp, uDitherAmp;
      uniform vec3 uBlackRef;
      varying vec2 vUv;
      float hash11f(float n){ return fract(sin(n) * 43758.5453123); }
      void main(){
        vec2 wuv = vUv;
        vec2 puv = (wuv - uPic.xy) / uPic.zw;
        vec4 outCol = vec4(0.0, 0.0, 0.0, 1.0);
        // pure-black bars: nothing inside them — no grain, no glow
        if (puv.x >= 0.0 && puv.x <= 1.0 && puv.y >= 0.0 && puv.y <= 1.0) {
          vec3 a = texture2D(uPlateA, puv).rgb;
          vec3 b = texture2D(uPlateB, puv).rgb;
          float di = smoothstep(0.0, 1.0, uDissolve);
          vec3 col = mix(a, b, di);

          // + bloom — additive, rationed (radius capped by the small kernel)
          col += texture2D(uBloom, puv).rgb * uBloomGain;

          // + veiling glare — bottom-anchored black lift (wet-plate scatter)
          float py = puv.y * 810.0;
          float g = pow(1.0 - puv.y, 2.6);
          col += uGlareCol * (g * uGlare * (0.55 + 0.45 * (1.0 - di)) * uExposure);

          // × grade: developing-print exposure lift (monotonic, never clips hard)
          col = 1.0 - pow(1.0 - clamp(col, 0.0, 1.0), vec3(uExposure));

          // × elliptical vignette — soft porthole falloff, corners strongest
          vec2 cv = vec2(puv.x - 0.5, (puv.y - 0.5) * 2.37);
          float r = length(cv / vec2(0.58, 0.34));
          float vig = smoothstep(uVigIn, uVigOut, r);
          col *= 1.0 - vig * uVigStr;

          // + film grain — fine paper tooth, 12 fps steps, luminance-weighted
          float n = hash11f(gl_FragCoord.x * 3.1 + gl_FragCoord.y * 7.7 + uGrainSeed * 13.1) - 0.5;
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          col += n * uGrainAmp * (0.25 + 0.75 * lum);

          // + triangular dither — the near-black sky must not band
          float h1 = hash11f(gl_FragCoord.x * 91.7 + gl_FragCoord.y * 47.3 + uGrainSeed * 7.0);
          float h2 = hash11f(gl_FragCoord.y * 29.9 + gl_FragCoord.x * 13.7 + uGrainSeed * 11.0);
          col += (h1 + h2 - 1.0) * uDitherAmp;

          // the warm white is the entire warm budget — never digital white
          col = clamp(col, 0.0, 0.99);

          // × master fade (fade from black / out)
          col *= uFade;
          outCol = vec4(col, 1.0);
        }
        gl_FragColor = outCol;
      }`;
    return new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: frag,
      uniforms: uniforms({
        uPlateA: { value: null },
        uPlateB: { value: null },
        uBloom: { value: null },
        uDissolve: U.uDissolve,
        uPic: { value: new THREE.Vector4(0, 0, 1, 1) },
        uRes: { value: new THREE.Vector2(1, 1) },
        uBloomGain: { value: p.bloom.gain },
        uGlare: { value: p.glare.strength },
        uGlareCol: { value: new THREE.Vector3(0.78, 0.8, 0.84) },
        uVigIn: { value: p.vignette.inner },
        uVigOut: { value: p.vignette.outer },
        uVigStr: { value: p.vignette.strength },
        uGrainAmp: { value: (p.grain.amp / 255) * 0.9 },
        uDitherAmp: { value: p.dither / 255 },
        uFade: U.uFade,
        uGrainSeed: U.uGrainSeed,
        uBlackRef: { value: new THREE.Vector3(0, 0, 0) },
      }) as Record<string, THREE.IUniform>,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  /** read-back helper for review: mean RGBA of small probes from the plate RTs */
  samplePlates(): { a: number[][]; b: number[][]; bright: number[] } {
    const halfToByte = (bits: number): number => {
      const exp = (bits >> 10) & 0x1f;
      const mant = bits & 0x3ff;
      const v = exp === 0 ? (mant / 1024) * 2 ** -14 : (1 + mant / 1024) * 2 ** (exp - 15);
      return Math.round(Math.min(1, v) * 255);
    };
    const probes = (rt: THREE.WebGLRenderTarget): number[][] => {
      const out: number[][] = [];
      const pts: [number, number][] = [
        [0.5, 0.5],
        [0.5, 0.1],
        [0.2, 0.8],
        [0.9, 0.3],
      ];
      for (const [nx, ny] of pts) {
        const x = Math.floor(rt.width * nx);
        const y = Math.floor(rt.height * ny);
        const buf = new Uint16Array(4);
        this.renderer.readRenderTargetPixels(rt, x, y, 1, 1, buf as unknown as Uint8Array);
        out.push([halfToByte(buf[0]), halfToByte(buf[1]), halfToByte(buf[2]), Math.round(buf[3] > 0 ? 255 : 0)]);
      }
      return out;
    };
    return {
      a: probes(this.rtA),
      b: probes(this.rtB),
      bright: probes(this.bright).map((p) => p[0]),
    };
  }

  // -------------------------------------------------------------- main entry
  /** debug: draw only the final composite to the screen (for read-back checks) */
  debugFinal() {
    const r = this.renderer;
    r.setRenderTarget(null);
    r.setViewport(0, 0, this.winDevW, this.winDevH);
    r.setScissorTest(false);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    this.tri.material = this.matFinal;
    r.render(this.screen, this.cam);
  }

  render(
    plateI: PlateBase | null,
    plateII: PlateBase | null,
    weightI: number,
    weightII: number
  ) {
    const r = this.renderer;
    const rtA = this.rtA;
    const rtB = this.rtB;

    if (plateI && weightI > 1e-4) {
      r.setRenderTarget(rtA);
      r.setViewport(0, 0, this.pwDev, this.phDev);
      r.setScissor(0, 0, this.pwDev, this.phDev);
      r.setScissorTest(true);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      r.render(plateI.scene, plateI.camera);
    }
    if (plateII && weightII > 1e-4) {
      r.setRenderTarget(rtB);
      r.setViewport(0, 0, this.pwDev, this.phDev);
      r.setScissor(0, 0, this.pwDev, this.phDev);
      r.setScissorTest(true);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      r.render(plateII.scene, plateII.camera);
    }

    // bright pass → blur
    const bw = this.bright.width;
    const bh = this.bright.height;
    const run = (target: THREE.WebGLRenderTarget, mat: THREE.ShaderMaterial, srcTex: THREE.Texture, dir: THREE.Vector2, sigma: number) => {
      r.setRenderTarget(target);
      r.setViewport(0, 0, target.width, target.height);
      r.setScissorTest(false);
      mat.uniforms.uMap.value = srcTex;
      (mat.uniforms.uDir.value as THREE.Vector2).copy(dir);
      (mat.uniforms.uTexel.value as THREE.Vector2).set(1 / target.width, 1 / target.height);
      mat.uniforms.uSigma.value = sigma;
      this.tri.material = mat;
      r.render(this.screen, this.cam);
    };

    if (weightI + weightII > 1e-4) {
      r.setRenderTarget(this.bright);
      r.setViewport(0, 0, bw, bh);
      r.setScissorTest(false);
      this.tri.material = this.matBright;
      r.render(this.screen, this.cam);

      const iters = U.uTier.value >= 3 ? 0 : U.uTier.value <= 1 ? 2 : 1;
      let src: THREE.Texture = this.bright.texture;
      const tx = new THREE.Vector2(1, 0);
      const ty = new THREE.Vector2(0, 1);
      const sigma = 0.9;
      for (let i = 0; i < iters; i++) {
        run(this.blurA, this.matBlur, src, tx, sigma);
        run(this.blurB, this.matBlur, this.blurA.texture, ty, sigma);
        src = this.blurB.texture;
      }
      if (iters === 0) src = this.bright.texture;
      this.matFinal.uniforms.uBloom.value = src;
      this.matFinal.uniforms.uBloomGain.value = U.uTier.value >= 3 ? 0 : ART.post.bloom.gain;
    } else {
      this.matFinal.uniforms.uBloomGain.value = 0;
    }

    // final composite → screen. Whole window clears to pure black first, then
    // the plate rasterises only inside the exact 2.35:1 picture rect (the DOM
    // letterbox bars cover the rest — bars stay clean by construction).
    r.setRenderTarget(null);
    r.setViewport(0, 0, this.winDevW, this.winDevH);
    r.setScissorTest(false);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    const pr = this.picRect;
    r.setViewport(pr.x, pr.y, pr.w, pr.h);
    r.setScissor(pr.x, pr.y, pr.w, pr.h);
    r.setScissorTest(true);
    this.tri.material = this.matFinal;
    r.render(this.screen, this.cam);
  }

  /** picture rect in *device px* for the final pass */
  setPictureRect(xPix: number, yPix: number, wPix: number, hPix: number) {
    this.picRect = { x: xPix, y: yPix, w: wPix, h: hPix };
  }
}
