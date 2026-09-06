# EPHEMERA — cinematic WebGL plates

A locked-lens astronomical-plate experience (VISUAL_BIBLE.md, TECHNICAL_PLAN.md,
reference-analysis.md). Vite + TypeScript + Three.js + GLSL. No OrbitControls,
no EffectComposer, no easing libraries — one plate, one speed, rationed light.

## Run

```
npm install
npm run dev          # http://127.0.0.1:5173
npm run build        # tsc --noEmit && vite build → dist/
```

## Experience

Doing nothing is the complete film (~46 s): bare sky → the EPHEMERA scatter
fades in over the valley (Playfair, per-letter baseline scatter in DOM) →
cross-dissolve to the clock dial (Plate II) → fog rises to swallow the near
rim. Wheel/touch/arrows scrub with heavy damping; Space pauses; press-and-hold
≥0.6 s accelerates the developing-print exposure; the cursor is light on glass
(local grade lift + chart brightening + hero-star twinkle answers).
`prefers-reduced-motion` freezes drift/twinkle and makes scrubbing direct.

## Architecture (src/)

```
core/    Clock (master time + damped scrub), Scrub, CursorLight, QualityMonitor,
         uniforms (the single per-frame uniform block shared by all materials)
stage/   StageManager (fixed 2.35:1 picture + CSS units), TitleCard (canvas
         raster letters + pinned sparkles), Captions (lyric + replay)
plates/  PlateBase (locked camera + one plate-drift rig), PlateI (The Valley),
         PlateII (The Hour), shared/ (SkyDome, Stars, HeroStars, ChartLines,
         Celestial, LimbFog, Veil, FogSheets, Gears, Dial, Figure)
fx/      Compositor — plate render(s) → bright-pass → separable blur → final
         grade quad (dissolve/bloom/glare/exposure/vignette/grain/dither/bars)
shaders/ GLSL chunk library
data/    art.ts — the authored placement data (editable parameters)
```

## Editable parameters / review tooling

- `ART` (src/data/art.ts) holds all authored placement + palette + timing;
  every value maps to a Bible number or reference measurement.
- URL overrides: `?t=13` seeks; `?v=8` changes drift; `?m=1` forces reduced
  motion; `?k={"plateII":{"dial":{"R":1250}}}` deep-merges ART at boot;
  `?grab=24` captures the WebGL frame on frame 24 into `window.__EPH.shot`;
  `?raw=1` bypasses the compositor (plate scene straight to canvas).
- `window.__EPH` in DevTools: `art`, `U`, `clock`, `quality`, `seek(t)`,
  `pause(v)`, `review()` (ASCII luminance map of the last shot), `map(x0,y0,…)`.

## Verification artifacts

`shots/` contains browser-captured frames (valid PNGs, rendered and read back
through WebGL in headless Chrome; `tools/` holds the capture/diagnostic scripts
used during development — pngstat/cdp review utilities).
