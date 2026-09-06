import { U } from "./uniforms";

/**
 * Frame-time metering → quality tier (TECHNICAL_PLAN §11.3).
 * Rolling 60-frame mean; sustained >10 ms steps down, <5.5 ms for 300 frames
 * steps up; at most one step per 5 s. Tier drives DPR/RT scale, bloom
 * iterations, star/fog density via U.uTier.
 */
export interface QualityState {
  tier: number; // 0..3
  frameMs: number; // EMA
}

export class QualityMonitor {
  state: QualityState = { tier: 0, frameMs: 8 };
  private ema = 8;
  private frames = 0;
  private lastChange = -10;
  private goodFrames = 0;

  /** dpr cap & rt scale per tier */
  static dpr(tier: number, rawDpr: number): number {
    const caps = [2.0, 1.5, 1.25, 1.0];
    return Math.min(caps[tier] ?? 1, Math.max(1, rawDpr));
  }
  static bloomIters(tier: number): number {
    return tier <= 1 ? 2 : 1;
  }

  update(dt: number, nowSec: number) {
    const ms = dt * 1000;
    const a = 1 / 60;
    this.ema += (ms - this.ema) * a;
    this.frames++;

    if (nowSec - this.lastChange < 5) {
      // cooldown — but emergency step-down allowed at 2 s
      if (!(this.ema > 12 && nowSec - this.lastChange > 2)) {
        return;
      }
    }
    const tier = this.state.tier;
    if (this.ema > 10 && tier < 3) {
      this.state.tier = tier + 1;
      this.lastChange = nowSec;
      this.goodFrames = 0;
    } else if (this.ema < 5.5 && tier > 0) {
      this.goodFrames++;
      if (this.goodFrames > 300) {
        this.state.tier = tier - 1;
        this.lastChange = nowSec;
        this.goodFrames = 0;
      }
    } else {
      this.goodFrames = 0;
    }
    this.state.frameMs = this.ema;
    U.uTier.value = this.state.tier;
  }
}
