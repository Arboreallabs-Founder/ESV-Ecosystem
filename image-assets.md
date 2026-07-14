# Image Assets — Spec for Generation

This file is a work order for an image-generation agent/tool. Each section below is one asset
request. Once a deliverable lands at its **source path**, tell me and I'll resize/wire it into the
app at its **implementation path** — don't touch app code yourself, just drop the file.

---

## 1. Favicon — simple sapling mark

### Why
The current favicon (`src/app/icon.png`) is a detailed, photographic/complex mark copied straight
from a 1254×1254 source image. It's too busy — at browser-tab size (16–32px) it just reads as
mud. Replace it with something radically simpler: **a small sapling**.

### Brand constraints (must follow)
Source of truth: `earlyseed_ventures_brand_guidelines.md` and `color-scheme.md` in this repo.
- **No generic green plant colors.** The brand guidelines explicitly reject the "green plant =
  growth" cliché in favor of the earthy/purple palette. The sapling must be rendered in brand
  colors, not naturalistic green.
- **Recommended treatment:** a solid **Purple `#745FFD`** rounded-square background (this matches
  the existing in-app logo mark — see `.logoMark` in `src/app/app-shell.module.css`, the small
  purple square with a white glyph in the sidebar header) with a **white or off-white (`#F7ECE2`
  Crema)** sapling silhouette on top. High contrast, reads clearly at tiny sizes.
  - Acceptable alternative: transparent background, sapling silhouette in solid Purple `#745FFD`
    or Slate `#A39B95` — only if the solid-background version doesn't work out visually.
- **No gradients, no fine detail, no drop shadows.** Flat shape(s) only — one or two colors max.
- **No text/wordmark.** Illegible at favicon size; glyph only.
- **Concept:** a small, simplified sapling — a short stem with 1–3 simple leaf shapes. Think
  "reduced to its silhouette" — the kind of mark that's still identifiable as a plant/seedling at
  16×16px, not a botanically detailed illustration. This nods to "Earlyseed" (the seed/sprout of a
  company that grows into something bigger) without leaning on a literal green-leaf cliché.

### Technical spec
- **Format:** PNG, square canvas, transparent corners if using the rounded-square background
  approach (i.e. the rounded-square shape itself, not a hard-edged full-bleed square).
- **Master size:** 512×512px (don't go bigger — this isn't a print asset, and the previous 1254px
  source made for a needlessly heavy 1MB file for something that only ever displays at ≤32px).
- **File size target:** under 100KB. A flat, 1–2 color, low-detail shape should comfortably hit
  this — if the export is much bigger, simplify further rather than compress harder.
- **No embedded metadata/color profiles beyond standard sRGB.**

### Naming & paths
- **Source/master file (deliver here):** `public/ecosystem-favicon-sapling.png`
- **Implementation path (I'll handle this):** `src/app/icon.png` — Next.js's App Router
  auto-detects this convention filename and generates the `<link rel="icon">` tag site-wide, no
  code changes needed beyond replacing the file. I'll resize/copy the master into place once it's
  ready.

---

## General conventions for future asset requests in this file

- **Source assets** (masters, originals) always live in `public/`, named descriptively in
  kebab-case: `ecosystem-<purpose>-<variant>.png` (e.g. `ecosystem-favicon-sapling.png`,
  `ecosystem-logo-mark.svg`).
- **Implementation paths** are wherever Next.js conventions or the specific feature expects the
  file (e.g. `src/app/icon.png` for the favicon, `src/app/apple-icon.png` for iOS home-screen
  icons if we ever add one). I own moving/resizing source assets into these — the generation step
  only needs to produce the source file at its stated path.
- Always render against the ESV brand palette (`color-scheme.md`) — no off-palette colors unless a
  request explicitly says otherwise.
- Prefer PNG for raster marks, SVG for anything that needs to scale losslessly (the favicon
  doesn't strictly need SVG since Next's icon convention wants a raster file, but note it here if
  a future asset would benefit from a vector source too).
