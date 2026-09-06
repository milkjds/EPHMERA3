# EPHEMERA — TECHNICAL PLAN

**Companion to:** `docs/VISUAL_BIBLE.md` (binding art direction). Where this plan and the
Bible disagree, the Bible wins.

**Prime directives:**

1. **Visual quality over technical complexity.** No effect ships because it is possible.
   Every pass in the pipeline must trace to a Bible rule (bloom → rationed light; grain →
   paper tooth; dither → no banding in near-black sky).
2. **Art-directed, not procedurally generated.** All placement that a viewer's eye parses —
   stars, dashes, letterforms, numerals, fog banks — is authored data or authored-mask-
   constrained sampling with fixed seeds. Unseeded runtime randomness is forbidden (§12).
3. **The lens is locked; the cosmos drifts; nothing eases.** The engine enforces the motion
   doctrine structurally (there is no code path that accelerates the plate).

---

## 1. Stack & delivery

| Concern | Decision |
|---|---|
| Renderer | **Three.js `^r165` (ESM)**, `WebGL2`, single `WebGLRenderer` |
| Controls | **None.** OrbitControls/PointerLockControls are not imported. The camera never moves |
| Post | **Custom lean compositor** (4 fullscreen passes, hand-written) — not EffectComposer; we need exactly: plate render → bright-pass/blur → composite. Fewer moving parts, full art control |
| Typography | **DOM layer** (real font files, per-letter spans) — crisp Didones at no GPU text cost; WebGL text is reserved for the numerals, which are clock parts, not copy |
| Textures | Authored PNG/SVG atlases (§12); no generated-at-runtime images |
| Audio | Out of scope |
| Build | Static site, ES modules, `three` from CDN or vendored; total first-party JS target < 150 KB (excl. three) |
| First paint | Letterbox bars + sky gradient render in CSS immediately; WebGL enhances in (target < 2 s on broadband) |

### Module layout

```
src/
  main.js                  // boot, Stage setup, RAF loop
  core/
    Clock.js               // master time, pause, reduced-motion mode
    Timeline.js            // declarative cue list (§9)
    Scrub.js               // damped scroll/touch/keyboard → timeline target
    CursorLight.js         // pointer NDC + "hold to develop" state
    QualityMonitor.js      // frame-time metering → tier (§11)
  stage/
    StageManager.js        // picture rect (2.35:1), DOM overlays, letterbox
    TitleCard.js           // per-letter spans, arrival cues, sparkles
    Captions.js            // bottom-bar lyric/caption system
  plates/
    PlateBase.js           // shared rig: layers, drift compensation, build/teardown
    PlateI.js              // The Valley
    PlateII.js             // The Hour
    shared/                // SkyDome, Starfield, ChartLines, MoonQuad, FogSheets...
  fx/
    Compositor.js          // RT management + final quad passes
  shaders/                 // GLSL chunk library (§5)
  assets/                  // density maps, numeral atlas, figure sprite, dash specs (§12)
```

---

## 2. Three.js architecture

### 2.1 Data flow

```
        DOM
        ├─ #bars-top / #bars-bottom          (pure black, CSS)
        ├─ .picture  ── TitleCard            (per-letter spans + 2 sparkle nodes)
        │              ── Captions           (bottom bar)
        └─ canvas#gl                         (full window, z below .picture)

  WebGL (per frame)
        activePlate(s).scene ──render──▶ plateRT (RGBA16F)     [PlateII only when weight>0]
        plateRT ──brightpass──▶ brightRT (¼ res)
        brightRT ──blur×2──▶    blurRT   (¼ res, ping-pong)
        {plateRT A, plateRT B, blurRT} ──▶ FINAL QUAD SHADER
              dissolve mix → +bloom → veiling glare → grade(uExposure)
              → vignette → film grain → dither → letterbox mask ──▶ screen
```

- Only the active plate renders. During the 1.2 s dissolve window **both** plates render
  (cost is bounded and budgeted in §11).
- All passes share one master uniform block (§5.4). No per-frame object allocation; uniforms
  are mutated in place.
- The DOM typography sits **above** the canvas, so canvas dashes pass *under* the title for
  free (Bible §2.1), and captions in the bars never touch WebGL output.

