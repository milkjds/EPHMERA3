import { U } from "./uniforms";

/**
 * "The cursor is light on glass" (VISUAL_BIBLE §12.3–4).
 *  - damped cursor position in picture-UV space → local exposure lift + chart brightening
 *  - cursor gain ramps in over movement, decays after 4 s idle
 *  - "hold to develop": press ≥ 0.6 s accelerates the luminance ramp (~4×) toward the
 *    end-of-plate exposure; release keeps what was earned (monotonic, never snaps back).
 */
export class CursorLight {
  /** picture-UV target & damped values (y down) */
  uvTarget = { x: 0.5, y: 0.5 };
  uvDamped = { x: 0.5, y: 0.5 };
  gain = 0;
  /** monotonic developing boost 0..1 */
  holdBoost = 0;
  pointerDown = false;
  holding = false; // hold ≥ 0.6 s engaged

  private holdTime = 0;
  private idle = 99;
  private damp = 0.12; // smoothing constant per frame @60

  /** map client coords → picture uv; returns false when outside the picture */
  pointerToUV(clientX: number, clientY: number): { x: number; y: number } | null {
    const pic = document.getElementById("picture");
    if (!pic) return null;
    const r = pic.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    if (x < -0.2 || x > 1.2 || y < -0.2 || y > 1.2) return null;
    return { x, y };
  }

  onMove(clientX: number, clientY: number) {
    const p = this.pointerToUV(clientX, clientY);
    if (p) {
      this.uvTarget.x = p.x;
      this.uvTarget.y = p.y;
      this.idle = 0;
    }
  }
  onDown() {
    this.pointerDown = true;
    this.holdTime = 0;
  }
  onUp() {
    this.pointerDown = false;
    this.holding = false;
    this.holdTime = 0;
  }

  update(dt: number) {
    this.idle += dt;
    // gain: presence after movement; decays after 4 s idle
    const want = this.idle < 4 ? 1 : 0;
    this.gain += (want - this.gain) * Math.min(1, dt / 0.35);
    if (want === 0) this.gain = Math.max(0, this.gain - dt / 2.2);

    // damped cursor position
    const a = Math.min(1, dt / 0.12);
    this.uvDamped.x += (this.uvTarget.x - this.uvDamped.x) * a;
    this.uvDamped.y += (this.uvTarget.y - this.uvDamped.y) * a;

    // hold-to-develop
    if (this.pointerDown) {
      this.holdTime += dt;
      if (!this.holding && this.holdTime >= 0.6) this.holding = true;
      if (this.holding) {
        // ~4× ramp pace, monotonic toward 1
        this.holdBoost = Math.min(1, this.holdBoost + dt / 3.2);
      }
    }

    // write the shared block
    U.uCursorUV.value.x = this.uvDamped.x;
    U.uCursorUV.value.y = this.uvDamped.y;
    U.uCursorGain.value = this.gain;
  }
}
