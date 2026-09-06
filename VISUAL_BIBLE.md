# EPHEMERA — VISUAL BIBLE

**Role:** Art direction for a premium cinematic real-time WebGL experience.
**Source of truth:** `docs/reference-analysis.md` (Vision Analyst) + frames in `/frames/`.
**Status:** BINDING. Where engineering convenience conflicts with this document, this document wins.

---

## Units convention

All measurements are given in **reference pixels** (`rpx`) at the 1920×1080 reference window,
whose **picture area is 1920×810** (2.35:1 letterboxed inside 16:9), and as percentages of
**picture width (PW = 1920 rpx)** and **picture height (PH = 810 rpx)**. Convert to live units
against the rendered picture rectangle, never the browser window.

---

## 0. Concept — the one sentence

> **An astronomical atlas printed on glass, held up to the light.**

The experience is a sequence of **plates** — locked, silent, near-static images of the cosmos —
in which only the heavens move. It is a *print*, not a simulation; an *instrument*, not a HUD;
a *held breath*, not a ride.

Three laws govern everything below. They may never be violated:

1. **The lens is locked. The cosmos drifts.** Nothing attached to the camera ever moves.
2. **One plate, one speed.** All celestial content translates at a single constant screen
   velocity. There is no multi-speed parallax, ever.
3. **Light is rationed.** Brightness is scarce and therefore meaningful. Every glow must be
   motivated by a light source in the scene or by ink on the plate.

The experience consists of two plates joined by the dissolve:

- **PLATE I — The Valley** (from Sequence A): two celestial bodies in opposition, the title
  EPHEMERA scattered between them like an unfolded constellation.
- **PLATE II — The Hour** (from Sequence B): an overhead clock dial drawn as an astronomical
  instrument, a small figure at its pivot, fog rising to swallow time.

---

## 1. COLOR

Two hue families and two whisper accents. **There is no fourth hue. Ever.**

### 1.1 Palette (tokens)

| Token | Hex | Role |
|---|---|---|
| `sky-core` | `#0B0E16` → `#141926` | Darkest sky; pools behind the title |
| `sky-lift` | `#232A3A` | Dust band, corner lift, nebula washes |
| `slate-mid` | `#3A4254` → `#4A5468` | Planet shadow face, gear masses |
| `haze` | `#C7CDD6` → `#DDE1E6` | Limb fog, bright mist |
| `ivory` | `#EFEAE0` / `#F4F1EA` | Limb core, title ink, hero stars |
| `accent-mauve` | `#5E4A55` | ONE nebula patch, upper-left, near-desaturated |
| `accent-steel` | `#46617A` | ONE cold pocket, upper-left |
| `bar-black` | `#000000` | Letterbox bars only — the only pure black |
| `dial-ink` | `#E8ECEF` | Plate II line-work, 80–90% opacity |

### 1.2 Laws

- **Whites are never white.** Warm ivory only, `#F2EEE6` ± a little. `#FFFFFF` is forbidden
  inside the picture. The warm white is the entire warm budget of the piece — it is what keeps
  the frame from feeling clinical.
- **Darks are never pure black inside the picture.** The darkest sky is `#0B0E16`. Pure black
  exists only in the letterbox bars.
- **Saturation stays low everywhere.** Accents appear as 10–15% luminance *washes* within the
  indigo family, feathered, never as colored shapes.
- **The grade develops.** Plate I gains +5–10% global luminance across its 12 s hold — a
  darkroom print developing. This is a timed luminance ramp, not an exposure flicker.
- Banding is a color crime: the near-black sky gradient must be dithered.

---

## 2. TYPOGRAPHY

Type is **ink laid on the plate**: flat fills, no gradients, no bevels, no drop shadows.
Its only effect is a soft backlit-vellum bloom (10–20 rpx halo, low intensity).

### 2.1 The title — "EPHEMERA"

- **Classification:** Didone display serif (Didot/Bodoni character). Web face:
  **Playfair Display** (or Bodoni Moda). Caps only.