### 2.2 Responsibilities

- **StageManager** computes the 2.35:1 picture rectangle in CSS pixels each resize, sets the
  renderer viewport/scissor to it, and exposes it as the unit basis for DOM overlays
  (`--pw`, `--ph` CSS custom properties) and for camera projection (§8).
- **PlateBase** owns a `THREE.Scene`, a locked camera, a layer stack, and the drift rig (§3).
- **Timeline** maps master time → per-cue parameters (§9). Motion is never computed from
  spring/easing libraries; only constants, sinusoids, and opacity envelopes exist.

---

## 3. Scene hierarchy

### 3.1 The plate rig — one plate, one speed (enforced in code)

All celestial content lives in per-depth layer groups. A single `drift` accumulator
(pixels at reference scale) advances at a **constant** 0.52% PW/s. Each layer group is
translated so that **screen-space speed is identical for every layer**:

```
worldOffsetX(layer) = -driftPx * (layer.z / zRef) * (f / fRef)   // f = focal scale
```

i.e. per-depth compensation makes parallax **exactly zero** — the telephoto "one plate"
read. There is no code path that moves layers independently; `driftPx` is the only spatial
input, and it is integrated as `v·dt` with `v` a constant. (Scrub damping modulates the
*rate of time*, never adds velocity of its own.)

### 3.2 Plate I — The Valley

```
sceneI (camera: locked, fov 24°, at origin looking -Z)
└─ plateRig
   ├─ L1 skyDome            (fullscreen-adjacent quad, z=120)   sky gradient + dust band + accents
   ├─ L2 starfield          (Points, z=110)                     pinpricks + mid stars
   ├─ L3 chartLines         (ribbon batch, z=105)               6–10 authored segments + limb arcs
   ├─ L4 heroStars          (instanced quads, z=100)            4–8 engraved sparkles
   ├─ L5 moonFar            (shader quad, z=95)                 dark-faced moon, lit crescent
   ├─ L6 limbHaze           (shader quad, z=90)                 fog band hugging the planet edge
   ├─ L7 planetBody         (shader quad, z=85)                 watercolor SDF limb + mottle + veil
   └─ L8 bottomVeil         (shader quad, z=80)                 softening fog, bottom edge
   (Typography = DOM; vignette/letterbox = final pass)
```

### 3.3 Plate II — The Hour

```
sceneII (camera: locked, fov 24°, pitched ~35° down)
└─ plateRig
   ├─ L1 skyDome            (variant seed: darker top, nebula washes)
   ├─ L2 starfield          (density mask variant; sparser inside dial zone)
   ├─ L3 moonLimb           (shader quad, top-left corner)
   ├─ L4 gearSilhouettes    (flat near-black shader quads, upper-right mass)
   ├─ L5 chartLines         (authored segments crossing the dial)
   ├─ L6 dialGroup          (tilted ~35° plane, matches camera pitch)
   │   ├─ chapterRings      (2 concentric ribbon rings + radial ticks, instanced)
   │   ├─ numerals          (instanced quads, atlas glyphs, tangent-rotated, perspective-scaled)
   │   ├─ handHour / handMinute   (authored spade paths as skeleton ribbon line-art)
   │   └─ figure            (painted sprite + masked micro-warp) + wisp billboard
   ├─ L7 fogSheets          (3–5 fBm planes, some IN FRONT of near rim)
   └─ L8 glassSheen         (broad low-contrast diagonal gradient quad over dial)
   (Lyric = DOM bottom bar)
```

The dial group is a child of the rig (it drifts with the plate, numerals included); the
figure is a child of the dial at the pivot, so she drifts with her clock — imperceptibly
(~2% PW across the hold), exactly as in the reference.

---

## 4. Geometry strategy

**Principle: the world is *drawn*, not meshed.** The reference reads as print-on-glass; flat
authorable 2D geometry in a perspective rig gives that look, is fully art-directable, and is
cheap. No displacement maps, no imported 3D models, no sphere meshes.

