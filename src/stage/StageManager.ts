import { PW, PH, ASPECT } from "../util";

export interface PictureRect {
  x: number;
  y: number;
  w: number;
  h: number;
  barH: number;
  scale: number; // css px per rpx
}

/**
 * StageManager — the fixed 2.35:1 cinema window (Bible §3.3, TECH §2.2/§10).
 * Computes the largest 2.35:1 rect centred in the viewport, exposes it through
 * CSS custom properties (--pw/--ph/--px/--py/--barH) and gives unit
 * conversions. The picture is never cropped, stretched or re-opened.
 */
export class StageManager {
  rect: PictureRect = { x: 0, y: 0, w: 1920, h: 810, barH: 135, scale: 1 };
  onResize?: () => void;
  private rafPending = false;

  layout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dw = Math.max(1, window.devicePixelRatio || 1);
    let w: number;
    let h: number;
    if (vw / vh >= ASPECT) {
      h = vh;
      w = h * ASPECT;
    } else {
      w = vw;
      h = w / ASPECT;
    }
    const x = (vw - w) / 2;
    const y = (vh - h) / 2;
    const barH = (vh - h) / 2;
    this.rect = { x, y, w, h, barH, scale: w / PW };
    void dw;
    this.applyCss();
  }

  private applyCss() {
    const r = document.documentElement.style;
    const q = (v: number) => `${Math.round(v * 1000) / 1000}px`;
    r.setProperty("--pw", q(this.rect.w));
    r.setProperty("--ph", q(this.rect.h));
    r.setProperty("--px", q(this.rect.x));
    r.setProperty("--py", q(this.rect.y));
    r.setProperty("--barH", q(this.rect.barH));
    document.getElementById("gl")?.setAttribute("data-ratio", ASPECT.toFixed(3));
  }

  /** listen to resize with rAF coalescing */
  start() {
    window.addEventListener("resize", () => {
      if (this.rafPending) return;
      this.rafPending = true;
      requestAnimationFrame(() => {
        this.rafPending = false;
        this.layout();
        this.onResize?.();
      });
    });
    this.layout();
  }

  /** rpx → css px within the window (picture coordinates) */
  cssX(rpx: number): number {
    return this.rect.x + rpx * this.rect.scale;
  }
  cssY(rpx: number): number {
    return this.rect.y + rpx * this.rect.scale;
  }
  rpxToPx(rpx: number): number {
    return rpx * this.rect.scale;
  }
}
export { PW, PH };
