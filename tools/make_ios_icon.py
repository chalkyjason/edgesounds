"""Draw the 1024 px iOS app icon from the favicon's four-bar mark."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
SUPERSAMPLE = 4
VIEWBOX = 32
BACKGROUND = (0x09, 0x09, 0x0B)
BARS = [
    (5, 11, 4, 10, (0x00, 0xCC, 0x7E)),
    (23, 12, 4, 8, (0x00, 0xCC, 0x7E)),
    (11, 6, 4, 20, (0x00, 0xFF, 0x9D)),
    (17, 9, 4, 14, (0x00, 0xFF, 0x9D)),
]


def draw_icon() -> Image.Image:
    side = SIZE * SUPERSAMPLE
    unit = side / VIEWBOX
    image = Image.new("RGB", (side, side), BACKGROUND)
    draw = ImageDraw.Draw(image)
    for x, y, width, height, colour in BARS:
        box = (x * unit, y * unit, (x + width) * unit - 1, (y + height) * unit - 1)
        draw.rounded_rectangle(box, radius=2 * unit, fill=colour)
    return image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def main(argv: list[str]) -> int:
    out = Path(argv[1])
    out.parent.mkdir(parents=True, exist_ok=True)
    draw_icon().save(out, format="PNG")
    print(f"[make_ios_icon] {out} ({SIZE}x{SIZE}, no alpha)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