| Element | Geometry | Notes |
|---|---|---|
| Sky | 1 camera-facing quad per plate, slightly oversized vs. frustum | Shader paints gradient, dust band, nebula washes from authored masks (§12) |
| Planet / moons | Camera-facing **shader quads** with 2D circle-SDF limbs | Limb arc via SDF (soft edge 1–2 px); watercolor = domain-warped fBm mottle; craters = blurred low-freq blobs in lit zone only; terminator = smoky falloff, never crisp. Radius/position authored to match Bible §3.1 (planet implied radius ≈ 2,400 rpx) |
| Chart lines | **Ribbon quads** (camera-facing strips) with analytic AA (`fwidth` edges) | Never `gl.LINES` (1 px aliasing). Arcs = polyline ribbons sampled from authored curves. Dash pattern computed in-shader with ±15% noise on segment length → hand-ruled unevenness |
| Dial rings/ticks | Ribbon rings (annulus strips) + **instanced** tick quads | Ticks: 60 instances, per-instance length/hour-weight |
| Numerals | **Instanced quads** + glyph atlas | Atlas from authored SVG outlines (Cinzel, stroked, transparent fill); per-instance transform = hour position, tangent rotation, perspective scale — the 3D tilt does the foreshortening for free |
| Hands | Authored 2D paths (spade tips, double-outline skeleton) → ribbon line-art | Rotation about pivot at constant creep (0.3–0.6°/s), no easing |
| Figure | 1 authored painted sprite quad | Hair/cloth idle = sinusoidal warp in shader, masked by authored warp mask; wisp = small fBm billboard cycling ~2 s |
| Fog | 3–5 camera-facing **fBm shader planes** at authored depths | Internal billow = domain-warped fBm with drift + rise uniforms; feathered alpha; see §6 |
| Stars | Points + instanced quads | See §6 |

**Counts (reference quality):** ~14 draw calls for Plate I, ~22 for Plate II (instancing
keeps ticks/numerals/stars at 1 call each). Budget: **< 40 total** during dissolve.

---

## 5. Shader strategy

### 5.1 Shared GLSL chunk library (`src/shaders/`)

```
hash.glsl, noise3.glsl, fbm.glsl        // value noise, 4-octave fBm, domain-warp helper
sdf2d.glsl                              // circle/segment SDFs + soft-edge helpers
dash.glsl                               // dash/dot patterning with hand-unevenness noise
twinkle.glsl                            // desynced 1–2 s sinusoid pulses
vignette.glsl                           // elliptical corner falloff
grade.glsl                              // exposure, veiling glare, filmic-lite tonemap
grain.glsl                              // 12 fps-stepped fine tooth, ~1.5/255 amplitude
dither.glsl                             // triangular + hash; mandatory before display
```

### 5.2 Material specs

| Material | Type | Key inputs |
|---|---|---|
| Sky | ShaderMaterial, UNLIT | dust-band mask tex, accent wash masks, `uExposure` |
| Celestial quad | ShaderMaterial | SDF radius/center, mottle seed, terminator softness, crescent direction (shared with planet key — consistency law), veil amount |
| Chart ribbon | ShaderMaterial, **blending: additive** | dash style (20/12 or 4/6 rpx), base opacity 25–45%, `uCursorGlow` (local +5–10% near pointer) |
| Hero star | ShaderMaterial on instanced quads, additive | gaussian core + engraved 4-point cross via `abs()` falloff; per-instance phase/period; hover shortens period |
| Star points | Points + ShaderMaterial | per-vertex: size class (1–2 / 2–4 rpx), brightness, twinkle seed; round soft sprite |
| Fog sheet | ShaderMaterial, normal blending, premultiplied | fBm octaves 4, warp 2, `uRise` (0→1 crescendo), `uDriftLateral` |
| Numeral quad | MeshBasicMaterial + atlas, additive | per-instance opacity 80–90%, slight bloom from post |
| Figure | ShaderMaterial | sprite tex, warp mask, 2 idle sinusoids |

**Additive + line-art = "ink on glass":** all annotation layers (dashes, dial, numerals,
hero stars) render additively so the cosmos always shows through — this *is* Bible §5's
transparency law, enforced by blend mode.

### 5.3 What deliberately has no shader

No refraction, no chromatic aberration, no anamorphic, no lens flare, no god rays, no SSAO,
no depth of field (the reference is telephoto-flat, everything in focus), no motion blur.

