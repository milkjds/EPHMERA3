/**
 * ART — the authored art-direction dataset (VISUAL_BIBLE tokens, §2.1 table,
 * §3/§11 placement numbers). Everything the eye parses as *placement* lives
 * here; procedural code only fills *texture* (TECHNICAL_PLAN §12).
 *
 * Editable parameters: this object is exposed on `window.__EPH.art` and can be
 * overridden through the URL hash, e.g.  #art={"plateII":{"dial":{"R":1150}}}
 * Values are in rpx (reference px of a 1920×810 picture) unless noted.
 */

export interface ChartSeg {
  kind: "line" | "arc";
  // line: endpoints (rpx). arc: centre/radius/angle range.
  x1?: number; y1?: number; x2?: number; y2?: number;
  cx?: number; cy?: number; r?: number; a0?: number; a1?: number;
  style: "long" | "dot";
  opacity: number; // 0.25–0.45 (Bible §11)
  wobble: number; // uneven dash seed
}

export interface StarCluster {
  x: number; y: number; // centre rpx
  rx: number; ry: number; // gaussian radii rpx
  w: number; // relative density weight
  kind: "pin" | "mid";
}

export interface HeroStar {
  x: number; y: number; // rpx
  size: number; // flare half-extent rpx (10–20 flare width total → half ≈ size)
  phase: number; period: number; bright: number;
}

export interface Wash {
  x: number; y: number; rx: number; ry: number; // rpx ellipse
  color: string; strength: number; // 0..1 wash alpha
}

const L = (spec: [string, number, number, number, number, number, number]) => {
  // char, capH rpx, baselineOff rpx(+low), track ×cap, arrive s, opacity
  return { ch: spec[0], capH: spec[1], base: spec[2], track: spec[3], arrive: spec[4], opacity: spec[5], widthF: spec[6] };
};

