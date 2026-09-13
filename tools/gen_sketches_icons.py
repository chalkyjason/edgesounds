"""Generate glyphs/icons.py -- every non-ASCII, non-logo index.

Three authoring techniques, picked per glyph:

* Pictograms are drawn directly as white sketches.
* Text labels are composed from two bitmap fonts, MID (5x9, bold, for one
  and two character labels) and MICRO (3x5, for three character labels
  where 12px of width leaves no other option -- stock does the same).
* The 16 home-direction arrows are rasterised from one polygon rotated
  through 16 headings, so they form a consistent set. They are reviewed
  visually and committed as plain art like everything else.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from outline_art import outline, place  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "glyphs"

#: A fully transparent cell, for indexes that are deliberately blank.
BLANK = "\n".join(["." * 12] * 18)

# --------------------------------------------------------------------------
# Bitmap fonts for composed labels
# --------------------------------------------------------------------------

MICRO = {  # 3 wide x 5 tall
    "A": "###|#.#|###|#.#|#.#", "B": "##.|#.#|##.|#.#|##.",
    "C": "###|#..|#..|#..|###", "D": "##.|#.#|#.#|#.#|##.",
    "E": "###|#..|##.|#..|###", "F": "###|#..|##.|#..|#..",
    "G": "###|#..|#.#|#.#|###", "H": "#.#|#.#|###|#.#|#.#",
    "I": "###|.#.|.#.|.#.|###", "J": "..#|..#|..#|#.#|###",
    "K": "#.#|#.#|##.|#.#|#.#", "L": "#..|#..|#..|#..|###",
    "M": "#.#|###|###|#.#|#.#", "N": "#.#|###|###|###|#.#",
    "O": "###|#.#|#.#|#.#|###", "P": "###|#.#|###|#..|#..",
    "Q": "###|#.#|#.#|###|..#", "R": "###|#.#|##.|#.#|#.#",
    "S": "###|#..|###|..#|###", "T": "###|.#.|.#.|.#.|.#.",
    "U": "#.#|#.#|#.#|#.#|###", "V": "#.#|#.#|#.#|#.#|.#.",
    "W": "#.#|#.#|###|###|#.#", "X": "#.#|#.#|.#.|#.#|#.#",
    "Y": "#.#|#.#|.#.|.#.|.#.", "Z": "###|..#|.#.|#..|###",
    "/": "..#|..#|.#.|#..|#..",
}

MID = {  # 5 wide x 9 tall, bold
    "B": "####.|##.##|##.##|####.|####.|##.##|##.##|##.##|####.",
    "C": ".####|##...|##...|##...|##...|##...|##...|##...|.####",
    "D": "####.|##.##|##.##|##.##|##.##|##.##|##.##|##.##|####.",
    "F": "#####|#####|##...|##...|####.|####.|##...|##...|##...",
    "H": "##.##|##.##|##.##|#####|#####|##.##|##.##|##.##|##.##",
    "I": "#####|#####|.###.|.###.|.###.|.###.|.###.|#####|#####",
    "K": "##..#|##.##|##.##|####.|###..|####.|##.##|##..#|##..#",
    "L": "##...|##...|##...|##...|##...|##...|##...|#####|#####",
    "M": "#...#|##.##|#####|#####|#.#.#|#...#|#...#|#...#|#...#",
    "P": "####.|##.##|##.##|####.|##...|##...|##...|##...|##...",
    "Q": ".###.|##.##|##.##|##.##|##.##|##.##|##.##|.###.|...##",
    "S": ".####|##...|##...|####.|.###.|...##|...##|...##|####.",
    "T": "#####|#####|.###.|.###.|.###.|.###.|.###.|.###.|.###.",
}


def rows(spec):
    return spec.split("|")


def compose(font, text, gap=1):
    """Lay out a string in one of the bitmap fonts. Returns list of rows."""
    glyphs = [rows(font[ch]) for ch in text]
    height = len(glyphs[0])
    out = []
    for y in range(height):
        out.append((" " * gap).join(g[y] for g in glyphs).replace(" ", "."))
    return out


def stack(blocks, gap=1):
    """Stack rendered blocks vertically, centring each horizontally."""
    width = max(len(r) for b in blocks for r in b)
    out = []
    for i, block in enumerate(blocks):
        if i:
            out.extend(["." * width] * gap)
        for row in block:
            pad = width - len(row)
            left = pad // 2
            out.append("." * left + row + "." * (pad - left))
    return out


def art(sketch, origin_x=None, origin_y=None, weight=1):
    return outline(place(sketch, origin_x=origin_x, origin_y=origin_y), weight=weight)


def text_art(font, text, origin_y=None):
    return art(compose(font, text), origin_y=origin_y)


def stacked_art(blocks, origin_y=None, gap=2):
    return art(stack(blocks, gap=gap), origin_y=origin_y)


# --------------------------------------------------------------------------
# Reusable full-size letterforms, shared with the ASCII set
# --------------------------------------------------------------------------

BIG = {
    "A": """
