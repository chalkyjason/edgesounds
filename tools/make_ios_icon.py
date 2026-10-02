"""Draw the Callsign FPV app icon and mark: a green squadron-patch shield with a quad on it.

Pixel art on a 64 x 64 grid, the OSD's own look, scaled up without smoothing.
The shield and the quad are the ``shield-heater`` and ``quad`` geometry from
tools/draw_shapes.py, so the icon uses only art this project owns.

    python tools/make_ios_icon.py web/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
    python tools/make_ios_icon.py --svg web/public/callsign-mark.svg
    python tools/make_ios_icon.py --wordmark assets/brand/callsign-fpv-wordmark.png
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from draw_shapes import Ring, circle, rect, rotate, rounded_rect  # noqa: E402

SIZE = 1024
GRID = 64
BACKGROUND = (0x09, 0x09, 0x0B)
GREEN = (0x00, 0xFF, 0x9D)
DARK = (0x0B, 0x3D, 0x2A)

Pixels = set[tuple[int, int]]


def heater(cx: float, top: float, width: float) -> Ring:
    """The heater shield outline, ``width`` across, its top edge at ``top``."""
    s = width / 100
    ring: Ring = [(0, 0), (100, 0), (100, 45)]
    ring += [(50 + 50 * math.cos(math.radians(a)), 45 + 72 * math.sin(math.radians(a))) for a in range(0, 91, 6)]
    ring += [(50 - 50 * math.cos(math.radians(a)), 45 + 72 * math.sin(math.radians(a))) for a in range(90, -1, -6)]
    return [(cx - width / 2 + x * s, top + y * s) for x, y in ring]


def quad_rings(cx: float, cy: float, size: float) -> list[tuple[list[Ring], bool]]:
    """The FPV pack's quad, as (rings, evenodd) paths, ``size`` across."""
    s = size / 100
    def at(ring: Ring) -> Ring:
        return [(cx + (x - 50) * s, cy + (y - 50) * s) for x, y in ring]
    arm = [(x + 50, y + 50) for x, y in rect(-6, -50, 12, 100)]
    paths: list[tuple[list[Ring], bool]] = []
    for px, py in ((20, 20), (80, 20), (20, 80), (80, 80)):
        paths.append(([at(circle(px, py, 22)), at(circle(px, py, 15))], True))
    paths.append(([at(rotate(arm, 50, 50, 45))], False))
    paths.append(([at(rotate(arm, 50, 50, -45))], False))
    paths.append(([at(rounded_rect(36, 30, 28, 40, 6))], False))
    return paths


def fill(rings: list[Ring], evenodd: bool) -> Pixels:
    """Pixels whose centres are inside, by the path's fill rule."""
    out: Pixels = set()
    for py in range(GRID):
        y = py + 0.5
        for px in range(GRID):
            x = px + 0.5
            winding = crossings = 0
            for ring in rings:
                for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1], strict=True):
                    if (ay <= y < by or by <= y < ay) and ax + (y - ay) * (bx - ax) / (by - ay) > x:
                        crossings += 1
                        winding += 1 if by > ay else -1
            if (crossings % 2 == 1) if evenodd else winding != 0:
                out.add((px, py))
    return out


def inset(pixels: Pixels, by: int) -> Pixels:
    """The pixels at least ``by`` away (8-neighbour) from the shape's edge."""
    shrunk = pixels
    for _ in range(by):
        shrunk = {(x, y) for x, y in shrunk if all((x + dx, y + dy) in shrunk for dx in (-1, 0, 1) for dy in (-1, 0, 1))}
    return shrunk


def layers() -> list[tuple[Pixels, tuple[int, int, int]]]:
    shield = fill([heater(32, 5, 46)], False)
    stitch_outer = inset(shield, 3)
    stitch = stitch_outer - inset(stitch_outer, 1)
    # A dashed stitch line, like an embroidered patch.
    stitch = {(x, y) for x, y in stitch if (x + y) % 3 != 0}
    quad: Pixels = set()
    for rings, evenodd in quad_rings(32, 28.5, 29):
        quad |= fill(rings, evenodd)
    return [(shield, GREEN), (stitch, DARK), (quad, BACKGROUND)]


def draw_icon() -> Image.Image:
    image = Image.new("RGB", (GRID, GRID), BACKGROUND)
    px = image.load()
    for pixels, colour in layers():
        for x, y in pixels:
            px[x, y] = colour
    return image.resize((SIZE, SIZE), Image.Resampling.NEAREST)


