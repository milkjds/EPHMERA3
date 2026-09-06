import { ART } from "../data/art";
import { PlateBase } from "./PlateBase";
import { SkyDome } from "./shared/SkyDome";
import { Starfield, HeroStars } from "./shared/Stars";
import { ChartLines } from "./shared/ChartLines";
import { CelestialBody, LimbFogBand, BottomVeil } from "./shared/Celestial";

/**
 * PLATE I — The Valley (VISUAL_BIBLE §3.1).
 * Two celestial bodies in opposition opening a lens-shaped valley of dark sky
 * where the title (DOM) will sit: a watercolour planet low-left cresting at
 * 45–48% PW with an implied radius ≈ 2400 rpx, and a dark-faced moon entering
 * from the right with its lit crescent on the lower-left rim — lit by the same
 * key as the planet. Stars cluster with genuinely empty patches between.
 */
export class PlateI extends PlateBase {
  stars!: Starfield;
  heroes!: HeroStars;

  constructor() {
    super(1905.3); // fovY ≈ 24°
    const a = ART.plateI;

    // layer 1 — sky register (gradient, dark pool, galactic dust, accents)
    new SkyDome(this, {
      top: a.sky.top,
      bottom: a.sky.bottom,
      pool: a.sky.pool,
      dust: a.sky.dust,
      washes: a.sky.washes,
    });

    // layer 2 — anchored starfield (clustered, never uniform)
    this.stars = new Starfield(this, {
      seed: a.starSeed,
      clip: a.skyClip,
      clusters: a.starClusters,
      zones: [
        // title exclusion zone (Bible §4: nothing bright within ~13% PW)
        { kind: "ellipse", cx: 960, cy: 345, rx: 470, ry: 240, mult: 0.05, fringe: 0.24 },
      ],
      dimY: (x) => {
        // stars dissolve into the planet's limb fog
        const p = a.planet;
        const dx = x - p.cx;
        if (Math.abs(dx) > p.r) return 1000;
        return p.cy - Math.sqrt(p.r * p.r - dx * dx) - 26;
      },
      counts: { pin: 175, mid: 52 },
    });

    // layer 3 — chart dashes (open triangles, never closed webs)
    new ChartLines(this, a.charts);

    // layer 4 — engraved hero sparkles
    this.heroes = new HeroStars(this, a.heroes);

    // layer 5 — the far moon (dark face barely Δ5–8% above the sky)
    const m = a.moon;
    new CelestialBody(
      this,
      {
        cx: m.cx,
        cy: m.cy,
        r: m.r,
        rect: [1450, -260, 3350, 860],
        mode: "moon",
      },
      {
        face: m.face,
        crescent: m.crescent,
        edgeLift: m.edgeLift,
        haze: ART.palette.skyLift,
      },
      {
        mottleAmp: m.mottleAmp,
        seed: m.mottleSeed,
        limbAmp: 1.5,
        hazeIn: 26,
        key: [620, 900], // same key as the planet — consistency is mandatory
      }
    );

    // layer 6 — luminous limb band hugging the planet edge
    const p = a.planet;
    new LimbFogBand(this, p.cx, p.cy, p.r);

    // layer 7 — the watercolour planet
    new CelestialBody(
      this,
      { cx: p.cx, cy: p.cy, r: p.r, rect: [-160, 330, 2260, 830], mode: "planet" },
      {
        face: p.faceTop,
        faceBot: p.faceBottom,
        limb: p.limbCore,
        haze: p.limbHalo,
      },
      {
        mottleAmp: p.mottleAmp,
        cratAmp: 1.0,
        seed: p.mottleSeed,
        limbAmp: 0.6,
        hazeIn: p.termSoft,
        key: [p.lightX, p.lightY],
      }
    );

    // layer 8 — bottom fog veil (softening the frame's lower edge)
    new BottomVeil(this);
  }

  /** tier → star draw fraction (placement never changes, only counts drop) */
  setTier(tier: number) {
    const f = [1, 0.8, 0.62, 0.5][tier] ?? 0.5;
    this.stars.setCount(f);
  }
}
