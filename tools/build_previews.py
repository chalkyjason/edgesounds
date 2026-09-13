"""Render the preview images for each built variant.

Two per variant, into ``previews/``:

``<variant>_glyph_sheet.png``
    All 256 glyphs in a 16x16 grid, every cell labelled with its decimal
    and hex index, transparent pixels in magenta so they cannot be
    mistaken for black.

``<variant>_logo_preview.png``
    The boot splash reassembled from its tiles at 288x72, above a mock OSD
    screen carrying the in-flight wordmark alongside the elements a pilot
    actually reads -- voltage, current draw, timer, RSSI, altitude, home
    arrow and the crosshair -- so the visual balance can be judged rather
    than guessed at.

The mock screen is a PAL analog layout, 30 columns by 16 rows of 12x18
glyphs, drawn from the font itself. Nothing here is mocked up in another
typeface: if it looks wrong on this sheet, it looks wrong in the goggles.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from collections.abc import Iterable, Sequence

if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageDraw

from mcm_decode import read_font
from mcm_encode import GLYPH_HEIGHT, GLYPH_WIDTH, Glyph
from render import (
    SCREEN_PALETTE,
    glyph_to_rgba,
    render_glyph_sheet,
    render_tiles,
    save,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = REPO_ROOT / "fonts"
PREVIEW_DIR = REPO_ROOT / "previews"

LOGO_START = 0xA0
TILES_HORIZ = 24
TILES_VERT = 4

#: PAL analog OSD geometry.
SCREEN_COLS = 30
SCREEN_ROWS = 16

VIDEO_BG = (26, 34, 28)
PANEL_BG = (14, 15, 18)
TEXT_FG = (196, 204, 216)


def index_for(char: str) -> int:
    """Glyph index for a printable character, as Betaflight would use it."""
    if char == " ":
        return 0x20
    code = ord(char.upper())
    if 0x20 <= code <= 0x5F:
        return code
    raise ValueError(f"{char!r} has no glyph in the analog OSD range")


def indexes_for(text: str) -> list[int]:
    return [index_for(c) for c in text]


def draw_row(
    canvas: Image.Image,
    glyphs: Sequence[Glyph],
    items: Iterable[int],
    col: int,
    row: int,
    scale: int,
) -> None:
    """Paste a run of glyph indexes onto the mock screen at (col, row)."""
    for offset, index in enumerate(items):
        tile = glyph_to_rgba(glyphs[index], scale=scale)
        x = (col + offset) * GLYPH_WIDTH * scale
        y = row * GLYPH_HEIGHT * scale
        canvas.alpha_composite(tile, (x, y))


def render_mock_screen(glyphs: Sequence[Glyph], scale: int = 2) -> Image.Image:
    """A representative OSD screen drawn entirely from the font."""
    width = SCREEN_COLS * GLYPH_WIDTH * scale
    height = SCREEN_ROWS * GLYPH_HEIGHT * scale
    canvas = Image.new("RGBA", (width, height), VIDEO_BG + (255,))

    # A soft horizon band, so glyphs are judged against light and dark.
    sky = Image.new("RGBA", (width, height // 2), (96, 118, 140, 255))
    canvas.alpha_composite(sky, (0, 0))
    ground = Image.new("RGBA", (width, height // 2), (38, 44, 34, 255))
    canvas.alpha_composite(ground, (0, height // 2))

    sym_rssi, sym_volt, sym_amp, sym_mah = 0x01, 0x06, 0x9A, 0x07
    sym_fly, sym_alt, sym_sat_l, sym_sat_r = 0x9C, 0x7F, 0x1E, 0x1F
    sym_home, sym_m = 0x68, 0x0C
    crosshair = [0x72, 0x73, 0x74]

    # Top row: RSSI left, pack voltage right.
    draw_row(canvas, glyphs, [sym_rssi] + indexes_for("98"), 1, 0, scale)
    draw_row(canvas, glyphs, indexes_for("16.4") + [sym_volt], 24, 0, scale)

    # Second row: satellites left, current draw right.
    draw_row(canvas, glyphs, [sym_sat_l, sym_sat_r] + indexes_for("14"), 1, 1, scale)
    draw_row(canvas, glyphs, indexes_for("28.6") + [sym_amp], 24, 1, scale)

    # Artificial horizon ladder either side of the crosshair.
    draw_row(canvas, glyphs, [0x02], 10, 7, scale)
    draw_row(canvas, glyphs, crosshair, 13, 7, scale)
    draw_row(canvas, glyphs, [0x03], 19, 7, scale)
    draw_row(canvas, glyphs, [0x84], 11, 6, scale)
    draw_row(canvas, glyphs, [0x84], 18, 8, scale)

    # The in-flight wordmark, sitting where a pilot would place it.
    from glyphs.logo import WORDMARK_INDEXES  # noqa: PLC0415

    wordmark = list(WORDMARK_INDEXES)
    draw_row(
        canvas,
        glyphs,
        wordmark,
        (SCREEN_COLS - len(wordmark)) // 2,
        11,
        scale,
    )

    # Altitude and home distance.
    draw_row(canvas, glyphs, [sym_alt] + indexes_for("042") + [sym_m], 1, 13, scale)
    draw_row(canvas, glyphs, [sym_home] + indexes_for("118") + [sym_m], 23, 13, scale)

    # Bottom row: flight timer left, consumed capacity right.
    draw_row(canvas, glyphs, [sym_fly] + indexes_for("04:32"), 1, 15, scale)
    draw_row(canvas, glyphs, indexes_for("1250") + [sym_mah], 24, 15, scale)

    return canvas.convert("RGB")


def render_logo_preview(glyphs: Sequence[Glyph], title: str) -> Image.Image:
    """The assembled splash above a mock OSD screen."""
    tiles = [glyphs[LOGO_START + i] for i in range(TILES_HORIZ * TILES_VERT)]
    # Shown over a video-like ground rather than magenta: the glyph sheet
    # already calls out transparency, and what matters here is balance.
    splash = render_tiles(
        tiles, columns=TILES_HORIZ, scale=2, palette=SCREEN_PALETTE
    )
    screen = render_mock_screen(glyphs, scale=2)

    pad = 16
    header = 26
    caption = 20
    width = max(splash.width, screen.width) + pad * 2
    height = header + splash.height + caption + screen.height + pad * 3

    sheet = Image.new("RGB", (width, height), PANEL_BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((pad, 8), title, fill=(235, 238, 245))

    y = header
    sheet.paste(splash, ((width - splash.width) // 2, y))
    y += splash.height + pad
    draw.text(
        (pad, y),
        "boot splash, reassembled from tiles 0xA0-0xFE "
        "(0xFF reserved, left transparent); shown over video, not magenta",
        fill=TEXT_FG,
    )
    y += caption
    sheet.paste(screen, ((width - screen.width) // 2, y))
    return sheet


def build(variant_paths: Sequence[Path]) -> list[Path]:
    written: list[Path] = []
    for path in variant_paths:
        glyphs = read_font(path)
        name = path.stem

        sheet = render_glyph_sheet(
            glyphs, scale=3, columns=16, title=f"{name} -- all 256 glyphs"
        )
        written.append(save(sheet, PREVIEW_DIR / f"{name}_glyph_sheet.png"))

        preview = render_logo_preview(glyphs, f"{name} -- logo and OSD preview")
        written.append(save(preview, PREVIEW_DIR / f"{name}_logo_preview.png"))
        print(f"previewed {name}")
    return written


def _main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Render variant previews.")
    parser.add_argument(
        "fonts",
        nargs="*",
        type=Path,
        help="fonts to preview (default: every .mcm in fonts/)",
    )
    args = parser.parse_args(argv)

    fonts = args.fonts or sorted(FONTS_DIR.glob("*.mcm"))
    if not fonts:
        parser.error("no fonts to preview; run tools/build_font.py first")

    written = build(fonts)
    print(f"wrote {len(written)} images to {PREVIEW_DIR.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
