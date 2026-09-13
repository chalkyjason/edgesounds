"""Authoring aid: turn a white-only sketch into outlined 12x18 glyph art.

Section 4 of the build handoff requires every white shape to carry a black
outline, so it reads over bright sky and dark ground alike. Drawing that
outline by hand 250 times is how you get inconsistent glyphs and typos, so
sketch the white form only and let this add the black.

The committed glyph art in ``glyphs/`` is the *outlined* result -- it is
exactly what ships, and it stays directly editable. ``validate.py`` check
10 enforces that every white pixel keeps its black surround, so a later
hand-edit cannot quietly break the rule.

Usage as a library::

    from outline_art import outline, place
    art = outline(place(SKETCH_A, origin_y=3))

Usage from the shell (reads a sketch on stdin, prints outlined art)::

    python tools/outline_art.py < sketch.txt
    python tools/outline_art.py --weight 2 --origin-y 2 < sketch.txt
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Sequence

if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from mcm_encode import BLACK, GLYPH_HEIGHT, GLYPH_WIDTH, TRANSPARENT, WHITE

NEIGHBOURS = [
    (dx, dy)
    for dy in (-1, 0, 1)
    for dx in (-1, 0, 1)
    if (dx, dy) != (0, 0)
]


def parse_sketch(text: str) -> list[str]:
    """Read a white-only sketch: ``#`` is ink, anything else is empty."""
    lines = [line.rstrip("\r") for line in text.split("\n")]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    if not lines:
        raise ValueError("sketch is empty")
    width = max(len(line) for line in lines)
    return [
        "".join(WHITE if char == WHITE else TRANSPARENT for char in line.ljust(width))
        for line in lines
    ]


def place(
    sketch: str | Sequence[str],
    origin_x: int | None = None,
    origin_y: int | None = None,
) -> list[str]:
    """Drop a sketch into a blank 12x18 cell.

    Both origins default to centred. A sketch that does not fit raises --
    silently cropping art is how glyphs lose their outlines at the edge.
    """
    rows = parse_sketch(sketch) if isinstance(sketch, str) else list(sketch)
    height = len(rows)
    width = max(len(row) for row in rows)
    if width > GLYPH_WIDTH or height > GLYPH_HEIGHT:
        raise ValueError(
            f"sketch is {width}x{height}, does not fit in "
            f"{GLYPH_WIDTH}x{GLYPH_HEIGHT}"
        )

    x0 = (GLYPH_WIDTH - width) // 2 if origin_x is None else origin_x
    y0 = (GLYPH_HEIGHT - height) // 2 if origin_y is None else origin_y
    if x0 < 0 or y0 < 0 or x0 + width > GLYPH_WIDTH or y0 + height > GLYPH_HEIGHT:
        raise ValueError(
            f"sketch {width}x{height} at ({x0},{y0}) falls outside the cell"
        )

    grid = [[TRANSPARENT] * GLYPH_WIDTH for _ in range(GLYPH_HEIGHT)]
    for y, row in enumerate(rows):
        for x, char in enumerate(row):
            if char == WHITE:
                grid[y0 + y][x0 + x] = WHITE
    return ["".join(row) for row in grid]


def outline(rows: Sequence[str], weight: int = 1) -> str:
    """Add a black halo around every white pixel.

    ``weight`` is how many pixels thick the halo is. 1 is the house style;
    2 is used by the high-readability variant, where the extra black buys
    contrast against a bright sky at the cost of tighter spacing.

    Black already present in the input is preserved. Pixels that fall
    outside the cell are simply lost -- the halo is clipped, not wrapped.
    """
    if weight < 1:
        raise ValueError("weight must be at least 1")
    grid = [list(row) for row in rows]
    if len(grid) != GLYPH_HEIGHT or any(len(r) != GLYPH_WIDTH for r in grid):
        raise ValueError(f"expected {GLYPH_WIDTH}x{GLYPH_HEIGHT} rows")

    for _ in range(weight):
        additions: list[tuple[int, int]] = []
        for y in range(GLYPH_HEIGHT):
            for x in range(GLYPH_WIDTH):
                if grid[y][x] != TRANSPARENT:
                    continue
                for dx, dy in NEIGHBOURS:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < GLYPH_WIDTH and 0 <= ny < GLYPH_HEIGHT:
                        if grid[ny][nx] in (WHITE, BLACK):
                            additions.append((x, y))
                            break
        for x, y in additions:
            grid[y][x] = BLACK

    return "\n".join("".join(row) for row in grid)


def sketch_to_art(
    sketch: str,
    origin_x: int | None = None,
    origin_y: int | None = None,
    weight: int = 1,
) -> str:
    """Sketch -> placed -> outlined, the whole authoring pipeline."""
    return outline(place(sketch, origin_x=origin_x, origin_y=origin_y), weight=weight)


def missing_outline(rows: Sequence[str]) -> list[tuple[int, int]]:
    """Return white pixels that touch transparent -- i.e. lack an outline.

    A white pixel at the very edge of the cell is exempt on that side:
    neighbouring glyphs butt up against each other, so there is nowhere to
    put the black and none is needed.
    """
    offenders: list[tuple[int, int]] = []
    for y, row in enumerate(rows):
        for x, char in enumerate(row):
            if char != WHITE:
                continue
            for dx, dy in NEIGHBOURS:
                nx, ny = x + dx, y + dy
                if not (0 <= nx < GLYPH_WIDTH and 0 <= ny < GLYPH_HEIGHT):
                    continue
                if rows[ny][nx] == TRANSPARENT:
                    offenders.append((x, y))
                    break
    return offenders


def _main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Outline a white-only glyph sketch read from stdin."
    )
    parser.add_argument(
        "--weight", type=int, default=1, help="halo thickness in pixels (default 1)"
    )
    parser.add_argument("--origin-x", type=int, default=None, help="left edge")
    parser.add_argument("--origin-y", type=int, default=None, help="top edge")
    args = parser.parse_args(argv)

    print(
        sketch_to_art(
            sys.stdin.read(),
            origin_x=args.origin_x,
            origin_y=args.origin_y,
            weight=args.weight,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