- **Doctrine — a scatter, not a word.** The eight letters have **mixed optical sizes and an
  undulating baseline**, rising and falling like notes on a staff, like an unfolded
  constellation. This is the signature of the piece. A centered, single-baseline, evenly
  tracked title is a failure of the whole project.

Per-letter spec (cap height in rpx / %PH; baseline offset from the block's mean line):

| Letter | Cap height | Baseline | Tracking after (× cap) | Arrival cue (s) | Resting opacity |
|---|---|---|---|---|---|
| E | 200 / 24.7% | 0 | 0.35 | 0.4 | 1.00 |
| P | 120 / 14.8% | +38 low | 0.55 | 2.1 | 0.85 |
| H | 160 / 19.8% | −30 high | 0.45 | 1.2 | 0.95 |
| E | 110 / 13.6% | +35 low | 0.75 | 2.6 | 0.82 |
| M | 200 / 24.7% | −35 high | 0.30 | 0.0 | 1.00 |
| E | 110 / 13.6% | +40 low | 0.65 | 1.8 | 0.88 |
| R | 140 / 17.3% | +8 | 0.50 | 0.9 | 0.92 |
| A | 130 / 16.0% | +22 dipping | — | 1.5 | 0.90 |

- Letters are **upright** — no rotation, no per-letter tilt.
- Block spans **39% PW (750 rpx)**, optical center at **(50% PW, 48–50% PH)** — centered in
  the dark valley between the two bodies, not mechanically in the frame.
- **Arrival:** opacity-only fades, **1–2 letters per 0.5 s in the irregular order above**,
  across ~2.5–3 s. No fly-ins, no scale pops, no blur trails, no letterspacing animation,
  no glow ramp-ups. A letter fades to ~90% and *stays* — the imperfection is kept.
- **Stars live on the type:** one 4-point sparkle sits inside the small E after M, one on the
  A. They twinkle in place, anchored to the letterforms — type as constellation.

### 2.2 The credit — "Aethoro ft. xia"

- **Old-style italic serif** (Garamond/Caslon character). Web face: **Cormorant Garamond
  Italic**.
- Cap height **2.5% PH (20 rpx)** — deliberately near the legibility floor.
- ~85% opacity, minimal bloom, normal tracking. Centered at **49.5% PW**, baseline
  **65% PH** — a touch left of the title's own center. Deliberate off-axis quirk; keep it.
- Fades in ~0.5 s after the last letter settles. Quiet in, no out.

### 2.3 The lyric — "I'm not alone"

- Old-style serif lowercase (Cormorant Garamond), **x-height 1.6% PH (13 rpx)**,
  **letterspaced 0.4–0.5 em**, near-white ~90% opacity, no glow, no background.
- **Set inside the bottom black bar** — dead-center, baseline at ~46% of the bar's height.
  Type never sits over artwork. In the web experience all captions/lyrics inherit this
  "cinema subtitle" treatment.

### 2.4 The numerals (Plate II)

- Roman capitals I–XII, classical proportions (Trajan character; web face **Cinzel**),
  rendered as **hollow outline strokes** — 1–2 rpx line weight regardless of numeral size,
  slight bloom, transparent interiors.
- Placed **by geometry, not layout**: every hour position, tangent-rotated to the rim,
  perspective-scaled — near numerals 12–16% PH (100–130 rpx), far numerals compressing to
  7–9% PH (60–70 rpx). They are clock parts, not a text block.
- Never filled, never bolded, never 3D-extruded.

---

## 3. COMPOSITION

Asymmetry is structural. **The center is earned, not defaulted.**

### 3.1 Plate I — the valley

- **Lower-left weight:** a vast planet limb cresting at **45–48% PW, 48–52% PH** — a gentle
  arc (sagitta ≈200 rpx across the full width; implied radius ≈2,400 rpx). Its shadowed,
  mottled face fills everything below.
- **Upper-right counterweight:** a second, larger moon entering from the right edge early in
  the shot, drifting toward upper-center over ~15 s. Dark face toward us, lit crescent on its
  lower-left rim — lit by the *same* key as the planet (consistency is mandatory).
- **Between them:** a lens-shaped valley of dark, near-empty sky — the darkest band in the
  frame — and that is where the title sits. The title is modest on purpose: 39% PW for the
  title card of the entire piece. Small type, huge sky. Fashion-plate confidence.
- The sky gradient **pools darkest behind the title** and lifts +8–12 luminance toward the
  dust band and corners.

### 3.2 Plate II — the mandala

- A perfect circle seen in foreshortening: dial ellipse **>104% PW** (rim runs off both
  edges), minor/major aspect **0.48**, centered slightly low.
- The figure — **11% PH (90 rpx) tall** — stands at the exact pivot, at **(48.7% PW, 46.3%
  PH)**. At the emotional climax she is the smallest element in the piece. Scale does all the
  work; do not enlarge her, do not cut closer.
- Radial symmetry is *broken* deliberately: fog mass bottom-left, moon limb top-left corner,
  gear-silhouette mass upper-right, and the frame crop itself.
- The dashed chart lines cross the dial at their own angles — two flat spaces (star chart and
  clock face) layered without reconciling perspective. This is correct; keep it.

### 3.3 The frame

- **2.35:1 picture inside the window, always.** Bars ≈12% / 13% of window height at 16:9.
  Never crop, never stretch, never open the ratio for convenience.
- A **soft elliptical vignette** darkens all four corners: smooth falloff over 150–250 rpx
  (8–13% PW), strongest in corners, no hard edge — the frame reads as a porthole / glass-plate
  negative. **Never** a drawn border, rounded rectangle, corner brackets, or HUD ticks.

---

## 4. NEGATIVE SPACE

**The emptiness is the luxury. Do not fill it.**

- Nothing comes within **13% PW (250 rpx)** of the title letterforms except chart dashes and
  a few pinprick stars.
- The upper-left sky of Plate I stays almost empty even as the moon fills the right.
- The dial interior of Plate II is mostly empty dark sky — the largest continuous void in
  either plate (the whole upper-right interior). The figure's smallness is legible *because*
  of this void.
- Empty regions are **not dead**: the dust band and dashed lines give them just enough
  structure to feel held. Empty ≠ unfinished; empty = composed.
- Star placement must include **genuinely empty patches** between clusters (see §11).

---

## 5. DEPTH

Depth is **flattened and printed**, not fly-through.

- **Telephoto vista:** narrow field (~24°), body edges are broad gentle arcs, no wide-angle
  drama, no distortion beyond the vignette.
- Plate I layer stack, back → front:
  1. indigo sky gradient (darkest top-center) · 2. galactic dust band behind the title ·
  3. pinprick stars · 4. dashed chart lines · 5. hero sparkle stars · 6. upper-right moon ·
  7. limb haze band · 8. planet body · 9. bottom fog veil · 10. typography ·
  11. vignette + letterbox.
- Plate II layer stack: sky · nebula + stars · moon limb (top-left) · gear silhouettes
  (upper-right) · chart lines · dial line-art · hands · figure + foot wisp · fog banks
  (some *in front of* the dial's near rim) · letterbox + lyric.
- **Depth cues are luminance and haze, not motion.** Stars dim and dissolve as they approach
  the limb fog; the planet's face dissolves into its own veil; the second moon's dark disc is
  separated from the sky by only Δ5–8% value — felt, not seen.
- The clock is a **transparent annotation layer**: the cosmos shows through the dial, the
  hands, and the numerals. No occlusion beyond the 1–2 rpx strokes, no fill, no shadow, no
  refraction.

---

## 6. MATERIALS

The material canon is **paper, ink, glass, mist**. Nothing else. No metal, no chrome, no
plastic, no wet-CG surfaces.

| Element | Material read | Rules |
|---|---|---|
| Planets / moon | **Watercolor on wet paper** | Soft blended blooms, granular crater texture, mottled like a hand-tinted moon. No crisp surface contours, no specular, no NASA imagery, soft smoky terminator (never a hard day/night line). |
| Sky | **Matte paper with tooth** | Fine film/paper grain over everything, low amplitude — felt material, not a visible overlay. |
| Stars | **Engraved ink** | Pinpricks are ink dots; hero stars are *engraved 4-point sparkles* — thin cross flares, not lens-flare discs, not glowing orbs. |
| Chart lines | **Fine-liner pen on plate** | 1 rpx, slightly *uneven* dash lengths — hand-ruled, never machine-perfect, never vector-crisp. |
| Title / credit | **Luminous ivory ink** | The glow of backlit vellum, never a neon sign. |
| Dial / hands / numerals | **Etched glass / engraving** | Pure line, transparent interior, faint bloom as engraved lines catch light. |
| Fog | **Cotton / frosted diffusion** | Soft but with *internal structure* — billows, drift streaks. Never a flat gradient, never cloud-stock. |
| Gears (silhouettes) | **Cut paper / watercolor** | Matte near-black shapes with circular voids; granulation in the pre-dissolve beat, flat blacks after. |
| Figure | **Painted anime-style** | Ivory hair catching the light, dark dress near-silhouette, small cloud wisp at her feet. |

---

## 7. LIGHTING

**One implied key per plate. Nothing else emits.**

- **Plate I:** a sun behind/below the planet's left limb. It motivates exactly four things:
  the brilliant limb line, the fog band scattering above it, the crescent on the upper moon
  (same lower-left direction — check this), and nothing else. The sky is starlit ambient; the
  title is self-luminous ink at low intensity.
- **Plate II:** moonlight from the top-left (the moon limb in that corner motivates it).
  It motivates: the fog's brightest region (lower-left → bottom), the figure's ivory hair,
  the gentle value gradient across the dial (brighter near fog, darker upper-right), the
  soft wisp shadow under her feet.
- **No** cast shadows, **no** rim lights, **no** moving lights, **no** light sources added
  for drama. Line-art and type are self-luminous — etched-glass glow — at low, even
  intensity.
- **Bloom discipline:** every halo is 10–20 rpx (0.5–1% PW), low intensity, and motivated
  (limb, stars, ink). Nothing blooms to white-out. If an element has an "effect" the scene
  doesn't justify, remove the effect.
- Global luminance swells **+5–10% over 12 s** on Plate I — the developing print.

---

## 8. ATMOSPHERE

Haze is always soft-edged and always **physically motivated** by the key light.

1. **Limb band (Plate I):** the brightest element after the limb itself — a fog blanket
   12–18.5% PH deep above the planet's edge. Any star approaching it dims and dissolves.
2. **Face veil:** the planet's shadowed face progressively brightens toward the bottom of
   frame; surface texture dissolves into fog.
3. **Galactic dust:** a faint unresolved star-band behind the title — a 10–15% luminance
   lift, feathered, arcing through the title zone. Astronomical-scale haze.
4. **Veiling glare:** blacks lift near the bottom of frame as light scatters in the "lens" —
   this is what makes it a wet-plate photograph. Keeping blacks crushed everywhere loses the
   reference immediately.
5. **Plate II fog (the expressive lead):** a deep bank occupying the bottom third at entry,
   **thickening and rising over a 5–10 s crescendo**, progressively submerging the dial's
   near rim — the clock swallowed by cloud as time ends. Thin translucent wisps also cross
   mid-frame over the glass. Behavior: slow lateral drift + vertical rise, feathered edges,
   internal billow, brightest where the moonlight lands.

---

## 9. CAMERA

- **Locked. No handheld breath, no reframe, no dolly, no zoom — for the entire experience.**
  The only "camera event" is the 1–1.5 s **cross-dissolve** between plates (the MV's
  signature transition, used instead of cuts at emotional turns). No whip pans, no speed
  ramps, no cuts.
- Plate I: deep-space vantage at infinity — the telephoto flattened vista.
- Plate II: high oblique overhead, ~30–40° above the dial plane, figure nearly beneath the
  camera; far rim compresses, near rim runs out of frame.
- The user is never given camera control. No orbit, no pan, no zoom — the locked lens *is*
  the aesthetic. (Interaction budget lives in §12, and none of it moves the camera.)

---

## 10. MOTION

**Only the heavens move, and slowly.** The motion hierarchy is a strict ration list — what is
*allowed* to move, at what speed, in what manner:

| Tier | What | Speed / period | Manner |
|---|---|---|---|
| **Locked (0)** | Title, credit, lyric, figure's position, vignette, letterbox | — | Perfectly still |
| **Plate drift** | Stars, dust, dashes, both moons, planet, dial, numerals | **0.52% PW/s (10 rpx/s) leftward, constant** | One plate, one speed. Imperceptible frame-to-frame, unmistakable over 5 s |
| **Slow ramps** | Global luminance (+5–10% over 12 s); limb fog thickening; Plate II fog rise (5–10 s); hand creep (~0.3–0.6°/s) | 5–12 s scales | Monotonic crescendos |
| **Micro-cycles** | Star twinkle (1–2 s, desynchronized); per-letter fade-in (arrival window only); figure's hair/cloth idle; wisp billow | 1–2 s | Gentle sinusoids |
| **Transition** | Plate I → Plate II | 1–1.5 s | Cross-dissolve only |

Laws of manner:

- **Constant velocity.** Nothing accelerates, nothing decelerates, nothing eases. No easing
  theater on any drift, ever.
- **No parallax layers.** One plate speed (see TECHNICAL_PLAN §3 — screen-space-uniform
  drift with per-depth compensation).
- **No free-floating particles.** No drifting dust, no motes, no snow, no falling sparkle
  magic. Stars do not move relative to the plate. The only "particle" behavior is **twinkle**:
  a few hero stars at a time pulsing over 1–2 s — slight scale (0.9–1.1×) and cross-flare
  gain/loss, desynchronized.
- **Rhythm:** one held breath per plate. Plate I is a single 14+ s shot: bare sky → letters
  scatter in → long hold with drift, twinkle, swell. Plate II: dissolve-in → meditative hold →
  fog submersion. The slowness is structural; do not "improve" the pacing.

---

## 11. DETAIL DENSITY

Rationing table — hard caps, measured per frame:

| Element | Budget | Distribution |
|---|---|---|
| Pinprick stars (1–2 rpx) | 100–200 | Clustered: 2–4 tight asterism groupings with **genuinely empty patches** between. Never uniform, never tiled, no repetition visible |
| Mid soft stars (2–4 rpx) | 40–60 | Same grammar |
| Hero sparkle stars (10–20 rpx flares) | **4–8** (Plate I) / 6–10 (Plate II) | Over the dark upper half; a few *inside* the dial interior (sky through glass); 1–2 pinned to title letterforms |
| Dashed chart segments | 6–10 | Straight dashes at assorted angles (≈ −10°, −30°, +25°, one near-vertical), long-dash (20/12 rpx) and dotted (4/6 rpx) mixed, plus arcs following limb curvature; opacity 25–45%; lines intersect at shallow angles forming **open** triangles around the title — never closed webs |
| Celestial bodies | 2 per plate | — |
| Figure | 1 | 11% PH tall |
| Numerals / hands | 12 / 2 | By geometry |
| Hues | 2 families + 2 whispers | — |

- Density **falls off near haze**: stars dim and dissolve into the limb fog and the dial's
  glass sheen.
- If a bright thing appears, it must mean something. The rarity of light *is* the premium
  read.

---

## 12. INTERACTION

The interaction model is **a glass slide held up to the light**. Every affordance obeys the
motion doctrine: presence without event. Nothing may move fast because the user acted.

1. **The film plays itself.** A master timeline auto-advances through
   overture → title → dissolve → clock → fog-swallow. Doing nothing is a complete experience.
2. **Scroll / touch = gentle scrub.** Wheel and drag map to timeline position through heavy
   damping (settle ≈1.2 s) and a velocity clamp, so even violent input produces at most a
   slow, glacial slide along the film. Scrubbing can never exceed ~3× nominal plate drift on
   screen.
3. **The cursor is light on glass.** Pointer position very subtly re-weights the grade: a
   local exposure lift of +2–3% within a soft elliptical falloff (~25% PW), and chart lines
   brighten by a few percent near the cursor — like tilting a plate toward a lamp. No object
   follows the cursor; no parallax responds to it.
4. **Hold to develop.** Press-and-hold (≥0.6 s) gently accelerates the luminance ramp (~4×,
   capped at the scene's end-of-shot exposure) — the developing-print metaphor made tactile.
   Release: the print keeps what it earned. Monotonic, never a snap-back.
5. **Attention rewards.** Hovering within ~40 rpx of a hero star shortens its twinkle period
   (~0.6×) — it answers you, quietly.
6. **Keyboard:** ← / → scrub (damped), Space pauses/resumes auto-advance.
7. **Forbidden:** click-spawned particles, camera control, zoom, drag-to-rotate, sound
   auto-play, any element that bounces, follows, or pops.
8. **Accessibility:** `prefers-reduced-motion` freezes plate drift and twinkle, keeps the
   dissolve slow, and replaces scrub inertia with direct positioning. The letterboxed picture
   and caption system remain as-is — they are the composition, not decoration.

---

## 13. The Forbidden List

Adding any of these is a failure of art direction, regardless of how well implemented:

- Saturated nebula color (magenta/cyan/teal HDR clouds), gradient-space synthwave washes.
- Lens flares, anamorphic streaks, light leaks, chromatic aberration passes.
- Drifting particle fields, dust motes, falling sparkle magic.
- Kinetic typography: fly-ins, blur-tracks, bounce, typewriter, glow ramp-ups.
- A visible frame/UI: rounded-rect borders, corner brackets, HUD ticks, hard vignette masks.
- Chart lines brighter than ~45% opacity, machine-perfect dashes, closed geometric webs,
  more than ~10 segments.
- Filled/bold/3D clock numerals; solid dials; refraction on the glass.
- Metallic or 3D-rendered gears; NASA-texture planets; crisp terminators; specular oceans.
- Uniform or tiled starfields; visible "star brush" repetition.
- Centered single-baseline oversized title with heavy glow and drop shadow.
- Glow on every shape; bloom without motivation.
- Five-layer parallax at five speeds.
- Fog as a white gradient rectangle.
- Subtitles over artwork, karaoke-styled or animated.
- Heavy film scratches/dust/grunge grain.
- Easing pops on any drift; any acceleration or deceleration of the heavens.
- Symmetric default centering of every element.
- A fourth hue. A pure white. A pure black inside the picture.

---

## 14. Acceptance checklist

The plate is correct when:

- [ ] A 5-second still looks like a photograph of a print, and a 60-second watch reveals
      exactly one movement (drift), one crescendo (light/fog), and micro-twinkle.
- [ ] The title reads as a constellation scatter — letters of different sizes on an
      undulating baseline, uneven gaps, stars pinned to letterforms.
- [ ] The emptiest region of the frame is also the most beautiful.
- [ ] The second moon's dark face is barely separable from the sky (Δ5–8%).
- [ ] Dashes pass *under* the title and *through* the dial — the chart stitches type and
      instrument into one plate.
- [ ] The clock is transparent — sky visible through dial, hands, and numerals.
- [ ] The fog has billows and feathered edges, and by the end of Plate II it has swallowed
      the near rim.
- [ ] Pausing anywhere yields a frame you would print.
