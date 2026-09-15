#!/usr/bin/env python3
"""Regenerate web/public/og.png — the 1200x630 social card.

The card is drawn rather than screenshotted so it stays reproducible without a
browser in the loop. Palette is pulled from tailwind.config.js by hand:
accent #00ff9d, accent-dim #00cc7e, zinc-950 #09090b.

Usage:  python3 scripts/generate-og.py       (needs Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = (9, 9, 11)
ACCENT = (0, 255, 157)
ACCENT_DIM = (0, 204, 126)
ZINC_300 = (212, 212, 216)
ZINC_400 = (161, 161, 170)
ZINC_500 = (113, 113, 122)
ZINC_700 = (63, 63, 70)
ZINC_800 = (39, 39, 42)
WHITE = (250, 250, 250)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "og.png"

HELV = "/System/Library/Fonts/Helvetica.ttc"
MENLO = "/System/Library/Fonts/Menlo.ttc"


def font(path, size, index=0):
    return ImageFont.truetype(path, size, index=index)


def radial_glow(size, rgb, peak, falloff):
    """Soft radial gradient as an RGBA layer. Rendered small, then upscaled."""
    n = 180
    mask = Image.new("L", (n, n), 0)
    px = mask.load()
    c = (n - 1) / 2
    for y in range(n):
        for x in range(n):
            d = (((x - c) ** 2 + (y - c) ** 2) ** 0.5) / c
            v = max(0.0, 1.0 - d / falloff)
            px[x, y] = int(255 * peak * v * v)
    mask = mask.resize((size, size), Image.LANCZOS)
    layer = Image.new("RGBA", (size, size), rgb + (0,))
    layer.putalpha(mask)
    return layer


def main():
    img = Image.new("RGB", (W, H), BG)

    # Faint 48px grid, drawn on its own layer so the alpha stays subtle.
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, W, 48):
        gd.line([(x, 0), (x, H)], fill=(255, 255, 255, 7))
    for y in range(0, H, 48):
        gd.line([(0, y), (W, y)], fill=(255, 255, 255, 7))
    img = Image.alpha_composite(img.convert("RGBA"), grid)

    img.alpha_composite(radial_glow(920, ACCENT, 0.24, 0.66), (760, -330))
    img.alpha_composite(radial_glow(780, ACCENT, 0.10, 0.66), (-320, 230))

    d = ImageDraw.Draw(img)
    PAD = 84

    # Waveform mark — same five-bar motif as favicon.svg, bottom-aligned.
    bars = [(26, ACCENT_DIM), (52, ACCENT), (62, ACCENT), (36, ACCENT), (18, ACCENT_DIM)]
    bw, gap, base_y = 13, 9, 170
    x = PAD
    for h, color in bars:
        d.rounded_rectangle([x, base_y - h, x + bw, base_y], radius=bw // 2, fill=color)
        x += bw + gap

    # Wordmark: "Edge" in white, "Sounds" in accent, drawn as two runs.
    f_title = font(HELV, 104, index=1)
    y_title = 214
    d.text((PAD, y_title), "Army", font=f_title, fill=WHITE)
    army_w = d.textlength("Army ", font=f_title)
    d.text((PAD + army_w, y_title), "Jay", font=f_title, fill=ACCENT)

    d.text((PAD, 352), "FPV sounds and OSD fonts.", font=font(HELV, 40), fill=ZINC_300)

    # Spec strip, bottom-left, with dot separators.
    f_mono = font(MENLO, 23)
    x, y = PAD, 534
    parts = [("EdgeTX .wav", ACCENT), ("MAX7456 .mcm", ACCENT),
             ("in your browser", ZINC_500)]
    for i, (text, color) in enumerate(parts):
        if i:
            x += 15
            d.ellipse([x, y + 12, x + 5, y + 17], fill=ZINC_700)
            x += 5 + 15
        d.text((x, y), text, font=f_mono, fill=color)
        x += d.textlength(text, font=f_mono)

    # Domain pill, bottom-right.
    f_badge = font(MENLO, 22)
    label = "armyjay.pages.dev"
    tw = d.textlength(label, font=f_badge)
    bx1, by1 = W - PAD, 570
    bx0, by0 = bx1 - (tw + 52), by1 - 52
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=26, fill=(24, 24, 27), outline=ZINC_800, width=1)
    d.text((bx0 + 26, by0 + 14), label, font=f_badge, fill=ZINC_400)

    img.convert("RGB").save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
