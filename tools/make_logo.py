"""Draw the 288 x 72 boot-splash raster at ``assets/logo_288x72.png``.

The PNG is the splash's source of truth -- ``slice_logo.py`` cuts it into
the 12 x 18 tiles that become glyphs. This script exists so that source is
reproducible rather than an opaque binary: edit the stencil forms or the
layout here and re-run.

Colours are exactly what Betaflight Configurator's boot-logo uploader
expects (``LogoManager.constants.MCM_COLORMAP``): pure green is
background/transparent, white is white, black is black.

Layout, in tile rows of 18 px:

===  ==========  ==================================================
Row  Indexes     Content
===  ==========  ==================================================
0    0xA0-0xB7   top rule with chevron caps
1    0xB8-0xCF   ARMY JAY wordmark -- also the in-flight logo block
2    0xD0-0xE7   TACTICAL OSD subtitle
3    0xE8-0xFF   bottom rule; stops clear of the last tile
===  ==========  ==================================================

The bottom-right tile is index 0xFF, which is reserved, so every element
stays clear of the last 12 px of the last row. See STATUS.md.
"""

from __future__ import annotations

import sys
from pathlib import Path

if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image

from mcm_encode import GLYPH_HEIGHT, GLYPH_WIDTH
from render import UPLOAD_PALETTE

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = REPO_ROOT / "assets" / "logo_288x72.png"

TILES_HORIZ = 24
TILES_VERT = 4
WIDTH = GLYPH_WIDTH * TILES_HORIZ  # 288
HEIGHT = GLYPH_HEIGHT * TILES_VERT  # 72

#: The wordmark lives in this tile row, and the in-flight logo is the run
#: of inked tiles within it.
WORDMARK_ROW = 1

BLACK_RGB = UPLOAD_PALETTE["-"]
WHITE_RGB = UPLOAD_PALETTE["#"]
GREEN_RGB = UPLOAD_PALETTE["."]

# -- Stencil alphabet, 12 wide x 14 tall, 3px strokes ----------------------
# Only the letters the wordmark needs. Squared terminals and closed
# counters: military stencil weight without the breaks, which cost
# legibility on a noisy analog feed for no real gain.

BIG_STENCIL = {
    "A": """
...######...
..########..
.###....###.
###......###
###......###
###......###
############
############
###......###
###......###
###......###
###......###
###......###
###......###
""",
    "R": """
##########..
###########.
###......###
###......###
###......###
###########.
##########..
###...###...
###....###..
###.....###.
###......###
###......###
###......###
###......###
""",
    "M": """
###......###
####....####
############
############
###.####.###
###..##..###
###......###
###......###
###......###
###......###
###......###
###......###
###......###
###......###
""",
    "Y": """
###......###
###......###
.###....###.
..###..###..
...######...
....####....
....####....
....####....
....####....
....####....
....####....
....####....
....####....
....####....
""",
    "J": """
......######
......######
.........###
.........###
.........###
.........###
.........###
.........###
.........###
###......###
###......###
####....####
.##########.
..########..
""",
    " ": "\n".join(["." * 12] * 14),
}

# -- Subtitle alphabet, 6 wide x 9 tall ------------------------------------

SMALL_STENCIL = {
    "T": "######|######|..##..|..##..|..##..|..##..|..##..|..##..|..##..",
    "A": ".####.|######|##..##|##..##|######|######|##..##|##..##|##..##",
    "C": ".#####|######|##....|##....|##....|##....|##....|######|.#####",
    "I": "######|######|..##..|..##..|..##..|..##..|..##..|######|######",
    "L": "##....|##....|##....|##....|##....|##....|##....|######|######",
    "O": ".####.|######|##..##|##..##|##..##|##..##|##..##|######|.####.",
    "S": ".#####|######|##....|####..|.####.|..####|....##|######|#####.",
    "D": "#####.|######|##..##|##..##|##..##|##..##|##..##|######|#####.",
    " ": "......|......|......|......|......|......|......|......|......",
}

WORDMARK_TEXT = "ARMY JAY"
SUBTITLE_TEXT = "TACTICAL OSD"

LETTER_GAP = 2
SUBTITLE_GAP = 2

#: Rules stop here so the reserved bottom-right tile (0xFF) stays empty,
#: and so the top rule matches it.
RULE_LEFT = 24
RULE_RIGHT = WIDTH - 24
RULE_THICKNESS = 3


def _rows(spec: str) -> list[str]:
    if "|" in spec:
        return spec.split("|")
    return [line for line in spec.split("\n") if line.strip()]


