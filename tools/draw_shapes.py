"""Draw the shapes Army Jay owns outright: the Basics, Insignia and FPV packs.

Writes one SVG per shape to assets/shapes/<pack>/. The web build
(web/scripts/build-shapes.mjs) flattens every SVG under assets/shapes/ into
public/osd/shapes.json, so these files are the source of truth and this
script only exists to make them reproducible and easy to adjust.

Every shape is plain polygons. A path with ``evenodd`` cuts its inner rings
out as holes; separate paths are OR-ed together by the rasterizer.

    python tools/draw_shapes.py
"""

from __future__ import annotations

import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "shapes"

Point = tuple[float, float]
Ring = list[Point]


# -- primitives --------------------------------------------------------------


def circle(cx: float, cy: float, r: float, n: int = 64) -> Ring:
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def ellipse(cx: float, cy: float, rx: float, ry: float, n: int = 48) -> Ring:
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]


def rect(x: float, y: float, w: float, h: float) -> Ring:
    return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]


def regular(cx: float, cy: float, r: float, sides: int, rotation: float = -90) -> Ring:
    a0 = math.radians(rotation)
    return [(cx + r * math.cos(a0 + 2 * math.pi * i / sides), cy + r * math.sin(a0 + 2 * math.pi * i / sides)) for i in range(sides)]


def star(cx: float, cy: float, outer: float, inner: float, points: int) -> Ring:
    ring: Ring = []
    for i in range(points * 2):
        r = outer if i % 2 == 0 else inner
        a = -math.pi / 2 + math.pi * i / points
        ring.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return ring


def rounded_rect(x: float, y: float, w: float, h: float, r: float, n: int = 8) -> Ring:
    ring: Ring = []
    for cx, cy, start in ((x + w - r, y + r, -90), (x + w - r, y + h - r, 0), (x + r, y + h - r, 90), (x + r, y + r, 180)):
        for i in range(n + 1):
            a = math.radians(start + 90 * i / n)
            ring.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return ring


