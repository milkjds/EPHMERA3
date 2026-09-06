import { U } from "./uniforms";

export interface ClockOptions {
  total?: number; // seconds of the film
}

/**
 * Master clock (TECHNICAL_PLAN §9.1/§9.3). Two notions of time:
 *  - `timeline` t : drives cues, dissolves, opacity envelopes. Scrubbing moves it.
 *  - `visual` t   : drives twinkle / hair / wisp / fog micro-motion. Frozen under
 *                   prefers-reduced-motion, which freezes plate drift + twinkle.
 * A damped critically-damped follower brings `timeline` toward `target` so even
 * violent scroll input produces a glacial slide (τ≈1.2 s, rate clamped ≈3×).
 */
export class Clock {
  /** timeline position (s) */
  t = 0;
  /** visual time (s), frozen when reduced motion */
  visual = 0;
  target = 0;
  paused = false;
  reduced = false;
  total = 46;

  private lastScrubAt = -10;
  private damp = 1.2; // τ (s)
  private maxRate = 3; // × nominal scene rate when scrubbing
  private vel = 0;

  constructor(opts: ClockOptions = {}) {
    if (opts.total !== undefined) this.total = opts.total;
  }

  reducedMode(on: boolean) {
    this.reduced = on;
    U.uReduced.value = on ? 1 : 0;
  }

  seek(time: number) {
    this.t = this.target = Math.min(this.total, Math.max(0, time));
    this.vel = 0;
    if (this.reduced) this.visual = this.t;
  }

  pause(on: boolean) {
    this.paused = on;
  }

  /** User scrubbing began (suspend auto-advance). */
  scrubStart() {
    this.lastScrubAt = this.target;
  }

  /** Apply a user scrub delta in seconds (already clamped by caller). */
  scrubDelta(deltaSec: number) {
    this.target = Math.min(this.total, Math.max(0, this.target + deltaSec));
    this.lastScrubAt = this.target;
  }

  /** Called when the user clicks replay / restarts. */
  replay() {
    this.seek(0);
    this.lastScrubAt = -10;
  }

  private activeUserScrub(nowT: number): boolean {
    // resume auto-advance ~1.4 s after the last user input at the same place
    return Math.abs(nowT - this.lastScrubAt) < 1.4;
  }

  update(rawDt: number) {
    const dt = Math.min(rawDt, 0.05);
    if (this.paused) return;

    // 1) advance the target (auto playback) unless the user is still scrubbing
    if (!this.activeUserScrub(this.target)) {
      this.target += dt;
      if (this.target > this.total) this.target = this.total;
    }

    // 2) follow target — critically damped, or direct under reduced motion
    if (this.reduced) {
      this.t = this.target;
      this.vel = 0;
    } else {
      const k = 1 / this.damp;
      const omega = k * 2.4;
      const dtClamped = Math.min(dt, 0.033);
      // critically damped spring toward target with velocity clamp
      const err = this.target - this.t;
      const maxVel = Math.max(1, Math.abs(this.target - this.t) / this.damp) * 1.2;
      const a = omega * omega * err - 2 * omega * this.vel;
      this.vel += a * dtClamped;
      this.vel = Math.max(-maxVel, Math.min(maxVel, this.vel));
      this.t += this.vel * dtClamped;
      if (Math.abs(err) < 0.002 && Math.abs(this.vel) < 0.002) this.t = this.target;
      this.t = Math.min(this.total, Math.max(0, this.t));
    }

    // 3) visual time — frozen under reduced motion (twinkle & drift stop)
    if (!this.reduced) {
      this.visual += dt;
      U.uTime.value = this.visual;
    } else {
      U.uTime.value = 0;
    }
  }
}
