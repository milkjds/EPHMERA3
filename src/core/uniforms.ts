import * as THREE from "three";

/**
 * The master uniform block (TECHNICAL_PLAN §5.4). One set of {value} holders
 * shared by every material — mutated in place each frame, never reallocated.
 */
export const U = {
  uTime: { value: 0 },
  uExposure: { value: 1.0 },
  uDrift: { value: 0 }, // accumulated plate drift in rpx
  uDissolve: { value: 0 }, // 0 = plate I, 1 = plate II
  uRise: { value: 0 }, // Plate II fog crescendo 0→1
  uFade: { value: 1 }, // master fade (0 = black)
  uCursorUV: { value: new THREE.Vector2(0.5, 0.5) }, // in picture UV (y down)
  uCursorGain: { value: 0 },
  uPxPerRpx: { value: 1 },
  uTier: { value: 0 },
  uGrainSeed: { value: 0 }, // steps at 12 fps
  uReduced: { value: 0 }, // prefers-reduced-motion
};

export type SharedUniforms = Record<string, { value: unknown }>;

/** Build a material uniform table sharing the master block by reference. */
export function uniforms(extra?: Record<string, { value: unknown }>): Record<string, { value: unknown }> {
  const base: Record<string, { value: unknown }> = {};
  for (const k of Object.keys(U)) base[k] = (U as Record<string, { value: unknown }>)[k];
  if (extra) for (const k of Object.keys(extra)) base[k] = extra[k];
  return base;
}