### 5.4 Master uniform block (one per frame, mutated in place)

```glsl
uniform float uTime;        // master clock (s)
uniform float uExposure;    // developing-print ramp, 1.00 → 1.10 (Plate I)
uniform float uDrift;       // accumulated reference px, constant rate
uniform float uDissolve;    // 0 = Plate A, 1 = Plate B
uniform vec2  uCursor;      // NDC in picture space, damped
uniform float uCursorGain;  // 0 when pointer idle → ramps to 1 over ~1.5 s
uniform int   uTier;        // quality tier
uniform float uGrainSeed;   // steps at 12 fps
```

---

## 6. Particle strategy

**There are no particle systems in the FX sense.** The Bible forbids drifting fields. What
exists is exactly three populations of *anchored* points plus fog sheets:

1. **Pinpricks + mid stars** — one `THREE.Points` per plate.
   - Positions are **rejection-sampled from an authored density texture** (a hand-painted
     1024×432 PNG: bright where clusters belong, black in the mandated empty patches —
     upper-left sky, title exclusion zone of 13% PW, dial interior sparse). Seeded jitter
     breaks the sampling grid; seed is fixed and shipped. No runtime `Math.random()`.
   - Sizes/brightness/period attributes authored per class; twinkle = brightness modulation
     only (±20%), desynchronized phases.
2. **Hero stars** — instanced quads at **authored coordinates** (a small JSON list), 4–8
   per plate, two of which are mirrored into DOM sparkle nodes pinned to title letterforms.
   Twinkle = 0.9–1.1× scale + cross-flare gain over 1–2 s. Hover: period × 0.6.
3. **Fog sheets** — the only translating/deforming elements (slow lateral drift + `uRise`);
   they are planes, not particles, and their billow comes from domain-warped fBm.

Stars have **no velocity attribute at all** — they cannot drift relative to the plate by
construction. Fog planes never move faster than ~1.5% PW/s.

---

## 7. Post-processing

One hand-written compositor, executed in this order (order is art-direction, not preference):

| # | Pass | Res | Spec |
|---|---|---|---|
| 1 | Plate render (active, or both during dissolve) | picture rect, RGBA16F | Half-float so the grade never bands before dither |
| 2 | Bright-pass → separable gaussian blur ×2 | ¼ res | Threshold ≈ 0.55 with soft knee; radius **capped to a ~1% PW halo** — this enforces the 10–20 rpx bloom law structurally |
| 3 | **Final composite quad** | full window | See chain below |

Final quad chain (single shader, in-order):

```
mix(plateA, plateB, smooth uDissolve)     // 1.2 s cross-dissolve, the only transition
+ bloom (additive, capped)                // rationed light
+ veiling glare                            // bottom-anchored black lift toward #C7CDD6,
                                            // amplitude ∝ uExposure (stronger Plate I)
× grade(uExposure) → filmic-lite tonemap   // desat-preserving; never clips to white
× elliptical vignette                      // falloff 8–13% PW, corners strongest, no hard edge
+ film grain                               // fine tooth, amplitude ~1.5/255, 12 fps steps,
                                            // luminance-weighted
+ triangular dither (±0.5/255)              // mandatory: near-black sky must not band
− letterbox mask (last, pure #000 bars)     // bars stay clean: no grain, no glow
```

Typography bloom is **not** post — DOM letters carry tight layered `text-shadow` halos in
ivory (backlit vellum), which grades with a CSS `filter: brightness()` bound to `uExposure`.

---

## 8. Camera system

- One `PerspectiveCamera` per plate, **transform-locked at boot** and never touched again.
  No controls library is loaded; there is no zoom, orbit, or pan API surface at all.
- Plate I: at origin, `fovY ≈ 24°`, looking down −Z (telephoto flattened vista).
- Plate II: same lens, pitched ~35° down at the dial plane (gives the 0.48 ellipse
  foreshortening and numeral perspective for free).
- **Projection is computed against the picture rectangle, not the window** (§10): horizontal
  FOV is anchored so the valley's width relationships (45–48% PW crest, moon entry, 39% PW
  title band) hold at every aspect.