export const ART = {
  meta: { name: "EPHEMERA", credit: "Aethoro\u00a0ft.\u00a0xia", lyric: "I\u2019m not alone" },

  // --- motion (Bible §10) ---
  motion: {
    driftRpx: 10, // 0.52% PW/s = 10 rpx/s, constant — ONE plate speed
    twinkleBase: 1.6, // hero star period s
    handHourDeg: 0.4, // creep °/s (0.3–0.6)
    handMinDeg: 0.5,
  },

  // --- master timeline cues (s) (TECHNICAL_PLAN §9.1) ---
  times: {
    fadeInEnd: 2.5,
    titleStart: 3.0,
    creditIn: 6.1,
    exposureStart: 4.0,
    exposureEnd: 16.0,
    exposureA: 1.0,
    exposureB: 1.075,
    exposureCapHold: 1.1,
    dissolveStart: 16.0,
    dissolveEnd: 17.2,
    lyricIn: 20.0,
    lyricOut: 34.0,
    fogStart: 20.0,
    fogEnd: 30.0,
    fadeOutStart: 40.0,
    fadeOutEnd: 45.0,
    replayAt: 46.0,
  },

  // --- palette (Bible §1.1) ---
  palette: {
    skyCore: "#0B0E16",
    skyCore2: "#141926",
    skyLift: "#232A3A",
    slateMid: "#3A4254",
    slateMid2: "#4A5468",
    haze: "#C7CDD6",
    haze2: "#DDE1E6",
    ivory: "#EFEAE0",
    ivory2: "#F4F1EA",
    warmWhite: "#F2EEE6",
    mauve: "#5E4A55",
    steel: "#46617A",
    dialInk: "#E8ECEF",
    // Sequence B local values (reference-analysis §19)
    skyII: "#161D2B",
    skyII2: "#232D3E",
    neb1: "#2E3A4D",
    neb2: "#3C4A61",
    gearBlack: "#0A0C12",
    fogII: "#C4CBD3",
    fogII2: "#D8E0E8",
    moonIvory: "#F2F0EA",
  },

  // --- §2.1: EPHEMERA scatter ---
  title: {
    meanLinePH: 0.5, // block optical centre at 48–50% PH
    capPct: 0.72, // Playfair cap-height ÷ em (used for sizing, refined at runtime)
    blockWidthPW: 0.39, // 39% PW ≈ 750 rpx
    // letters in display order; base offset + = LOW (Bible table)
    letters: [
      L(["E", 200, 0, 0.35, 0.4, 1.0, 0.56]),
      L(["P", 120, 38, 0.55, 2.1, 0.85, 0.5]),
      L(["H", 160, -30, 0.45, 1.2, 0.95, 0.6]),
      L(["E", 110, 35, 0.75, 2.6, 0.82, 0.56]),
      L(["M", 200, -35, 0.3, 0.0, 1.0, 0.78]),
      L(["E", 110, 40, 0.65, 1.8, 0.88, 0.56]),
      L(["R", 140, 8, 0.5, 0.9, 0.92, 0.52]),
      L(["A", 130, 22, 0.5, 1.5, 0.9, 0.56]),
    ],
    pinnedSparkles: [
      // "one inside the small E after M, one on the A" (letter index, offset x rpx)
      { letter: 5, dx: -14, dy: 44, r: 7 },
      { letter: 7, dx: 8, dy: 60, r: 9 },
    ],
  },

  // ---------- PLATE I — The Valley ----------
  plateI: {
    sky: {
      top: "#0B0E16",
      bottom: "#101720",
      // a darker pool sits behind the title zone (rpx)
      pool: { x: 960, y: 370, rx: 760, ry: 330, amt: 0.016 },
      // faint corner lifts toward the dust band (Bible §3.1)
      dust: {
        // galactic band arcing through the title zone — centreline as a shallow S
        amp: 0.14, // max luminance lift multiplier over band
        yBase: 430, // rpx centreline base at x=960
        tilt: 0.16, // dy/dx of the band
        sigma: 115, // rpx soft width
        sigmaLong: 1500,
        color: "#8A94A8", // slate-ivory tint of unresolved star-milk
        nAmp: 0.05,
      },
      washes: [
        { x: 320, y: 130, rx: 480, ry: 300, color: "#5E4A55", strength: 0.05 }, // ONE mauve whisper, upper-left
        { x: 140, y: 260, rx: 380, ry: 260, color: "#46617A", strength: 0.05 }, // ONE steel pocket
      ] as Wash[],
    },
    starSeed: 10101,
    starClusters: [
      // Clustered asterisms with genuinely empty patches between (§11)
      { x: 470, y: 120, rx: 130, ry: 70, w: 1, kind: "pin" },
      { x: 1450, y: 90, rx: 230, ry: 90, w: 1.3, kind: "pin" },
      { x: 1330, y: 320, rx: 150, ry: 90, w: 0.8, kind: "pin" },
      { x: 560, y: 600, rx: 200, ry: 90, w: 0.7, kind: "pin" },
      { x: 1760, y: 470, rx: 150, ry: 100, w: 0.9, kind: "pin" },
      { x: 1500, y: 210, rx: 90, ry: 60, w: 0.6, kind: "pin" },
      { x: 360, y: 300, rx: 140, ry: 80, w: 0.5, kind: "pin" },
      // mid soft stars, same grammar
      { x: 1480, y: 120, rx: 150, ry: 60, w: 1.2, kind: "mid" },
      { x: 520, y: 150, rx: 110, ry: 55, w: 0.8, kind: "mid" },
      { x: 700, y: 660, rx: 220, ry: 70, w: 0.7, kind: "mid" },
      { x: 1750, y: 360, rx: 140, ry: 80, w: 0.8, kind: "mid" },
      { x: 340, y: 480, rx: 130, ry: 60, w: 0.5, kind: "mid" },
    ] as StarCluster[],
    // stars dissolve into limb fog / bottom veil — sampled region ends there
    skyClip: { top: 10, bottom: 700, left: 8, right: 1912 },

    heroes: [
      { x: 1680, y: 110, size: 17, phase: 0.2, period: 1.9, bright: 1.0 },
      { x: 1380, y: 60, size: 15, phase: 1.3, period: 1.5, bright: 0.9 },
      { x: 1120, y: 120, size: 13, phase: 2.1, period: 1.7, bright: 0.8 },
      { x: 760, y: 170, size: 14, phase: 0.8, period: 2.0, bright: 0.85 },
      { x: 340, y: 210, size: 12, phase: 1.7, period: 1.4, bright: 0.75 },
      { x: 480, y: 60, size: 11, phase: 2.6, period: 1.8, bright: 0.7 },
    ] as HeroStar[],

    charts: [
      { kind: "line", x1: 300, y1: 560, x2: 700, y2: 470, style: "long", opacity: 0.34, wobble: 3 },
      { kind: "line", x1: 620, y1: 470, x2: 1330, y2: 555, style: "long", opacity: 0.28, wobble: 7 },
      { kind: "line", x1: 1330, y1: 555, x2: 1810, y2: 350, style: "dot", opacity: 0.3, wobble: 11 },
      { kind: "line", x1: 880, y1: 100, x2: 1200, y2: 230, style: "dot", opacity: 0.3, wobble: 13 },
      { kind: "line", x1: 280, y1: 300, x2: 640, y2: 355, style: "dot", opacity: 0.26, wobble: 17 },
      { kind: "line", x1: 1180, y1: 175, x2: 1520, y2: 80, style: "dot", opacity: 0.3, wobble: 23 },
      { kind: "line", x1: 1560, y1: 460, x2: 1870, y2: 210, style: "long", opacity: 0.3, wobble: 29 },
      // arcs following the planet's limb curvature (Bible §11)
      { kind: "arc", cx: 890, cy: 2800, r: 2430, a0: -38, a1: 42, style: "long", opacity: 0.3, wobble: 5 },
      { kind: "arc", cx: 890, cy: 2800, r: 2330, a0: -52, a1: 30, style: "dot", opacity: 0.25, wobble: 19 },
    ] as ChartSeg[],

    // lower planet — the watercolour world (Bible §3.1)
    planet: {
      cx: 890, cy: 2800, r: 2430, // implied radius ≈ 2400 rpx
      faceTop: "#2A3140", // shadowed upper face
      faceMid: "#3A4254",
      faceBottom: "#4A5468",
      mottleSeed: 7.3,
      mottleAmp: 0.10,
      limbCore: "#F4F1EA",
      limbHalo: "#C7CDD6",
      // soft smoky terminator hugging the limb (never a hard day/night line)
      termSoft: 14, // rpx of soft edge
      limbSpread: 5, // rpx of bright core
      bottomFade: 760, // face dissolves into veil past this y
      // key: sun behind/below the left limb
      lightX: 620, lightY: 900,
    },

    // upper-right moon — dark face barely Δ5–8% above the sky (Bible §3.1/§5)
    moon: {
      cx: 2460, cy: 130, r: 700,
      face: "#151B2A",
      edgeLift: "#1C2334",
      crescent: "#EDE9DF",
      crescentSoft: 26,
      maria: 0.05,
      mottleSeed: 11.7,
      mottleAmp: 0.1,
    },

    limbBand: {
      // luminous fog blanket above the planet edge (Bible §8.1)
      rise: 150, // rpx above the limb
      color: "#C7CDD6",
      strength: 0.5,
    },
    bottomVeil: { y0: 560, y1: 812, color: "#DDE1E6", strength: 0.28 },
    faceVeil: { y0: 430, y1: 780, strength: 0.5 },
  },

  // ---------- PLATE II — The Hour ----------
  plateII: {
    sky: {
      top: "#141B29",
      bottom: "#1E2736",
      pool: { x: 960, y: 300, rx: 900, ry: 420, amt: 0.012 },
      dust: {
        amp: 0.07,
        yBase: 240, tilt: 0.1, sigma: 260, sigmaLong: 1300, color: "#7E8BA0", nAmp: 0.04,
      },
      washes: [
        { x: 300, y: 120, rx: 700, ry: 320, color: "#3C4A61", strength: 0.11 },
        { x: 1900, y: 260, rx: 500, ry: 380, color: "#2E3A4D", strength: 0.12 },
        { x: 1220, y: 90, rx: 420, ry: 220, color: "#46617A", strength: 0.05 },
      ] as Wash[],
    },
    starSeed: 20202,
    starClusters: [
      // sparser inside the dial zone; dense in the upper sky outside the rim
      { x: 400, y: 110, rx: 250, ry: 90, w: 1.1, kind: "pin" },
      { x: 1620, y: 150, rx: 300, ry: 130, w: 1.2, kind: "pin" },
      { x: 1560, y: 600, rx: 260, ry: 140, w: 0.7, kind: "pin" },
      { x: 420, y: 560, rx: 280, ry: 140, w: 0.6, kind: "pin" },
      { x: 1050, y: 680, rx: 320, ry: 120, w: 0.8, kind: "pin" },
      { x: 1760, y: 400, rx: 200, ry: 150, w: 0.9, kind: "pin" },
      { x: 500, y: 330, rx: 120, ry: 90, w: 0.5, kind: "pin" },
      { x: 1500, y: 110, rx: 160, ry: 70, w: 1.1, kind: "mid" },
      { x: 320, y: 210, rx: 120, ry: 60, w: 0.9, kind: "mid" },
      { x: 1650, y: 520, rx: 200, ry: 100, w: 0.6, kind: "mid" },
      { x: 520, y: 620, rx: 160, ry: 90, w: 0.5, kind: "mid" },
    ] as StarCluster[],
    skyClip: { top: 10, bottom: 780, left: 8, right: 1912 },

    heroes: [
      { x: 1500, y: 130, size: 16, phase: 0.4, period: 1.8, bright: 1.0 },
      { x: 400, y: 160, size: 14, phase: 1.6, period: 1.5, bright: 0.9 },
      { x: 1850, y: 430, size: 15, phase: 2.3, period: 2.0, bright: 0.8 },
      { x: 280, y: 470, size: 12, phase: 0.9, period: 1.7, bright: 0.75 },
      { x: 1720, y: 620, size: 13, phase: 1.2, period: 1.9, bright: 0.8 },
      { x: 1200, y: 120, size: 11, phase: 2.8, period: 1.4, bright: 0.7 },
      { x: 800, y: 740, size: 11, phase: 0.2, period: 2.1, bright: 0.65 },
      { x: 560, y: 520, size: 12, phase: 1.9, period: 1.6, bright: 0.8 },
    ] as HeroStar[],

    charts: [
      { kind: "line", x1: 120, y1: 150, x2: 700, y2: 300, style: "long", opacity: 0.3, wobble: 2 },
      { kind: "line", x1: 640, y1: 285, x2: 1400, y2: 150, style: "long", opacity: 0.3, wobble: 8 },
      { kind: "line", x1: 1400, y1: 150, x2: 1960, y2: 320, style: "dot", opacity: 0.32, wobble: 14 },
      { kind: "line", x1: 240, y1: 420, x2: 900, y2: 360, style: "dot", opacity: 0.28, wobble: 21 },
      { kind: "line", x1: 1180, y1: 500, x2: 1760, y2: 300, style: "dot", opacity: 0.3, wobble: 27 },
      { kind: "line", x1: 900, y1: 90, x2: 1300, y2: 250, style: "dot", opacity: 0.27, wobble: 33 },
      { kind: "line", x1: 100, y1: 640, x2: 800, y2: 520, style: "long", opacity: 0.28, wobble: 39 },
      { kind: "line", x1: 1450, y1: 700, x2: 1850, y2: 480, style: "dot", opacity: 0.3, wobble: 45 },
    ] as ChartSeg[],

    // moon limb, top-left corner (reference-analysis §2.5, layer 3)
    moonLimb: { cx: -260, cy: -120, r: 1050, color: "#F2F0EA", inner: "#C9CFDA", soft: 60, strength: 0.8 },

    // cut-paper gear silhouettes upper-right (Bible §6, §3.2)
    gears: [
      { x: 1760, y: 190, r: 330, teeth: 13, rot: 0.4, inner: 0.62, tone: 1 },
      { x: 1400, y: 60, r: 220, teeth: 11, rot: 0.9, inner: 0.5, tone: 0.94 },
      { x: 2000, y: 420, r: 300, teeth: 15, rot: 1.7, inner: 0.58, tone: 1 },
    ],

    // ---- the dial: a perfect circle in foreshortening (>104% PW, aspect .48) ----
    dial: {
      cx: 935, cy: 375, // centre = figure pivot (48.7% PW, 46.3% PH)
      R: 1150, // plane radius (rim runs off both edges)
      tiltCos: 0.48, // apparent minor/major
      camD: 2300, // plate-II camera distance (perspective magnitude)
      rimW: 1.5, // outer rim stroke (screen rpx at datum)
      ringInner: 0.94, // chapter band inner radius × R
      ringOuter: 0.995,
      tickCount: 60,
      tickIn: 0.955, // radial in/out (fraction of R)
      tickOut: 0.985,
      numeralR: 0.865, // numeral centre radius × R
      numeralH: 95, // on-plane cap height (perspective scales it on screen)
      numeralWt: 1.6, // on-plane stroke (screen ≈1–2 rpx)
      hourHand: { len: 0.62, tail: 0.16 },
      minHand: { len: 0.8, tail: 0.2 },
      handDeg: { hour: 302, min: 38 }, // starting orientation from 12, clockwise
    },
    figure: {
      x: 935, y: 375, h: 90, // 11% PH — never enlarge
      wispSeed: 5,
    },
    // fog banks (Bible §8.5) — sheet list: vertical placement, scale, drift
    fog: {
      // rise: the mask sweeps up as uRise 0→1
      base: { y0: 560, y1: 640, colorTop: "#C4CBD3", colorBot: "#D8E0E8", density: 0.85, yEnd0: 330, yEnd1: 460 },
      wisps: [
        { y: 430, h: 120, scale: 0.9, strength: 0.28, drift: -8, speed: 0.05 },
        { y: 300, h: 90, scale: 1.35, strength: 0.16, drift: 12, speed: 0.03 },
      ],
    },
  },

  // ---- post (TECHNICAL_PLAN §7) ----
  post: {
    bloom: { threshold: 0.62, knee: 0.18, gain: 0.55, radiusCapPW: 0.01 },
    glare: { strength: 0.05, color: "#C7CDD6" },
    vignette: { inner: 0.62, outer: 1.12, strength: 0.55 },
    grain: { amp: 1.4, steps: 12 },
    dither: 0.6,
    grade: { sat: 1.0 },
  },
};

export type ArtShape = typeof ART;