..####..
.######.
##....##
##....##
##....##
##....##
########
########
##....##
##....##
##....##
##....##
""",
    "V": """
##....##
##....##
##....##
##....##
##....##
##....##
.##..##.
.##..##.
.##..##.
..####..
..####..
...##...
""",
    "M": """
##....##
###..###
########
########
##.##.##
##.##.##
##....##
##....##
##....##
##....##
##....##
##....##
""",
    "N": """
##....##
###...##
####..##
####..##
##.##.##
##.##.##
##..####
##..####
##...###
##....##
##....##
##....##
""",
    "S": """
.######.
########
##....##
##......
###.....
.#####..
..#####.
.....###
......##
##....##
########
.######.
""",
    "E": """
########
########
##......
##......
##......
######..
######..
##......
##......
##......
########
########
""",
    "W": """
##....##
##....##
##....##
##....##
##....##
##.##.##
##.##.##
##.##.##
########
########
###..###
##....##
""",
}

# --------------------------------------------------------------------------
# Home-direction arrows: one polygon, 16 headings
# --------------------------------------------------------------------------

# Three hand-drawn bases in a 10x10 field, then exact 90-degree rotations
# and one mirror, which reach all 16 headings. Rotating a polygon and
# thresholding it down was tried first and produced blobs: at 10 px there
# is no room for a rasteriser to be approximately right.

ARROW_N = """
....##....
...####...
..######..
.########.
##########
...####...
...####...
...####...
...####...
...####...
"""

ARROW_NNE = """
.....###..
....####..
...#####..
..######..
.#######..
....###...
....###...
...###....
...###....
...###....
"""

ARROW_NE = """
....######
....######
......####
.....####.
....####..
...####...
..####....
.####.....
####......
###.......
"""

FIELD = 12


def _to_field(sketch):
    """Centre a 10x10 sketch in a 12x12 field, leaving a 1px outline frame.

    The frame is what makes rotation safe: a 90-degree turn maps the field
    onto itself, so every heading keeps the same margins.
    """
    rows_in = [r for r in sketch.split("\n") if r.strip()]
    size = len(rows_in)
    pad = (FIELD - size) // 2
    grid = [["."] * FIELD for _ in range(FIELD)]
    for y, row in enumerate(rows_in):
        for x, ch in enumerate(row):
            if ch == "#":
                grid[pad + y][pad + x] = "#"
    return grid


def _rot90(grid):
    """Rotate a square grid 90 degrees clockwise."""
    n = len(grid)
    return [[grid[n - 1 - x][y] for x in range(n)] for y in range(n)]


def _mirror(grid):
    return [list(reversed(row)) for row in grid]


_BASES = [
    (0.0, _to_field(ARROW_N)),
    (22.5, _to_field(ARROW_NNE)),
    (45.0, _to_field(ARROW_NE)),
    (337.5, _mirror(_to_field(ARROW_NNE))),
]


def arrow_sketch(bearing_deg):
    """The arrow for a bearing, as a 12-row white sketch. 0 = north."""
    bearing = bearing_deg % 360.0
    for base_bearing, grid in _BASES:
        delta = (bearing - base_bearing) % 360.0
        turns = delta / 90.0
        if abs(turns - round(turns)) < 1e-6:
            for _ in range(int(round(turns)) % 4):
                grid = _rot90(grid)
            return "\n".join("".join(row) for row in grid)
    raise ValueError(f"no base arrow for bearing {bearing_deg}")


# --------------------------------------------------------------------------
# Pictograms
# --------------------------------------------------------------------------

SKETCHES = {}

SKETCHES[0x01] = art("""
......##
......##
......##
...##.##
...##.##
...##.##
##.##.##
##.##.##
##.##.##
""", origin_y=6)

SKETCHES[0x02] = art("""
...##
..###
.###.
###..
.###.
..###
...##
""", origin_x=4)

SKETCHES[0x03] = art("""
##...
###..
.###.
..###
.###.
###..
##...
""", origin_x=3)

# Throttle: a lever in a slot.
SKETCHES[0x04] = stacked_art([compose(MICRO, "THR")], origin_y=6)

# Over home: a house.
SKETCHES[0x05] = art("""
...##...
..####..
.######.
########
##....##
##.##.##
##.##.##
##.##.##
""", origin_y=5)

SKETCHES[0x06] = art(BIG["V"], origin_y=3)

SKETCHES[0x07] = stacked_art([compose(MICRO, "MAH")], origin_y=6)

# Stick overlay sprites: a ring at three heights; 0x08 doubles as degrees.
_RING = """
####
#..#
#..#
####
"""
SKETCHES[0x08] = art(_RING, origin_y=2)
SKETCHES[0x09] = art(_RING, origin_y=7)
SKETCHES[0x0A] = art(_RING, origin_y=12)

SKETCHES[0x0B] = art("""
..##..
..##..
######
######
..##..
..##..
""", origin_y=6)

SKETCHES[0x0C] = art(BIG["M"], origin_y=3)

_DEGREE = "###|#.#|###"
SKETCHES[0x0D] = art(stack([rows(_DEGREE), rows(MID["F"])], gap=1), origin_y=2)
SKETCHES[0x0E] = art(stack([rows(_DEGREE), rows(MID["C"])], gap=1), origin_y=2)
SKETCHES[0x0F] = text_art(MID, "FT", origin_y=4)
SKETCHES[0x10] = text_art(MID, "BB", origin_y=4)

# Home flag.
SKETCHES[0x11] = art("""
##......
########
########
########
########
########
##......
##......
##......
##......
""", origin_y=4)

SKETCHES[0x12] = BLANK  # unassigned

# AH side decoration: a bracket tick on the left edge.
SKETCHES[0x13] = art("""
####
####
##..
##..
##..
##..
##..
##..
####
####
""", origin_x=1, origin_y=4)

SKETCHES[0x14] = stacked_art([compose(MICRO, "ROL")], origin_y=6)
SKETCHES[0x15] = stacked_art([compose(MICRO, "PIT")], origin_y=6)

SKETCHES[0x16] = art("\n".join(["##"] * 18), origin_y=0)
SKETCHES[0x17] = art("\n".join(["#" * 12] * 2), origin_y=8)

SKETCHES[0x18] = art(BIG["N"], origin_y=3)
SKETCHES[0x19] = art(BIG["S"], origin_y=3)
SKETCHES[0x1A] = art(BIG["E"], origin_y=3)
SKETCHES[0x1B] = art(BIG["W"], origin_y=3)

SKETCHES[0x1C] = art("##\n##\n##\n##", origin_y=0)
SKETCHES[0x1D] = art("##\n##\n##\n##\n##\n##\n##\n##", origin_y=0)

# Satellite, drawn once at 24px wide and split across the two cells that
# Betaflight renders side by side. Outlining each half separately is safe:
# the white columns meet at the seam, so no black is inserted between them.
SAT_24 = [
    "........................",
    ".........######.........",
    ".........######.........",
    "..#####..######..#####..",
    "..####################..",
    "..####################..",
    "..#####..######..#####..",
    ".........######.........",
    ".........######.........",
    "........................",
]

SKETCHES[0x1E] = art("\n".join(row[:12] for row in SAT_24), origin_x=0, origin_y=4)
SKETCHES[0x1F] = art("\n".join(row[12:] for row in SAT_24), origin_x=0, origin_y=4)

SKETCHES[0x20] = BLANK  # space

for offset in range(16):
    SKETCHES[0x60 + offset] = art(
        arrow_sketch((180.0 - offset * 22.5) % 360.0), origin_x=0, origin_y=3
    )

# Speed: a gauge with a needle.
SKETCHES[0x70] = art("""
..####..
.######.
##.##.##
##.##.##
##..#.##
##....##
.######.
..####..
""", origin_y=5)

SKETCHES[0x71] = stacked_art([compose(MICRO, "DST")], origin_y=6)

# Crosshair, split across three cells.
SKETCHES[0x72] = art("\n".join(["#" * 8] * 2), origin_x=4, origin_y=8)
SKETCHES[0x73] = art("""
..####..
.##..##.
##....##
##....##
.##..##.
..####..
""", origin_y=6)
SKETCHES[0x74] = art("\n".join(["#" * 8] * 2), origin_x=0, origin_y=8)

SKETCHES[0x75] = art("""
...##...
..####..
.######.
########
...##...
...##...
""", origin_y=6)
SKETCHES[0x76] = art("""
...##...
...##...
########
.######.
..####..
...##...
""", origin_y=6)
SKETCHES[0x77] = art("""
##....
####..
######
######
####..
##....
""", origin_y=6)

SKETCHES[0x78] = BLANK  # unassigned
SKETCHES[0x79] = BLANK  # blank in stock; kept blank

# Thermometer.
SKETCHES[0x7A] = art("""
..####..
.##..##.
.##..##.
.##..##.
.##..##.
.##..##.
########
########
########
.######.
""", origin_y=4)

SKETCHES[0x7B] = text_art(MID, "LQ", origin_y=4)
SKETCHES[0x7C] = art("\n".join(["##"] * 14), origin_y=2)
SKETCHES[0x7D] = text_art(MID, "KM", origin_y=4)
SKETCHES[0x7E] = text_art(MID, "MI", origin_y=4)
SKETCHES[0x7F] = stacked_art([compose(MICRO, "ALT")], origin_y=6)

# AH ladder: a rung at nine heights, stepping down the cell.
for i in range(9):
    top = 16 - i * 2
    SKETCHES[0x80 + i] = art("\n".join(["#" * 12] * 2), origin_x=0, origin_y=top)

SKETCHES[0x89] = stacked_art([compose(MICRO, "LAT")], origin_y=6)

# Progress bar pieces.
SKETCHES[0x8A] = art("""
###.........
###.........
##..........
##..........
##..........
##..........
##..........
##..........
###.........
###.........
""", origin_x=0, origin_y=4)
SKETCHES[0x8B] = art("\n".join(["############"] * 10), origin_x=0, origin_y=4)
SKETCHES[0x8C] = art(
    "\n".join(["############"] * 2 + ["######......"] * 6 + ["############"] * 2),
    origin_x=0, origin_y=4)
SKETCHES[0x8D] = art(
    "\n".join(["############"] * 2 + ["............"] * 6 + ["############"] * 2),
    origin_x=0, origin_y=4)
SKETCHES[0x8E] = art("""
.........###
.........###
..........##
..........##
..........##
..........##
..........##
..........##
.........###
.........###
""", origin_x=0, origin_y=4)
SKETCHES[0x8F] = art("\n".join(["##"] * 10), origin_x=5, origin_y=4)


def battery(bars):
    """Battery pictogram with `bars` of 6 charge segments filled."""
    body = []
    body.append("..####..")
    body.append("########")
    for segment in range(6):
        filled = segment >= (6 - bars)
        body.append("##" + ("####" if filled else "....") + "##")
    body.append("########")
    return "\n".join(body)


for level, index in enumerate(range(0x96, 0x8F, -1)):  # 0x96 empty .. 0x90 full
    SKETCHES[index] = art(battery(level), origin_y=4)

SKETCHES[0x97] = art(battery(6), origin_y=4)
SKETCHES[0x98] = stacked_art([compose(MICRO, "LON")], origin_y=6)
SKETCHES[0x99] = stacked_art(
    [compose(MICRO, "FT"), compose(MICRO, "/S")], origin_y=3
)
SKETCHES[0x9A] = art(BIG["A"], origin_y=3)
SKETCHES[0x9B] = stacked_art(
    [compose(MICRO, "ON"), compose(MICRO, "MN")], origin_y=3
)
SKETCHES[0x9C] = stacked_art(
    [compose(MICRO, "FLY"), compose(MICRO, "MN")], origin_y=3
)
SKETCHES[0x9D] = stacked_art(
    [compose(MICRO, "MP"), compose(MICRO, "H")], origin_y=3
)
SKETCHES[0x9E] = stacked_art(
    [compose(MICRO, "KM"), compose(MICRO, "H")], origin_y=3
)
SKETCHES[0x9F] = stacked_art(
    [compose(MICRO, "M"), compose(MICRO, "/S")], origin_y=3
)


def main():
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from glyphs.glyph_map import GLYPH_MAP

    items = sorted(SKETCHES.items())
    lines = [
        '"""Army Jay OSD icons -- every index that is not a letter, digit,\n'
        "punctuation mark or boot-splash tile.\n\n"
        "Covers 0x01-0x1F, 0x20 (space), the 16 home arrows at 0x60-0x6F,\n"
        "and 0x70-0x9F. 0x00 and 0xFF are protected and come from stock, so\n"
        "they are deliberately absent here.\n\n"
        "Pictograms were sketched white-only and outlined by\n"
        "``tools/outline_art.py``; text labels are composed from a bold 5x9\n"
        "and a 3x5 bitmap font. Three-character labels are 1px strokes\n"
        "because 12px of cell width allows nothing else -- the stock font\n"
        "makes the same compromise in the same places.\n"
        '"""\n\n',
        "from __future__ import annotations\n\n",
        "ICONS: dict[int, str] = {\n",
    ]
    for index, a in items:
        slot = GLYPH_MAP[index]
        label = f"{slot.symbol} -- {slot.meaning}" if slot.symbol else slot.meaning
        lines.append(f"    # 0x{index:02X}  {label}\n")
        lines.append(f'    0x{index:02X}: """\n{a}\n""",\n')
    lines.append("}\n")
    (OUT / "icons.py").write_text("".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT / 'icons.py'} ({len(items)} glyphs)")


if __name__ == "__main__":
    main()