- The dissolve is a shader mix — the cameras never move, so nothing can swoop.
- Cursor light, hold-to-develop, and scrub are uniform changes only (§9). They physically
  cannot move the camera.

---

## 9. Animation system

### 9.1 Master clock & cues

`Clock` advances master time `t` (pausable). `Timeline` is a declarative cue list evaluated
each frame — cues set parameters, never positions:

| t (s) | Cue | Param / manner |
|---|---|---|
| 0.0 | Fade from black | 2.5 s linear |
| 0.5 | Moon enters from right edge | plate drift carries it; no extra velocity |
| 3.0–5.6 | Title letters arrive | per-letter opacity fades, authored scatter order (Bible §2.1 table) |
| 6.1 | Credit fades in | 1 s |
| 4→16 | Developing-print luminance ramp | `uExposure` 1.00→1.07 linear; limb haze thickens |
| 16.0–17.2 | Dissolve → Plate II | `uDissolve` 0→1, smoothstep |
| 17.2→ | Hands creep | constant 0.3–0.6°/s |
| 20.0 | Lyric "I'm not alone" | quiet in (1 s) |
| 20–30 | Fog crescendo | `uRise` 0→1, linear (the 5–10 s submersion) |
| 34.0 | Lyric out | 1 s |
| 40–45 | Fade to black | 5 s; end state holds with replay caption in bar style |

Total ~45 s; loop or replay affordance is a caption-styled DOM control.

### 9.2 Motion primitives (exhaustive)

1. **Constant-velocity integration** — drift, hands, fog rise, luminance ramps: `p += v·dt`,
   `v` fixed. No easing library is imported anywhere in the project.
2. **Sinusoid micro-cycles** — twinkle, hair/cloth, wisp: fixed amplitude, desynced phases.
3. **Opacity envelopes** — letter arrivals, credit, lyric, dissolves, fades: linear or
   smoothstep-in-time only.

If a requested effect is not expressible with these three, it is out of doctrine and is
rejected at review.

### 9.3 Scrub & interaction plumbing

- Wheel / touch-drag / arrow keys write a *timeline target*; actual `t` follows through a
  critically-damped follower (τ ≈ 1.2 s) with an output rate clamp (~3× nominal scene
  velocity on screen). Scrubbing modulates the passage of time; it adds no motion of its own.
- **Cursor light:** damped `uCursor` + `uCursorGain` (ramps in over 1.5 s of movement,
   decays after 4 s idle) → local +2–3% exposure, chart-line brightening.
- **Hold to develop:** pointerdown ≥ 0.6 s ramps `uExposure` toward its end-of-plate value at
  ~4×, capped there; release retains the value (monotonic — never snaps back).
- **Reduced motion** (`prefers-reduced-motion`): drift = 0, twinkle static, fog rise
  completes via dissolve-length crossfade only, scrub becomes direct (no inertia).

---

## 10. Responsive strategy

**The picture is a fixed 2.35:1 cinema window. It is never cropped, stretched, or re-opened.**

- **StageManager** computes the largest 2.35:1 rect centered in the viewport; bars fill the
  remainder (on 16:9 ≈ 12%/13% height; on portrait phones the picture becomes a luminous
  band between large black fields — a glass slide held up, which is the point).
- Renderer viewport + scissor = picture rect; projection anchors **horizontal FOV** so
  composition ratios (crest 45–48% PW, title band 39% PW, dial >104% PW) hold at every size.
- All DOM typography sizes from `--pw/--ph` custom properties (cap heights in %PH per the
  Bible tables). Clamps: lyric x-height ≥ 9 css px (readability floor — hierarchy is kept by
  *relative* scale); title clamps so per-letter size contrast survives at small sizes.
- Numerals/hero-star flare sizes are world-space — they scale with the projection
  automatically; dash lengths are `fwidth`-consistent so 1 rpx ≈ 1 px at any DPR.
- Mobile portrait: same plates, reduced tier (§11), touch scrub via drag; bars absorb safe
  areas; `100dvh` sizing to survive browser chrome.

---

## 11. Performance strategy

### 11.1 Budgets