def _compose(font: dict[str, str], text: str, gap: int) -> list[str]:
    """Lay a string out in a stencil font, returning white-only rows."""
    glyphs = [_rows(font[ch]) for ch in text]
    height = len(glyphs[0])
    filler = "." * gap
    return [filler.join(g[y] for g in glyphs) for y in range(height)]


def _blit(mask: list[list[bool]], rows: list[str], x0: int, y0: int) -> None:
    for y, row in enumerate(rows):
        for x, char in enumerate(row):
            if char == "#":
                mask[y0 + y][x0 + x] = True


def _fill(mask: list[list[bool]], x0: int, y0: int, x1: int, y1: int) -> None:
    for y in range(y0, y1):
        for x in range(x0, x1):
            mask[y][x] = True


def _centre(width: int, span_start: int, span_end: int) -> int:
    return span_start + (span_end - span_start - width) // 2


def build_mask() -> list[list[bool]]:
    """Compose the splash as a white-only mask."""
    mask = [[False] * WIDTH for _ in range(HEIGHT)]

    # Row 0: a rule with chevron caps.
    rule_y = GLYPH_HEIGHT // 2 - RULE_THICKNESS // 2
    _fill(mask, RULE_LEFT, rule_y, RULE_RIGHT, rule_y + RULE_THICKNESS)
    for step in range(5):
        _fill(
            mask,
            RULE_LEFT - 4 - step * 3,
            rule_y - step,
            RULE_LEFT - 1 - step * 3,
            rule_y + RULE_THICKNESS + step,
        )
        _fill(
            mask,
            RULE_RIGHT + 1 + step * 3,
            rule_y - step,
            RULE_RIGHT + 4 + step * 3,
            rule_y + RULE_THICKNESS + step,
        )

    # Row 1: the wordmark. Centred across the whole raster so the inked
    # tiles land in one contiguous run.
    wordmark = _compose(BIG_STENCIL, WORDMARK_TEXT, LETTER_GAP)
    wm_w = max(len(r) for r in wordmark)
    wm_x = _centre(wm_w, 0, WIDTH)
    wm_y = WORDMARK_ROW * GLYPH_HEIGHT + (GLYPH_HEIGHT - len(wordmark)) // 2
    _blit(mask, wordmark, wm_x, wm_y)

    # Row 2: the subtitle.
    subtitle = _compose(SMALL_STENCIL, SUBTITLE_TEXT, SUBTITLE_GAP)
    st_w = max(len(r) for r in subtitle)
    st_x = _centre(st_w, 0, WIDTH)
    st_y = 2 * GLYPH_HEIGHT + (GLYPH_HEIGHT - len(subtitle)) // 2
    _blit(mask, subtitle, st_x, st_y)

    # Row 3: the bottom rule, matching row 0.
    bottom_y = 3 * GLYPH_HEIGHT + GLYPH_HEIGHT // 2 - RULE_THICKNESS // 2
    _fill(mask, RULE_LEFT, bottom_y, RULE_RIGHT, bottom_y + RULE_THICKNESS)

    return mask


def outline_mask(mask: list[list[bool]]) -> list[list[bool]]:
    """1px black halo around the white mask, computed across the whole
    raster rather than per tile, so outlines stay continuous at the seams.
    """
    halo = [[False] * WIDTH for _ in range(HEIGHT)]
    for y in range(HEIGHT):
        for x in range(WIDTH):
            if mask[y][x]:
                continue
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < WIDTH and 0 <= ny < HEIGHT and mask[ny][nx]:
                        halo[y][x] = True
                        break
                if halo[y][x]:
                    break
    return halo


def render() -> Image.Image:
    mask = build_mask()
    halo = outline_mask(mask)
    image = Image.new("RGB", (WIDTH, HEIGHT), GREEN_RGB)
    pixels = image.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            if mask[y][x]:
                pixels[x, y] = WHITE_RGB
            elif halo[y][x]:
                pixels[x, y] = BLACK_RGB
    return image


def _main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("-o", "--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)

    image = render()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output)

    # Guard the one constraint that is easy to violate by nudging layout.
    last_tile = image.crop(
        (WIDTH - GLYPH_WIDTH, HEIGHT - GLYPH_HEIGHT, WIDTH, HEIGHT)
    )
    if last_tile.getcolors() != [(GLYPH_WIDTH * GLYPH_HEIGHT, GREEN_RGB)]:
        raise SystemExit(
            "the bottom-right tile carries ink, but it is index 0xFF and "
            "must stay transparent -- pull the artwork back"
        )
    print(f"wrote {args.output} ({WIDTH}x{HEIGHT})")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
