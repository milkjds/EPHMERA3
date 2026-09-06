import { ART } from "../data/art";
import { PlateBase } from "./PlateBase";
import { SkyDome } from "./shared/SkyDome";
import { Starfield, HeroStars } from "./shared/Stars";
import { ChartLines } from "./shared/ChartLines";
import { CelestialBody } from "./shared/Celestial";
import { Gears } from "./shared/Gears";
import { Dial } from "./shared/Dial";
import { Figure } from "./shared/Figure";
import { FogSheets } from "./shared/Fog";
import { uniforms } from "../core/uniforms";

/**
 * PLATE II — The Hour (VISUAL_BIBLE §3.2).
 * An overhead clock dial drawn as an astronomical instrument: a perfect circle
 * in foreshortening (>104% PW, aspect 0.48, centred slightly low), transparent
 * annotation line-art over the cosmos; the figure stands at the exact pivot,
 * 11% PH tall — the smallest element at the climax. Fog rises to swallow the
 * near rim as time ends.
 */
export class PlateII extends PlateBase {
  stars!: Starfield;
  heroes2!: HeroStars;
  dial!: Dial;
  fig!: Figure;
  private fog!: FogSheets;

  constructor() {
    const c = ART.plateII;
    super(c.dial.camD); // perspective magnitude drives the dial's near/far ratio

    // layer 1 — sky (variant: darker top, nebula washes)
    new SkyDome(this, {
      top: c.sky.top,
      bottom: c.sky.bottom,
      pool: c.sky.pool,
      dust: c.sky.dust,
      washes: c.sky.washes,
    });

    // layer 2 — stars (sparser inside the dial zone — sky through the glass)
    this.stars = new Starfield(this, {
      seed: c.starSeed,
      clip: c.skyClip,
      clusters: c.starClusters,
      zones: [
        { kind: "ellipse", cx: 935, cy: 375, rx: 950, ry: 460, mult: 0.16, fringe: 0.35 },
        { kind: "ellipse", cx: 1760, cy: 190, rx: 500, ry: 300, mult: 0.2, fringe: 0.4 }, // gear mass
      ],
      counts: { pin: 165, mid: 48 },
    });

    // layer 3 — engraved sparkles over the dark upper half, a few inside the dial
    this.heroes2 = new HeroStars(this, c.heroes);

    // layer 4 — moon limb, top-left corner
    const ml = c.moonLimb;
    new CelestialBody(
      this,
      { cx: ml.cx, cy: ml.cy, r: ml.r, rect: [-1900, -1900, 900, 900], mode: "limb" },
      {
        face: "#141A26",
        crescent: ml.color,
        haze: ml.inner,
      },
      { limbAmp: 0.9, seed: 3, hazeIn: 60, key: [-1200, -900] }
    );

    // layer 5 — cut-paper gear silhouettes (upper-right mass)
    new Gears(this, c.gears);

    // layer 6 — chart dashes crossing the whole frame (they stitch the plate)
    new ChartLines(this, c.charts);

    // layer 7 — the dial: rings, ticks, numerals, hands (+ figure shadow & wisp)
    this.dial = new Dial(this, {
      R: c.dial.R,
      numeralH: c.dial.numeralH,
      tiltCos: c.dial.tiltCos,
    });
    this.fig = new Figure(this);

    // layer 8 — fog banks (drawn after the dial: in front of the near rim)
    this.fog = new FogSheets(this, {
      y0: c.fog.base.y0,
      y1: c.fog.base.y1,
      yEnd0: c.fog.base.yEnd0,
      yEnd1: c.fog.base.yEnd1,
      colorTop: c.fog.base.colorTop,
      colorBot: c.fog.base.colorBot,
      density: c.fog.base.density,
    });
    for (const w of c.fog.wisps) {
      this.fog.addWisp(w.y, w.h, w.scale, w.strength, w.drift, w.speed);
    }
  }

  update(visualT: number, reduced: boolean) {
    this.dial.update(visualT, reduced);
  }

  setTier(tier: number) {
    const f = [1, 0.82, 0.62, 0.5][tier] ?? 0.5;
    this.stars.setCount(f);
  }
}
