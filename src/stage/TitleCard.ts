import { ART } from "../data/art";
import { PW, PH } from "../util";
import type { StageManager } from "./StageManager";

const TITLE_FONT = '"Playfair Display", Didot, "Bodoni MT", "Times New Roman", serif';

export async function preloadFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('700 100px "Playfair Display"'),
      document.fonts.load('500 italic 40px "Cormorant Garamond"'),
      document.fonts.load('500 40px "Cormorant Garamond"'),
      document.fonts.load('500 60px "Cinzel"'),
      document.fonts.ready,
    ]);
  } catch {
    /* fonts are progressive enhancement; fallback serifs remain */
  }
}

function measureCap(ctx: CanvasRenderingContext2D, sizePx: number): number {
  ctx.font = `700 ${sizePx}px ${TITLE_FONT}`;
  const m = ctx.measureText("E");
  return Math.abs(m.actualBoundingBoxAscent);
}

const IVORY = "#F1ECE2";

function sparkleSVG(sizePx: number): string {
  const s = sizePx;
  const h = s / 2;
  const t = s * 0.16; // flare thickness taper
  const core = s * 0.18;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">
  <g fill="#F4F1EA">
    <ellipse cx="${h}" cy="${h}" rx="${t}" ry="${h * 0.55}" />
    <ellipse cx="${h}" cy="${h}" rx="${h * 0.55}" ry="${t}" />
    <circle cx="${h}" cy="${h}" r="${core}" />
  </g></svg>`;
}

interface LetterDom {
  el: HTMLElement;
  target: number;
  shown: boolean;
  tArrive: number;
}

/**
 * TitleCard — the EPHEMERA scatter (Bible §2.1). Letters are rasterised to
 * crisp canvases with exact cap heights and a soft backlit-vellum halo, then
 * positioned absolutely on the undulating baseline with irregular tracking.
 * Opacity-only arrivals in the authored scatter order. Two engraved sparkles
 * pinned to letterforms (type as constellation).
 */
export class TitleCard {
  private stage: StageManager;
  private root: HTMLElement;
  private letters: LetterDom[] = [];
  private card: HTMLElement;
  private credit: HTMLElement;
  private built = false;
  private rasterScale = 2;

  constructor(stage: StageManager) {
    this.stage = stage;
    const card = document.getElementById("title-card");
    const credit = document.getElementById("credit");
    if (!card || !credit) throw new Error("title DOM missing");
    this.card = card;
    this.credit = credit;
    this.root = card;
  }

  private clear() {
    this.root.replaceChildren();
    this.letters = [];
  }

  /**
   * Rebuild every letter from the authored table. Sizes & positions are derived
   * from current picture scale; call again on resize (raster stays crisp).
   */
  build() {
    this.clear();
    this.built = true;
    const scale = this.stage.rect.scale; // css px per rpx
    const spec = ART.title;
    const rs = this.rasterScale;
    const meanLineRpx = spec.meanLinePH * PH;
    const targetRpx = spec.blockWidthPW * PW; // 39% PW — the modest envelope

    const cv = document.createElement("canvas");
    const ctx = cv.getContext("2d");
    if (!ctx) throw new Error("no 2d");

    interface Measured {
      char: string;
      wRpx: number; // glyph advance at target cap
      capRpx: number;
      base: number; // baseline offset rpx (+ low)
      track: number; // gap rpx
      arrive: number;
      opacity: number;
    }
    const measured: Measured[] = spec.letters.map((lt) => {
      const capCss = lt.capH * scale;
      const probe = measureCap(ctx, 200);
      const fsCss = (capCss * 200) / probe;
      ctx.font = `700 ${fsCss * 4}px ${TITLE_FONT}`;
      const w = ctx.measureText(lt.ch).width / 4;
      return {
        char: lt.ch,
        wRpx: w / scale,
        capRpx: lt.capH,
        base: lt.base,
        track: lt.track * lt.capH,
        arrive: ART.times.titleStart + lt.arrive,
        opacity: lt.opacity,
      };
    });

    // ---- fit: irregular tracking by design; whole block = 39% PW ----
    const sumW = measured.reduce((a, m) => a + m.wRpx, 0);
    const sumGap = measured.reduce((a, m) => a + m.track, 0);
    let f = 1; // uniform block scale
    let gapScale = 1;
    if (sumW + sumGap <= targetRpx) {
      gapScale = Math.max(0.08, (targetRpx - sumW) / sumGap);
    } else {
      // glyphs alone are wider than the envelope → scale the whole scatter down
      gapScale = 0.16;
      f = targetRpx / (sumW + gapScale * sumGap);
    }

    const effW = (m: Measured) => m.wRpx * f;
    const effGap = (m: Measured) => m.track * gapScale * f;
    const effCap = (m: Measured) => m.capRpx * f;
    const effBase = (m: Measured) => m.base * f;

    // optical centre of the ink
    let x = 0;
    let mass = 0;
    let massCX = 0;
    interface Pose { m: Measured; left: number; effW: number; }
    const poses: Pose[] = measured.map((m) => {
      const left = x;
      const w = effW(m);
      x += w + effGap(m);
      massCX += (left + w / 2) * w;
      mass += w;
      return { m, left, effW: w };
    });
    const opticalCX = mass > 0 ? massCX / mass : targetRpx / 2;

    // ---- rasterise each letter (crisp, halo baked, exact caps) ----
    for (const pose of poses) {
      const m = pose.m;
      const capCss = effCap(m) * scale;
      const wCss = pose.effW * scale;
      const padCss = Math.max(6, capCss * 0.16);
      const cw = Math.max(2, Math.ceil((wCss + padCss * 2) * rs));
      const ch = Math.max(2, Math.ceil((capCss + padCss * 2) * rs));
      const lc = document.createElement("canvas");
      lc.width = cw;
      lc.height = ch;
      const lctx = lc.getContext("2d");
      if (!lctx) continue;
      const probe = measureCap(lctx, 200);
      const fs = (capCss * rs * 200) / probe;
      lctx.font = `700 ${fs}px ${TITLE_FONT}`;
      lctx.textAlign = "left";
      lctx.textBaseline = "alphabetic";
      const drawAt = (x0: number, y0: number) => lctx.fillText(m.char, x0, y0);
      const gx = padCss * rs;
      const gy = (padCss + capCss) * rs;
      // halo: wide faint + near bloom (backlit vellum)
      lctx.save();
      lctx.shadowColor = "rgba(244,240,231,0.20)";
      lctx.shadowBlur = capCss * rs * 0.06;
      lctx.fillStyle = IVORY;
      drawAt(gx, gy);
      lctx.restore();
      lctx.save();
      lctx.shadowColor = "rgba(238,233,221,0.12)";
      lctx.shadowBlur = capCss * rs * 0.12;
      lctx.fillStyle = "rgba(241,236,226,0.5)";
      drawAt(gx, gy);
      lctx.restore();
      // crisp core
      lctx.fillStyle = IVORY;
      drawAt(gx, gy);

      const img = document.createElement("img");
      img.className = "letter";
      img.draggable = false;
      img.alt = "";
      img.src = lc.toDataURL("image/png");

      // positions — the undulating baseline scatter, block centred on x=960
      const imgLeftRpx = pose.left + (PW / 2 - opticalCX);
      const localY = effBase(m) - effCap(m); // cap top, relative to the mean line
      img.style.left = `${imgLeftRpx * scale}px`;
      img.style.top = `${localY * scale - padCss}px`;
      img.style.width = `${wCss + padCss * 2}px`;
      img.style.height = `${capCss + padCss * 2}px`;
      img.style.setProperty("--target", String(m.opacity));
      img.style.opacity = "0";
      this.root.appendChild(img);
      this.letters.push({
        el: img,
        target: m.opacity,
        shown: false,
        tArrive: m.arrive,
      });
    }

    // ---- sparkles pinned to letterforms (type as constellation) ----
    for (const sp of spec.pinnedSparkles) {
      const l = spec.letters[sp.letter];
      const pose = poses[sp.letter];
      if (!l || !pose) continue;
      const m = pose.m;
      const capCss = effCap(m) * scale;
      const padCss = Math.max(6, capCss * 0.16);
      const imgLeftRpx = pose.left + (PW / 2 - opticalCX);
      const s = document.createElement("div");
      s.className = "sparkle";
      const sz = Math.max(4, sp.r * 2 * f * scale);
      s.style.width = `${sz}px`;
      s.style.height = `${sz}px`;
      // anchor inside the glyph box
      s.style.left = `${(imgLeftRpx + 2) * scale + padCss * 0.2 + sp.dx * f * scale}px`;
      s.style.top = `${(effBase(m) - effCap(m)) * scale + padCss * 0.8 + sp.dy * f * scale}px`;
      s.innerHTML = sparkleSVG(Math.max(4, Math.round(sz)));
      this.root.appendChild(s);
    }
  }

  update(t: number, exposure: number) {
    if (!this.built) return;
    for (const lt of this.letters) {
      if (!lt.shown && t >= lt.tArrive) {
        lt.shown = true;
        const el = lt.el;
        el.classList.add("in");
        el.style.opacity = "0"; // restart from 0 so the CSS transition fades in
        requestAnimationFrame(() => {
          el.style.opacity = String(lt.target);
        });
      }
    }
    // DOM halo grades with exposure (TECH §7)
    const b = 1 + (exposure - 1) * 0.8;
    this.card.style.filter = `brightness(${b.toFixed(4)})`;
    this.credit.classList.toggle("in", t >= ART.times.creditIn);
  }

  reset() {
    for (const lt of this.letters) {
      lt.shown = false;
      lt.el.classList.remove("in");
      lt.el.style.opacity = "0";
    }
    this.credit.classList.remove("in");
  }
}

function specMeanArrive(_spec: unknown): number {
  return ART.times.titleStart;
}
