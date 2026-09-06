import { Clock } from "./Clock";

const SCRUB_SENS = 0.00042; // wheel delta → seconds per px (heavily damped)
const KEY_STEP = 0.5;

/**
 * Scroll / drag / keyboard → damped timeline scrub (Bible §12.2, §12.6).
 * Input only ever writes a *timeline target*; the Clock's critically-damped
 * follower turns even violent input into a glacial slide. Reduced motion makes
 * scrubbing direct (no inertia).
 */
export class Scrub {
  clock: Clock;
  private dragging = false;
  private lastY = 0;
  private lastX = 0;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  attach() {
    window.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKey);
    const gl = document.getElementById("gl");
    gl?.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
    // suppress native scroll/zoom gestures over the experience
    document.addEventListener(
      "touchmove",
      (e) => {
        if (this.dragging) e.preventDefault();
      },
      { passive: false }
    );
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.clock.scrubStart();
    const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    this.clock.scrubDelta(delta * SCRUB_SENS);
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      e.preventDefault();
      this.clock.pause(!this.clock.paused);
      return;
    }
    if (e.code === "ArrowLeft") {
      e.preventDefault();
      this.clock.scrubStart();
      this.clock.scrubDelta(-KEY_STEP);
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      this.clock.scrubStart();
      this.clock.scrubDelta(KEY_STEP);
    }
  };

  private onDown = (e: PointerEvent) => {
    // touch / pen drags scrub the film; mouse-down alone is reserved for hold-to-develop
    if (e.pointerType !== "mouse") {
      this.dragging = true;
      this.lastY = e.clientY;
      this.lastX = e.clientX;
      this.clock.scrubStart();
    }
  };

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    // vertical drag scrubs; horizontal adds a touch too (both damped)
    const dy = this.lastY - e.clientY;
    const dx = this.lastX - e.clientX;
    this.lastY = e.clientY;
    this.lastX = e.clientX;
    const delta = dy * 0.012 + dx * 0.004;
    if (Math.abs(delta) > 0.0005) {
      this.clock.scrubStart();
      this.clock.scrubDelta(delta);
    }
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") {
      this.dragging = false;
      this.clock.scrubStart();
    }
  };
}
