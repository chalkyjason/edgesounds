"""Shared raster rendering for glyphs, glyph sheets and OSD mock-ups.

Used by ``mcm_decode.py --png`` (handoff step 2) and by
``build_previews.py`` (step 6), so the two never drift on palette or
scaling. Requires Pillow; the core encode/decode path deliberately does
not.

Two palettes matter and they are not the same thing:

* :data:`PREVIEW_PALETTE` renders transparent as **magenta**, so a
  transparent pixel is unmistakable in a preview image.
* :data:`UPLOAD_PALETTE` renders transparent as **pure green**
  (``0,255,0``), which is what Betaflight Configurator's boot-logo
  uploader expects in the 288x72 source image. Verified against
  ``LogoManager.constants.MCM_COLORMAP``.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Sequence

if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image, ImageDraw

from mcm_encode import (
    BLACK,
    GLYPH_HEIGHT,
    GLYPH_WIDTH,
    TRANSPARENT,
    WHITE,
    Glyph,
)

RGB = tuple[int, int, int]
Palette = dict[str, RGB]

#: Transparent shows as magenta -- for human inspection.
PREVIEW_PALETTE: Palette = {
    BLACK: (0, 0, 0),
    WHITE: (255, 255, 255),
    TRANSPARENT: (255, 0, 255),
}

#: Transparent shows as pure green -- what Configurator's logo uploader
#: reads as "background". Do not change these values.
UPLOAD_PALETTE: Palette = {
    BLACK: (0, 0, 0),
    WHITE: (255, 255, 255),
    TRANSPARENT: (0, 255, 0),
}

#: Transparent shows as a dark blue-grey -- approximates how a glyph sits
#: over video in goggles, for the mock OSD screen.
SCREEN_PALETTE: Palette = {
    BLACK: (24, 26, 32),
    WHITE: (255, 255, 255),
    TRANSPARENT: (56, 68, 82),
}

GRID_COLOR: RGB = (64, 64, 72)
LABEL_COLOR: RGB = (168, 176, 190)
SHEET_BG: RGB = (18, 19, 23)


def glyph_to_image(
    glyph: Glyph, scale: int = 1, palette: Palette | None = None
) -> Image.Image:
    """Render one glyph to an RGB image of 12*scale x 18*scale."""
    palette = palette or PREVIEW_PALETTE
    image = Image.new("RGB", (GLYPH_WIDTH, GLYPH_HEIGHT))
    image.putdata([palette[char] for row in glyph.rows for char in row])
    if scale != 1:
        image = image.resize(
            (GLYPH_WIDTH * scale, GLYPH_HEIGHT * scale), Image.Resampling.NEAREST
        )
    return image


def glyph_to_rgba(glyph: Glyph, scale: int = 1, white_only: bool = False) -> Image.Image:
    """Render one glyph with real alpha, for compositing onto a mock screen.

    With ``white_only`` the black outline is dropped, which is only useful
    for debugging how much a glyph relies on its outline.
    """
    pixels: list[tuple[int, int, int, int]] = []
    for row in glyph.rows:
        for char in row:
            if char == WHITE:
                pixels.append((255, 255, 255, 255))
            elif char == BLACK and not white_only:
                pixels.append((0, 0, 0, 255))
            else:
                pixels.append((0, 0, 0, 0))
    image = Image.new("RGBA", (GLYPH_WIDTH, GLYPH_HEIGHT))
    image.putdata(pixels)
    if scale != 1:
        image = image.resize(
            (GLYPH_WIDTH * scale, GLYPH_HEIGHT * scale), Image.Resampling.NEAREST
        )
    return image


def render_strip(
    glyphs: Sequence[Glyph], scale: int = 1, palette: Palette | None = None
) -> Image.Image:
    """Render glyphs side by side in a single row, with no gaps.

    This is how the boot splash is reassembled: 24 tiles wide, 4 rows.
    """
    palette = palette or PREVIEW_PALETTE
    width = GLYPH_WIDTH * len(glyphs)
    strip = Image.new("RGB", (width, GLYPH_HEIGHT))
    for position, glyph in enumerate(glyphs):
        strip.paste(glyph_to_image(glyph, palette=palette), (position * GLYPH_WIDTH, 0))
    if scale != 1:
        strip = strip.resize(
            (strip.width * scale, strip.height * scale), Image.Resampling.NEAREST
        )
    return strip


def render_tiles(
    glyphs: Sequence[Glyph],
    columns: int,
    scale: int = 1,
    palette: Palette | None = None,
) -> Image.Image:
    """Render glyphs as a gapless tile grid (the boot splash layout)."""
    palette = palette or PREVIEW_PALETTE
    rows = (len(glyphs) + columns - 1) // columns
    image = Image.new(
        "RGB",
        (GLYPH_WIDTH * columns, GLYPH_HEIGHT * rows),
        palette[TRANSPARENT],
    )
    for position, glyph in enumerate(glyphs):
        x = (position % columns) * GLYPH_WIDTH
        y = (position // columns) * GLYPH_HEIGHT
        image.paste(glyph_to_image(glyph, palette=palette), (x, y))
    if scale != 1:
        image = image.resize(
            (image.width * scale, image.height * scale), Image.Resampling.NEAREST
        )
    return image


def render_glyph_sheet(
    glyphs: Sequence[Glyph],
    scale: int = 3,
    columns: int = 16,
    title: str = "",
    palette: Palette | None = None,
) -> Image.Image:
    """Render all 256 glyphs as a labelled contact sheet.

    Each cell is labelled with the decimal and hex index. Transparent
    pixels render magenta by default so they cannot be mistaken for black.
    """
    palette = palette or PREVIEW_PALETTE
    cell_w = GLYPH_WIDTH * scale
    cell_h = GLYPH_HEIGHT * scale
    label_h = 11
    pad = 5
    rows = (len(glyphs) + columns - 1) // columns

    header = 26 if title else 0
    width = columns * (cell_w + pad) + pad
    height = header + rows * (cell_h + label_h + pad) + pad

    sheet = Image.new("RGB", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(sheet)

    if title:
        draw.text((pad, 8), title, fill=(235, 238, 245))

    for index, glyph in enumerate(glyphs):
        col = index % columns
        row = index // columns
        x = pad + col * (cell_w + pad)
        y = header + pad + row * (cell_h + label_h + pad)
        draw.rectangle(
            [x - 1, y - 1, x + cell_w, y + cell_h], outline=GRID_COLOR
        )
        sheet.paste(glyph_to_image(glyph, scale=scale, palette=palette), (x, y))
        draw.text((x, y + cell_h + 1), f"{index} {index:02X}", fill=LABEL_COLOR)

    return sheet


def save(image: Image.Image, path: Path | str) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    return path