| Metric | Target (desktop) | Floor (mid mobile) |
|---|---|---|
| Frame time | < 8 ms | < 22 ms |
| Draw calls | < 40 (both plates, worst case) | < 25 |
| Render targets | 1 plate RT + 2 ¼-res (bloom) | same, ⅛-res bloom |
| DPR cap | 2.0 | 1.5 |
| JS heap growth per frame | 0 (no allocations in loop) | 0 |

### 11.2 Structural economies

- **Only the active plate renders** (second plate only inside the 1.2 s dissolve window).
- One material instance per class; instancing for stars/ticks/numerals/hero stars.
- Fog = 3–5 planes, not volumes; bloom = ¼-res two-pass with a radius cap.
- RAF pauses on `visibilitychange` / picture offscreen (IntersectionObserver on canvas).
- All buffers typed-array backed and reused; per-frame work = uniform writes only.

### 11.3 Quality tiers (auto, with hysteresis)

`QualityMonitor` keeps a rolling 60-frame mean; > 10 ms sustained → step down; < 5.5 ms
sustained for 300 frames → step up (max one step per 5 s).

| Tier | DPR | Bloom | Grain | Stars | Fog sheets |
|---|---|---|---|---|---|
| 0 (full) | ≤ 2.0 | 2 iter, ¼ res | 12 fps steps | 100% | 5 |
| 1 | ≤ 1.5 | 1 iter | 12 fps | 80% | 4 |
| 2 | 1.25 | 1 iter, ⅛ res | static | 60% | 3 |
| 3 (low) | 1.0 | off (halo term in hero/material shaders instead) | static | 50% | 2 |

Degradation order is chosen so the *composition* survives intact — counts drop, never
placement (clusters, empty patches, dashes, letters are untouched). `prefers-reduced-motion`
additionally zeroes drift/twinkle work.

---

## 12. Authoring vs. procedural — the anti-generic guarantee

Everything the eye parses as *placement* is authored data, checked into `src/assets/`:

| Asset | Format | Content |
|---|---|---|
| `density-plateI.png`, `density-plateII.png` | 1024×432 PNG, hand-painted | Star density incl. bright cluster patches and **black empty zones** (title exclusion, upper-left, dial interior) |
| `heroes.json` | JSON | Hero star coordinates, sizes, phases (incl. the two letterform-pinned sparkles) |
| `chart-plateI.json`, `chart-plateII.json` | JSON | 6–10 dash segments each: endpoints/arc params, angle, style (20/12 or 4/6 rpx), opacity 25–45% |
| `title-letters.json` | JSON | Per-letter size/baseline/tracking/arrival/opacity (Bible §2.1) |
| `numerals-atlas.png` + `numerals.json` | SVG→PNG 2×, JSON | Outline Roman caps glyph atlas + hour transforms |
| `figure.png` + `figure-warp.png` | Painted PNG + mask | The one painted character asset |
| `fog-banks.json` | JSON | Sheet depths, drift vectors, rise curves, moonlight weighting |

Procedural code only ever fills *texture* (fBm mottle, fog billow, dash unevenness ±15%,
grain) — never *layout*. All sampling uses shipped fixed seeds. Runtime `Math.random()` is
banned outside the dither/grain hash.

---

## 13. Build order & risks

**Build phases (each ends frame-reviewable):**

1. Stage + letterbox + sky quad + drift rig (the film already breathes) →
2. stars (density-masked) + chart lines + typography scatter →
3. planet/moon quads + limb haze + developing-print ramp →
4. compositor: bloom cap, vignette, glare, grain, dither →
5. dissolve + Plate II dial/numerals/hands/figure →
6. fog crescendo + interaction (scrub, cursor light, hold-to-develop) →
7. quality tiers, reduced-motion, responsive polish.

**Risks & mitigations:**

- *Banding in near-black sky* → RGBA16F + mandatory dither; verified on OLED profile.
- *DOM type vs WebGL bloom mismatch* → type bloom via layered text-shadow, graded with the
  same `uExposure`; side-by-side check at cue 6.1 s.
- *Dissolve double-render spike on low tier* → dissolve window forces Tier ≥ 2 caps for its
  1.2 s; acceptable, invisible.
- *"Space website" drift* (scope creep toward nebula HDR, camera control, particles) →
  Forbidden List review at every phase gate; this document's §5.3/§6 are closed sets.
