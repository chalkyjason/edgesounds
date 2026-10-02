# Emblem layers: build a start screen from stacked shapes

**Date:** 2026-10-02
**Status:** approved in conversation; written as the record
**Scope:** the start screen page (`/osd/splash`), a shape library, a Credits page
**Follows:** [start screen maker](2026-10-01-start-screen-maker-design.md)

## Context

The start screen maker builds Betaflight's 288 × 72 boot splash from one
base -- a text template or an image -- with a paint layer of touch-ups on
top. Pilots want to make their own emblems the way Call of Duty players
build emblems: stack shapes, move, resize, rotate and recolour each one.

Paid add-on packs were raised too. They are a separate project (StoreKit,
App Store paid-app setup, a website policy, a privacy update) with its own
design. This project only organises shapes into packs so locking some later
is a small change.

## Decisions

| Decision | Choice |
|---|---|
| Model | The base becomes **one stack of layers**: shapes, text and the image are all layers. Paint stays as touch-ups on top. |
| Library | **~90 shapes in packs**, military-leaning, from every legal source: our own drawings (MIT), game-icons.net (CC BY 3.0), Tabler Icons (MIT). |
| Controls | **Drag to move, pinch to resize, twist to rotate** on the preview, plus size and rotation sliders, 1 px nudges and flips. |
| Appearance | Each layer: **fill white or black**, optional **1 px outline** in the opposite colour, mode **Normal** or **Cut out** (clears what is below). |
| Designs | **One working design** plus **6–8 starter emblems** to start from. |
| Rendering | **Shapes are vector polygons rasterized by our own code**, not the browser's canvas: identical pixels on the iPhone and the web, and testable in Node. |

## Layers

```ts
interface LayerBase {
  id: string
  x: number; y: number      // centre, raster px
  size: number              // px of the layer's larger dimension
  rotation: number          // degrees, clockwise
  flipX: boolean; flipY: boolean
  fill: 'white' | 'black'
  outline: boolean          // 1 px, the opposite colour
  mode: 'normal' | 'cutout'
  visible: boolean
}
type Layer = LayerBase & (
  | { kind: 'shape'; shape: string }                 // a shape id from shapes.json
  | { kind: 'text'; text: string; font: 'big' | 'small' }
  | { kind: 'image' }                                // the design's one image
)
```

At most **32 layers**.

## Rendering

Onto a clear 288 × 72 raster, bottom layer first:

1. **Mask.** A shape's polygons are flipped, scaled to `size`, rotated and
   moved to `(x, y)`, then filled by testing each pixel centre (nonzero or
   even-odd, per path; a shape's paths are OR-ed). Text (stencil rows) and
   the image (thresholded at its fitted size) are bitmaps: each output pixel
   centre is mapped back through the inverse transform and samples the
   bitmap, so they rotate too. At scale 1 and no rotation the mapping is
   exact.
2. **Normal:** the outline (`outlineMask`, as the fonts use) is drawn in the
   opposite colour, then the fill. **Cut out:** the mask's pixels become
   transparent.
3. **Paint** overrides apply last.

Masks are cached per layer and rebuilt only when that layer changes, so a
gesture recomposes in well under a millisecond.

## Shape library

`assets/shapes/<pack>/*.svg` and `assets/shapes/packs.json` (per pack: name,
author, licence, source URL; per game-icons shape, its author).
`web/scripts/build-shapes.mjs` flattens each SVG with `svgpath` (MIT) --
arcs to curves, curves to line segments, simplified -- centres it, scales
it so its larger side is 1, and writes `public/osd/shapes.json`. It runs
with the existing OSD asset staging before dev and build.

| Pack | Source | Licence |
|---|---|---|
| Basics | ours | MIT |
| Insignia | ours | MIT |
| Military | game-icons.net | CC BY 3.0 |
| FPV | ours | MIT |
| Symbols | Tabler Icons (filled) | MIT |

Two shapes reproduce today's template rules exactly (`rule-chevrons`,
`rule`), so old designs convert pixel for pixel.

A **Credits** page (`/credits`, linked from the footer) lists every pack, its
author(s) and licence: CC BY requires attribution.

## Editor

Tabs **Layers** and **Paint**. Layers: the list (top first; thumbnail,
name, eye, ↑ ↓), Add Shape (library sheet: pack tabs, search, thumbnails),
Add Text (big or small), Add Image (one); Duplicate, Delete, To front, To
back. The selected layer's controls: size and rotation sliders (rotation
snaps at 0/45/90°), nudge ←↑↓→, flips, fill, outline, mode; text adds the
text box, the image adds threshold and invert.

On the preview: tap selects the topmost layer under the finger; one finger
drags, pinch resizes, twist rotates. Mouse: drag, wheel to resize, Shift +
wheel to rotate. Keyboard: arrows nudge, Delete removes.

**Undo** covers layers and paint in one history (`lib/history.ts`): a
gesture or slider drag is one step; add, delete, reorder and toggles are one
step each.

**Starters:** "Start from…" offers 6–8 emblems built from library shapes and
a CALLSIGN text layer. Picking one confirms before replacing a non-empty
design.

## Storage and migration

The `splash` record gains `version: 2`, `layers`, `image` (source and
threshold/invert) and keeps `paint`. A version-1 record converts on load:
the text template's lines become text layers at the template's positions
and its rules become the two rule shapes -- pixel-identical, tested -- and
an image becomes one image layer (its outline setting carries over; a black
background becomes a black rectangle layer beneath it).

## Errors

- `shapes.json` fails to load: the library shows the error and a retry; text,
  image and paint still work.
- A layer naming a missing shape: kept, marked "Shape not found", not drawn.
- 32 layers: the Add buttons disable and say why.
- A layer moved entirely off screen: kept, marked "Off screen", with Centre.

## Testing

Unit (Node): SVG flattening, both fill rules, the rasterizer (square, rotated
square, flips, even-odd ring, sub-pixel shapes), bitmap transform exactness,
layer order with outline and cut-out, v1 → v2 migration pixel-identical to
`renderTemplate`, undo grouping. Build checks: every pack has licence and
author, every shape a pack, no empty polygons. Browser (WebKit, scripted):
gestures, sliders, undo per gesture, starters, export, on the iPhone build.

## Out of scope

Paid packs and purchases; a gallery of saved designs; layer groups; colours
beyond white, black and clear; the in-flight craft-name logo.