def arc_band(cx: float, cy: float, r_out: float, r_in: float, a0: float, a1: float, n: int = 32) -> Ring:
    """A thick arc between angles a0..a1 degrees (0 = right, 90 = down)."""
    outer = [(cx + r_out * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r_out * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
    inner = [(cx + r_in * math.cos(math.radians(a1 - (a1 - a0) * i / n)), cy + r_in * math.sin(math.radians(a1 - (a1 - a0) * i / n))) for i in range(n + 1)]
    return outer + inner


def chevron(cx: float, top: float, half_width: float, arm: float, depth: float) -> Ring:
    """An upward-pointing chevron (^) of stroke thickness ``arm``."""
    return [
        (cx, top),
        (cx + half_width, top + depth),
        (cx + half_width, top + depth + arm),
        (cx, top + arm),
        (cx - half_width, top + depth + arm),
        (cx - half_width, top + depth),
    ]


def rotate(ring: Ring, cx: float, cy: float, degrees: float) -> Ring:
    a = math.radians(degrees)
    c, s = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in ring]


def mirror_x(ring: Ring, axis: float) -> Ring:
    return [(2 * axis - x, y) for x, y in reversed(ring)]


# -- SVG ---------------------------------------------------------------------


def path_d(rings: list[Ring]) -> str:
    parts = []
    for ring in rings:
        pts = " ".join(f"{x:.2f} {y:.2f}" for x, y in ring)
        parts.append(f"M{pts}Z")
    return "".join(parts)


def svg(paths: list[tuple[list[Ring], bool]], viewbox: str) -> str:
    """paths: (rings, evenodd)."""
    rule = ' fill-rule="evenodd"'
    body = "".join(f'<path{rule if evenodd else ""} d="{path_d(rings)}"/>' for rings, evenodd in paths)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">{body}</svg>\n'


def solid(*rings: Ring) -> list[tuple[list[Ring], bool]]:
    """Each ring its own filled path, OR-ed together."""
    return [([ring], False) for ring in rings]


def holed(outer: Ring, *holes: Ring) -> tuple[list[Ring], bool]:
    return ([outer, *holes], True)


# -- Basics ------------------------------------------------------------------


def basics() -> dict[str, str]:
    v = "0 0 100 100"
    arrow = [(0, 38), (60, 38), (60, 15), (100, 50), (60, 85), (60, 62), (0, 62)]
    plus = [(38, 0), (62, 0), (62, 38), (100, 38), (100, 62), (62, 62), (62, 100), (38, 100), (38, 62), (0, 62), (0, 38), (38, 38)]
    return {
        "circle": svg(solid(circle(50, 50, 50)), v),
        "square": svg(solid(rect(0, 0, 100, 100)), v),
        "bar": svg(solid(rect(0, 0, 100, 20)), "0 0 100 20"),
        "line": svg(solid(rect(0, 0, 100, 4)), "0 0 100 4"),
        "triangle": svg(solid(regular(50, 58, 58, 3)), v),
        "diamond": svg(solid([(50, 0), (100, 50), (50, 100), (0, 50)]), v),
        "pentagon": svg(solid(regular(50, 52, 50, 5)), v),
        "hexagon": svg(solid(regular(50, 50, 50, 6, 0)), v),
        "octagon": svg(solid(regular(50, 50, 50, 8, 22.5)), v),
        "star": svg(solid(star(50, 52, 50, 20, 5)), v),
        "star-6": svg(solid(star(50, 50, 50, 26, 6)), v),
        "ring": svg([holed(circle(50, 50, 50), circle(50, 50, 36))], v),
        "half-circle": svg(solid(arc_band(50, 50, 50, 0.001, 180, 360)), "0 0 100 50"),
        "chevron": svg(solid(chevron(50, 0, 50, 22, 45)), "0 0 100 67"),
        "double-chevron": svg(solid(chevron(50, 0, 50, 18, 40), chevron(50, 30, 50, 18, 40)), "0 0 100 88"),
        "arrow": svg(solid(arrow), v),
        "plus": svg(solid(plus), v),
        "x-cross": svg(solid(rotate(plus, 50, 50, 45)), v),
    }


# -- Insignia ----------------------------------------------------------------


def insignia() -> dict[str, str]:
    def stripes(n: int) -> str:
        rings = [chevron(50, i * 26, 50, 18, 42) for i in range(n)]
        return svg(solid(*rings), f"0 0 100 {60 + (n - 1) * 26}")

    rocker = arc_band(50, -40, 90, 72, 50, 130)

    # Pilot wings: a centre disc and five feathers a side, longest on top.
    wing: list[Ring] = []
    for k in range(5):
        y0 = 18 + k * 7
        length = 86 - k * 15
        wing.append([(112, y0), (112 + length - 8, y0 - 6 + k), (112 + length, y0 - 8 + k), (112 + length - 6, y0 + 4), (112, y0 + 6)])
    wings = solid(circle(100, 30, 13), *wing, *[mirror_x(f, 100) for f in wing])

    heater = [(0, 0), (100, 0), (100, 45)]
    heater += [(50 + 50 * math.cos(math.radians(a)), 45 + 72 * math.sin(math.radians(a))) for a in range(0, 91, 6)]
    heater += [(50 - 50 * math.cos(math.radians(a)), 45 + 72 * math.sin(math.radians(a))) for a in range(90, -1, -6)]

    crest = [(0, 8), (20, 8), (30, 0), (50, 8), (70, 0), (80, 8), (100, 8), (100, 50)]
    crest += [(50 + 50 * math.cos(math.radians(a)), 50 + 55 * math.sin(math.radians(a))) for a in range(0, 91, 6)]
    crest += [(50 - 50 * math.cos(math.radians(a)), 50 + 55 * math.sin(math.radians(a))) for a in range(90, -1, -6)]

    banner_body = rect(25, 0, 150, 34)
    tail_left = [(0, 12), (40, 12), (40, 46), (0, 46), (12, 29)]
    tail_right = mirror_x(tail_left, 100)

    spear = [(50, 0), (78, 42), (62, 42), (62, 100), (38, 100), (38, 42), (22, 42)]

    tick = rect(46, 0, 8, 26)
    crosshair = [holed(circle(50, 50, 38), circle(50, 50, 30))]
    crosshair += solid(tick, rotate(tick, 50, 50, 90), rotate(tick, 50, 50, 180), rotate(tick, 50, 50, 270), circle(50, 50, 5))

    return {
        "rank-1": stripes(1),
        "rank-2": stripes(2),
        "rank-3": stripes(3),
        "rocker": svg(solid(rocker), "0 0 100 52"),
        "bar-1": svg(solid(rounded_rect(0, 0, 100, 30, 4)), "0 0 100 30"),
        "bar-2": svg(solid(rounded_rect(0, 0, 40, 100, 4), rounded_rect(60, 0, 40, 100, 4)), "0 0 100 100"),
        "pilot-wings": svg(wings, "0 0 200 60"),
        "shield-heater": svg(solid(heater), "0 0 100 117"),
        "shield-crest": svg(solid(crest), "0 0 100 105"),
        "shield-round": svg([holed(circle(50, 50, 50), circle(50, 50, 41))] + solid(circle(50, 50, 35)), "0 0 100 100"),
        "banner": svg(solid(tail_left, tail_right, banner_body), "0 0 200 46"),
        "roundel": svg([holed(circle(50, 50, 50), star(50, 53, 40, 16, 5))], "0 0 100 100"),
        "dog-tag": svg([holed(rounded_rect(0, 0, 60, 100, 18), circle(30, 14, 6))], "0 0 60 100"),
        "spearhead": svg(solid(spear), "0 0 100 100"),
        "crosshair-ring": svg(crosshair, "0 0 100 100"),
    }


# -- FPV ---------------------------------------------------------------------


def fpv() -> dict[str, str]:
    arm = rect(-6, -50, 12, 100)
    quad = [holed(circle(cx, cy, 22), circle(cx, cy, 16)) for cx, cy in ((20, 20), (80, 20), (20, 80), (80, 80))]
    quad += solid(rotate([(x + 50, y + 50) for x, y in arm], 50, 50, 45), rotate([(x + 50, y + 50) for x, y in arm], 50, 50, -45), rounded_rect(36, 30, 28, 40, 6))

    blade = ellipse(50, 24, 9, 24)
    prop3 = solid(circle(50, 50, 9), blade, rotate(blade, 50, 50, 120), rotate(blade, 50, 50, 240))
    prop2 = solid(circle(50, 50, 8), ellipse(50, 22, 8, 24), rotate(ellipse(50, 22, 8, 24), 50, 50, 180))

    goggles = [holed(rounded_rect(14, 10, 172, 60, 18), ellipse(62, 40, 30, 20), ellipse(138, 40, 30, 20))]
    goggles += solid(rect(0, 28, 16, 24), rect(184, 28, 16, 24))

    antenna = [holed(circle(30, 22, 22), circle(30, 22, 13))] + solid(rect(26, 40, 8, 60), circle(30, 22, 6))

    radio = [holed(rounded_rect(0, 30, 100, 70, 10), circle(28, 62, 14), circle(72, 62, 14))]
    radio += solid(rect(10, 0, 6, 34), circle(28, 62, 4), circle(72, 62, 4))

    bolt = [(56, 20), (36, 56), (50, 56), (44, 84), (66, 46), (52, 46)]
    battery = [holed(rounded_rect(10, 10, 80, 90, 6), bolt)] + solid(rect(36, 0, 28, 12))

    signal = solid(*[rect(i * 26, 100 - (i + 1) * 25, 20, (i + 1) * 25) for i in range(4)])

    camera = [holed(rounded_rect(0, 0, 100, 100, 14), circle(50, 50, 34))] + [holed(circle(50, 50, 24), circle(50, 50, 10))]

    whoop = [holed(circle(cx, cy, 24), circle(cx, cy, 18)) for cx, cy in ((25, 25), (75, 25), (25, 75), (75, 75))]
    whoop += solid(rounded_rect(35, 35, 30, 30, 6))

    return {
        "quad": svg(quad, "-2 -2 104 104"),
        "propeller": svg(prop3, "0 0 100 100"),
        "propeller-2": svg(prop2, "0 0 100 100"),
        "goggles": svg(goggles, "0 0 200 80"),
        "antenna": svg(antenna, "0 0 60 100"),
        "radio": svg(radio, "0 0 100 100"),
        "battery": svg(battery, "0 0 100 100"),
        "signal": svg(signal, "0 0 100 100"),
        "fpv-camera": svg(camera, "0 0 100 100"),
        "whoop": svg(whoop, "0 0 100 100"),
    }


# -- The template's rules ----------------------------------------------------


def rules() -> dict[str, str]:
    """Today's text template rules, in raster pixels (see template.ts drawRule).

    Kept exact so a design saved before layers converts pixel for pixel.
    """
    left, right, thickness, steps = 24, 264, 3, 5
    y = 8  # 0 * 18 + 9 - 1, the rule's top inside its tile row
    rings: list[Ring] = [rect(left, y, right - left, thickness)]
    for step in range(steps):
        rings.append(rect(left - 4 - step * 3, y - step, 3, thickness + 2 * step))
        rings.append(rect(right + 1 + step * 3, y - step, 3, thickness + 2 * step))
    plain = rect(left, 0, right - left, thickness)
    return {
        "rule-chevrons": svg(solid(*rings), "0 0 288 18"),
        "rule": svg(solid(plain), "0 0 288 18"),
    }


def main() -> None:
    packs = {"basics": {**basics(), **rules()}, "insignia": insignia(), "fpv": fpv()}
    for pack, shapes in packs.items():
        folder = OUT / pack
        folder.mkdir(parents=True, exist_ok=True)
        for name, content in shapes.items():
            (folder / f"{name}.svg").write_text(content)
        print(f"{pack}: {len(shapes)} shapes")


if __name__ == "__main__":
    main()
