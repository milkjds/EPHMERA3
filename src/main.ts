import "./style.css";
// fonts (self-hosted through @fontsource — crisp type with no runtime fetch)
import "@fontsource/playfair-display/700.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/cinzel/500.css";

import * as THREE from "three";
import { ART } from "./data/art";
import { U } from "./core/uniforms";
import { Clock } from "./core/Clock";
import { CursorLight } from "./core/CursorLight";
import { Scrub } from "./core/Scrub";
import { QualityMonitor } from "./core/QualityMonitor";
import { StageManager } from "./stage/StageManager";
import { TitleCard, preloadFonts } from "./stage/TitleCard";
import { Captions } from "./stage/Captions";
import { PlateI } from "./plates/PlateI";
import { PlateII } from "./plates/PlateII";
import { Compositor } from "./fx/Compositor";

/* ----------------------------------------------------------------- boot --- */

function mergeDeep(target: any, src: any) {
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      mergeDeep(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

function parseParams(): { t?: number; drift?: number; reduced?: boolean; frames?: number; grab?: number; raw?: boolean } {
  const q = new URLSearchParams(location.search);
  const out: { t?: number; drift?: number; reduced?: boolean; frames?: number; grab?: number; raw?: boolean } = {};
  if (q.has("t")) out.t = parseFloat(q.get("t")!);
  if (q.has("v")) out.drift = parseFloat(q.get("v")!);
  if (q.has("m")) out.reduced = q.get("m") === "1";
  if (q.has("f")) out.frames = parseInt(q.get("f")!, 10);
  if (q.has("grab")) out.grab = parseInt(q.get("grab")!, 10);
  if (q.has("raw")) out.raw = true;
  const k = q.get("k");
  if (k) {
    try {
      mergeDeep(ART, JSON.parse(decodeURIComponent(k)));
    } catch {
      /* malformed tuning hash ignored */
    }
  }
  return out;
}

async function boot() {
  const status = document.getElementById("boot-status");
  const errLog: string[] = [];
  const logErr = (msg: string) => {
    const clean = String(msg).replace(/[\r\n]+/g, " ").slice(0, 240);
    errLog.push(clean);
    if (errLog.length > 8) errLog.shift();
    if (status) status.textContent = `E[${errLog.length}]: ${clean}`;
  };
  // capture console errors/warnings (dev diagnostics — also read via ?diag)
  const origErr = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...a) => {
    logErr(a.map((x) => (x instanceof Error ? x.message : String(x))).join(" "));
    origErr(...a);
  };
  console.warn = (...a) => {
    const s = a.map((x) => (x instanceof Error ? x.message : String(x))).join(" ");
    if (/Shader|WebGL|uniform/i.test(s)) logErr(s);
    origWarn(...a);
  };
  window.addEventListener("error", (e) => logErr(e.message || "error"));
  window.addEventListener("unhandledrejection", (e) => logErr("promise: " + String(e.reason)));

  const say = (s: string) => {
    if (status) status.textContent = s;
  };
  say("boot…");

  const params = parseParams();
  const reducedMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reducedInitial = params.reduced ?? reducedMedia.matches;

  // ---- stage (2.35:1 picture) ----
  const stage = new StageManager();
  stage.start();
  document.documentElement.classList.add("booted"); // CSS sky until GL is live

  // ---- renderer ----
  const gl = document.getElementById("gl") as HTMLCanvasElement | null;
  if (!gl) throw new Error("canvas missing");
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: gl,
      antialias: false,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
    });
  } catch (e) {
    document.documentElement.classList.add("no-webgl");
    say("WebGL unavailable");
    console.error(e);
    return;
  }
  renderer.setPixelRatio(1);
  renderer.autoClear = true;

  // ---- master systems ----
  const clock = new Clock({ total: ART.times.fadeOutEnd + 4 });
  clock.reducedMode(reducedInitial);
  const cursor = new CursorLight();
  const scrub = new Scrub(clock);
  const quality = new QualityMonitor();
  const captions = new Captions();
  const title = new TitleCard(stage);

  const plateI = new PlateI();
  const plateII = new PlateII();
  // geometry is authored quad winding — make all plate materials double-sided
  const doubleSide = (scene: THREE.Scene) =>
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of ms) m.side = THREE.DoubleSide;
      }
    });
  doubleSide(plateI.scene);
  doubleSide(plateII.scene);
  const compositor = new Compositor(renderer);

  // replay: caption-styled control in the bar
  captions.onReplay = () => {
    clock.replay();
    title.reset();
    captions.reset();
  };

  // ---- fonts → title build (letters are rasterised) ----
  await preloadFonts();
  title.build();

  // interaction
  cursor; // pointer handlers attached below
  gl.addEventListener("pointermove", (e) => cursor.onMove(e.clientX, e.clientY));
  gl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") cursor.onDown();
  });
  window.addEventListener("pointerup", () => cursor.onUp());
  gl.addEventListener("pointerleave", () => {
    cursor.gain = 0;
  });
  scrub.attach();

  // reduced motion live switch
  reducedMedia.addEventListener?.("change", (ev) => clock.reducedMode(ev.matches));
  if (params.reduced !== undefined) clock.reducedMode(params.reduced);

  // drift override (dev)
  const driftV = params.drift ?? ART.motion.driftRpx;

  // ---- resize handling ----
  let titleTimer = 0;
  stage.onResize = () => {
    window.clearTimeout(titleTimer);
    titleTimer = window.setTimeout(() => title.build(), 240);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) lastNow = performance.now();
  });

  // ---- dev / review hooks ----
  const dev: Record<string, unknown> = {
    art: ART,
    U,
    clock,
    stage,
    quality,
    errors: errLog,
    shot: null,
    renderer,
    plateI,
    plateII,
    compositor,
    probe: () => {
      const out: unknown[] = [];
      const read = (x: number, y: number) => {
        const gl2 = renderer.getContext() as WebGL2RenderingContext;
        const b = new Uint8Array(4);
        gl2.readPixels(x, y, 1, 1, gl2.RGBA, gl2.UNSIGNED_BYTE, b);
        return Array.from(b);
      };
      const w = renderer.domElement.width;
      const h = renderer.domElement.height;
      for (const [sx, sy, name] of [
        [0.5, 0.12, "sky"],
        [0.5, 0.5, "center"],
        [0.4, 0.8, "planet-face"],
        [0.9, 0.5, "right"],
      ] as const) {
        out.push([name, read(Math.floor(sx * w), Math.floor(sy * h))]);
      }
      return out;
    },
    // browser-side ASCII luminance review of the last shot (this environment's
    // PNG screenshots cannot be decoded off-page)
    review: async () => {
      const s = dev.shot as string | null;
      if (!s || s.startsWith("GRAB")) return "no shot: " + s;
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = () => res(null);
        img.onerror = () => rej(new Error("img"));
        img.src = s;
      });
      const cv = document.createElement("canvas");
      cv.width = img.width;
      cv.height = img.height;
      const c = cv.getContext("2d");
      if (!c) return "no 2d";
      c.drawImage(img, 0, 0);
      const d = c.getImageData(0, 0, cv.width, cv.height).data;
      const ramp = " .:-=+*#%@";
      const cols = 104;
      const rows = 30;
      const lines: string[] = [];
      let sum = 0;
      for (let ry = 0; ry < rows; ry++) {
        let line = "";
        for (let rx = 0; rx < cols; rx++) {
          const x = Math.min(cv.width - 1, Math.floor(((rx + 0.5) / cols) * cv.width));
          const y = Math.min(cv.height - 1, Math.floor(((ry + 0.5) / rows) * cv.height));
          const i = (y * cv.width + x) * 4;
          const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          sum += l;
          line += ramp[Math.min(ramp.length - 1, Math.floor((l / 255) * ramp.length))];
        }
        lines.push(line);
      }
      return `mean ${(sum / (cols * rows)).toFixed(0)} (${cv.width}x${cv.height}) t=${clock.t.toFixed(2)}\n${lines.join("\n")}`;
    },
    // local sub-region ASCII map (fractions of the shot)
    map: async (x0: number, y0: number, x1: number, y1: number, cols = 72, rows = 20) => {
      const s = dev.shot as string | null;
      if (!s || s.startsWith("GRAB")) return "no shot";
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = () => res(null);
        img.onerror = () => rej(new Error("img"));
        img.src = s;
      });
      const cv = document.createElement("canvas");
      cv.width = img.width;
      cv.height = img.height;
      const c = cv.getContext("2d");
      if (!c) return "no 2d";
      c.drawImage(img, 0, 0);
      const d = c.getImageData(0, 0, cv.width, cv.height).data;
      const ramp = " .:-=+*#%@";
      const lines: string[] = [];
      for (let ry = 0; ry < rows; ry++) {
        let line = "";
        for (let rx = 0; rx < cols; rx++) {
          const fx = x0 + ((x1 - x0) * (rx + 0.5)) / cols;
          const fy = y0 + ((y1 - y0) * (ry + 0.5)) / rows;
          const x = Math.min(cv.width - 1, Math.floor(fx * cv.width));
          const y = Math.min(cv.height - 1, Math.floor(fy * cv.height));
          const i = (y * cv.width + x) * 4;
          const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          line += ramp[Math.min(ramp.length - 1, Math.floor((l / 255) * ramp.length))];
        }
        lines.push(line);
      }
      return lines.join("\n");
    },
    seek: (t: number) => clock.seek(t),
    pause: (v: boolean) => clock.pause(v),
    replay: () => captions.onReplay?.(),
  };
  (window as any).__EPH = dev;

  // grab the WebGL canvas as a PNG (sync post-render readback for review stills)
  let grabCanvas: HTMLCanvasElement | null = null;  const doGrab = () => {
    try {
      if (!grabCanvas) grabCanvas = document.createElement("canvas");
      const c2 = grabCanvas.getContext("2d");
      const raw = compositor.grabFrame();
      const { w, h, data } = raw;
      grabCanvas.width = w;
      grabCanvas.height = h;
      if (c2) {
        const img = c2.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          const src = (h - 1 - y) * w * 4;
          img.data.set(data.subarray(src, src + w * 4), y * w * 4);
        }
        c2.putImageData(img, 0, 0);
        dev.shot = grabCanvas.toDataURL("image/png");
        dev.shotW = w;
        dev.shotH = h;
      }
    } catch (e) {
      dev.shot = "GRAB_ERROR " + String(e);
    }
  };

  // resolve an initial seek before the loop starts
  if (params.t !== undefined) clock.seek(params.t);

  // time base
  let lastNow = performance.now();
  let driftPx = 0;
  let appliedTier = -1;
  let pixelScale = 0;
  let picDev = { w: 0, h: 0 };
  let frame = 0;
  document.documentElement.classList.add("gl-ready");

  // ---- per-frame parameter evaluation (the master timeline) ----------------
  const applyFrame = (t: number, dt: number, now: number) => {
    const T = ART.times;

    // plate drift — constant velocity, single accumulator (Bible law 2)
    const frozen = clock.reduced || clock.paused || t > T.fadeOutEnd;
    if (!frozen && t > 0.4) driftPx += driftV * dt;
    U.uDrift.value = driftPx;
    plateI.setDrift(driftPx);
    plateII.setDrift(driftPx);

    // dissolve (the only transition — 1.2 s cross-dissolve, smoothstepped)
    const dr = (t - T.dissolveStart) / (T.dissolveEnd - T.dissolveStart);
    U.uDissolve.value = Math.min(1, Math.max(0, dr * dr * (3 - 2 * dr)));

    // developing-print exposure: base ramp + hold-earned boost (monotonic)
    const ramp = (t - T.exposureStart) / (T.exposureEnd - T.exposureStart);
    const baseE = T.exposureA + (T.exposureB - T.exposureA) * Math.min(1, Math.max(0, ramp));
    const held = cursor.holdBoost * (T.exposureCapHold - T.exposureB);
    const exp = Math.min(T.exposureCapHold, baseE + held);
    U.uExposure.value = exp;

    // Plate II fog crescendo (5–10 s); reduced motion: crossfade only
    let rise = (t - T.fogStart) / (T.fogEnd - T.fogStart);
    rise = Math.min(1, Math.max(0, rise));
    if (clock.reduced) rise = U.uDissolve.value;
    U.uRise.value = rise;

    // master fade (in at 0–2.5 s, out at 40–45 s)
    let fade = 1;
    if (t < T.fadeInEnd) fade = Math.max(0, t / T.fadeInEnd);
    else if (t > T.fadeOutStart) fade = Math.max(0, 1 - (t - T.fadeOutStart) / (T.fadeOutEnd - T.fadeOutStart));
    U.uFade.value = fade;

    // film grain steps at 12 fps
    U.uGrainSeed.value = Math.floor(now * 12) / 12;
    U.uPxPerRpx.value = picDev.w / 1920;

    // DOM: title arrivals / credit / lyric / replay
    title.update(t, exp);
    captions.update(t);
    plateII.update(clock.visual, clock.reduced);

    // quality tier → pixel scale / RT resize
    if (quality.state.tier !== appliedTier) {
      appliedTier = quality.state.tier;
      plateI.setTier(appliedTier);
      plateII.setTier(appliedTier);
      applyPixelScale();
    }
  };

  const applyPixelScale = () => {
    const tier = Math.max(0, appliedTier);
    const raw = window.devicePixelRatio || 1;
    const ps = QualityMonitor.dpr(tier, raw) * (tier >= 3 ? 0.85 : 1);
    if (ps === pixelScale && picDev.w > 0) return;
    pixelScale = ps;
    renderer.setPixelRatio(ps);
    renderer.setSize(Math.round(window.innerWidth), Math.round(window.innerHeight), false);
    const w = Math.max(1, Math.round(stage.rect.w * ps));
    const h = Math.max(1, Math.round(stage.rect.h * ps));
    picDev = { w, h };
    compositor.ensure(
      w,
      h,
      Math.round(window.innerWidth * ps),
      Math.round(window.innerHeight * ps),
      tier >= 2 ? 0.75 : 1
    );
    compositor.setPictureRect(
      Math.round(stage.rect.x * ps),
      Math.round(stage.rect.y * ps),
      Math.round(stage.rect.w * ps),
      Math.round(stage.rect.h * ps)
    );
  };

  // ---- the frame loop --------------------------------------------------------
  const loop = (now: number) => {
    rafId = requestAnimationFrame(loop);
    if (document.hidden) {
      lastNow = now;
      return;
    }
    const dt = (now - lastNow) / 1000;
    lastNow = now;
    if (!clock.paused) {
      clock.update(dt);
    }
    cursor.update(dt);
    quality.update(dt, now / 1000);
    applyPixelScale();

    const t = clock.t;
    applyFrame(t, dt, now);

    // weights for the dissolve window
    const dw = U.uDissolve.value;
    const wI = 1 - dw;
    const wII = dw;
    if (params.raw) {
      // debug: plate scene straight to the canvas (no post chain)
      renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height);
      renderer.setScissorTest(false);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, false);
      renderer.render(plateI.scene, plateI.camera);
    } else {
      compositor.render(plateI, plateII, wI, wII);
    }

    frame++;
    if (params.grab && frame === params.grab) {
      doGrab();
      cancelAnimationFrame(rafId);
      return;
    }
    if (frame % 30 === 0) {
      const fps = Math.round(1 / Math.max(1e-4, quality.state.frameMs / 1000));
      say(`EPHEMERA · ${fps} fps · tier ${appliedTier} · t ${t.toFixed(1)}s · ${picDev.w}×${picDev.h}`);
    }
    if (params.frames && frame >= params.frames) {
      cancelAnimationFrame(rafId);
    }
  };
  let rafId = 0;

  applyPixelScale();
  requestAnimationFrame(loop);
}

boot().catch((e) => {
  console.error(e);
  const status = document.getElementById("boot-status");
  if (status) status.textContent = "boot error: " + (e && e.message ? e.message : e);
});