def draw_svg() -> str:
    """The mark alone, transparent, one rect per run of pixels: for headers and favicons."""
    rows: dict[int, dict[int, tuple[int, int, int]]] = {}
    for pixels, colour in layers():
        for x, y in pixels:
            rows.setdefault(y, {})[x] = colour
    parts = []
    for y, row in sorted(rows.items()):
        xs = sorted(row)
        start = xs[0]
        for i, x in enumerate(xs):
            nxt = xs[i + 1] if i + 1 < len(xs) else None
            if nxt == x + 1 and row[nxt] == row[x]:
                continue
            colour = row[x]
            if colour != BACKGROUND:
                parts.append(f'<rect x="{start}" y="{y}" width="{x - start + 1}" height="1" fill="#{colour[0]:02x}{colour[1]:02x}{colour[2]:02x}"/>')
            start = nxt if nxt is not None else start
    # Trim to the shield's own box.
    ys = [y for pixels, _ in layers()[:1] for _, y in pixels]
    xs = [x for pixels, _ in layers()[:1] for x, _ in pixels]
    box = f"{min(xs)} {min(ys)} {max(xs) - min(xs) + 1} {max(ys) - min(ys) + 1}"
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box}" shape-rendering="crispEdges">{"".join(parts)}</svg>\n'


def draw_wordmark(scale: int = 4) -> Image.Image:
    """The mark beside CALLSIGN FPV in the splash stencil letters, BY ARMY JAY under: transparent PNG."""
    import json

    stencils = json.loads((Path(__file__).resolve().parent.parent / "assets" / "splash_stencils.json").read_text())

    def lettering(text: str, font: str, k: int = 2) -> list[str]:
        """The text in a stencil font, every pixel k x k, so it sits beside the full-size mark."""
        glyphs = [stencils[font]["glyphs"][ch] for ch in text]
        rows = ["..".join(row) for row in zip(*glyphs, strict=True)]
        return ["".join(ch * k for ch in row) for row in rows for _ in range(k)]

    big = lettering("CALLSIGN FPV", "big")
    small = lettering("BY ARMY JAY", "small")
    mark = layers()
    mark_xs = [x for x, _ in mark[0][0]]
    mark_ys = [y for _, y in mark[0][0]]
    mx0, my0 = min(mark_xs), min(mark_ys)
    mark_w, mark_h = max(mark_xs) - mx0 + 1, max(mark_ys) - my0 + 1
    pad, gap, line_gap = 3, 10, 6
    text_h = len(big) + line_gap + len(small)
    text_x = pad + mark_w + gap
    width = text_x + max(len(big[0]), len(small[0])) + pad
    height = max(mark_h, text_h) + 2 * pad
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    px = image.load()
    mark_top = (height - mark_h) // 2
    for pixels, colour in mark:
        for x, y in pixels:
            px[x - mx0 + pad, y - my0 + mark_top] = (*colour, 255)

    def ink(rows: list[str], x0: int, y0: int, colour: tuple[int, int, int]) -> None:
        on = {(x0 + x, y0 + y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch == "#"}
        reach = range(-2, 3)  # a 2 px outline, one stencil pixel at 2x
        halo = {(x + dx, y + dy) for x, y in on for dx in reach for dy in reach} - on
        for x, y in halo:
            px[x, y] = (0, 0, 0, 255)
        for x, y in on:
            px[x, y] = (*colour, 255)

    top = (height - text_h) // 2
    ink(big, text_x, top, (255, 255, 255))
    ink(small, text_x, top + len(big) + line_gap, GREEN)
    return image.resize((width * scale, height * scale), Image.Resampling.NEAREST)


def main(argv: list[str]) -> int:
    if len(argv) == 3 and argv[1] == "--wordmark":
        out = Path(argv[2])
        out.parent.mkdir(parents=True, exist_ok=True)
        draw_wordmark().save(out, format="PNG")
        print(f"[make_ios_icon] {out} (wordmark)")
        return 0
    if len(argv) == 3 and argv[1] == "--svg":
        out = Path(argv[2])
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(draw_svg())
        print(f"[make_ios_icon] {out} (SVG mark)")
        return 0
    out = Path(argv[1])
    out.parent.mkdir(parents=True, exist_ok=True)
    draw_icon().save(out, format="PNG")
    print(f"[make_ios_icon] {out} ({SIZE}x{SIZE}, no alpha)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
