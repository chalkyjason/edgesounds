"""Drive the Configurator cross-check: build the fixture, run the Node harness.

Our encoder and Betaflight Configurator's parser are independent
implementations of the same spec. This is the closest thing to a hardware
test that can be run without hardware: it executes Configurator's real
source over our built fonts and our boot splash, and checks that both
implementations agree pixel for pixel and byte for byte.

Needs a checkout of betaflight-configurator and Node. Both are optional --
without them this exits 0 with a skip, so CI on a machine that has neither
is not blocked.

    python tools/crosscheck_configurator.py
    python tools/crosscheck_configurator.py --configurator /path/to/checkout
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from collections.abc import Sequence

if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mcm_decode import read_font, read_font_raw
from mcm_encode import BLACK, DATA_BYTES_PER_GLYPH, WHITE, Glyph

REPO_ROOT = Path(__file__).resolve().parent.parent
HARNESS = Path(__file__).resolve().parent / "crosscheck_configurator.mjs"
DEFAULT_LOGO = REPO_ROOT / "assets" / "logo_288x72.png"

#: Where a checkout might reasonably be. add_repo clones to the first.
CANDIDATE_CHECKOUTS = (
    Path("/home/user/betaflight/betaflight-configurator"),
    Path("/home/user/betaflight-configurator"),
    REPO_ROOT.parent / "betaflight-configurator",
)

#: Configurator's own pixel encoding: 0 black, 2 white, 1 transparent.
PIXEL_CODE = {BLACK: 0, WHITE: 2}


def find_configurator(explicit: Path | None) -> Path | None:
    if explicit:
        return explicit if (explicit / "src" / "js").is_dir() else None
    for candidate in CANDIDATE_CHECKOUTS:
        if (candidate / "src" / "js" / "utils" / "osdFont.js").exists():
            return candidate
    return None


def glyph_pixels(glyph: Glyph) -> list[int]:
    return [PIXEL_CODE.get(char, 1) for row in glyph.rows for char in row]


def build_fixture(
    configurator: Path, fonts: Sequence[Path], logo: Path
) -> dict:
    from PIL import Image

    font_entries = []
    for path in fonts:
        glyphs = read_font(path)
        fields = read_font_raw(path)
        font_entries.append(
            {
                "name": path.name,
                "path": str(path),
                "pixels": [glyph_pixels(g) for g in glyphs],
                "uploadBytes": [
                    list(field[:DATA_BYTES_PER_GLYPH]) for field in fields
                ],
            }
        )

    image = Image.open(logo).convert("RGBA")
    # The tiles as they exist in the built font, for the logo comparison.
    reference = read_font(fonts[0])
    tiles = [
        [f"{byte:08b}" for byte in reference[0xA0 + i].to_bytes()]
        for i in range(96)
    ]

    return {
        "osdFontPath": str(configurator / "src" / "js" / "utils" / "osdFont.js"),
        "logoManagerPath": str(configurator / "src" / "js" / "LogoManager.js"),
        "fonts": font_entries,
        "logo": {
            "name": logo.name,
            "width": image.width,
            "height": image.height,
            "rgba": list(image.tobytes()),
            "tiles": tiles,
        },
    }


def _main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--configurator", type=Path, default=None)
    parser.add_argument("--logo", type=Path, default=DEFAULT_LOGO)
    parser.add_argument(
        "fonts",
        nargs="*",
        type=Path,
        help="fonts to check (default: every .mcm in fonts/)",
    )
    args = parser.parse_args(argv)

    configurator = find_configurator(args.configurator)
    if configurator is None:
        print(
            "SKIP: no betaflight-configurator checkout found. Clone it and "
            "re-run to cross-check against Configurator's own parser:\n"
            "  git clone --depth 1 "
            "https://github.com/betaflight/betaflight-configurator"
        )
        return 0
    if shutil.which("node") is None:
        print("SKIP: node not found; the cross-check harness needs it.")
        return 0

    fonts = args.fonts or sorted((REPO_ROOT / "fonts").glob("*.mcm"))
    if not fonts:
        parser.error("no fonts found; run tools/build_font.py first")
    if not args.logo.exists():
        parser.error(f"{args.logo} missing; run tools/make_logo.py first")

    revision = subprocess.run(
        ["git", "-C", str(configurator), "rev-parse", "--short", "HEAD"],
        capture_output=True,
        text=True,
    ).stdout.strip()
    print(
        f"Cross-checking against betaflight-configurator "
        f"{revision or '(unknown revision)'} at {configurator}"
    )

    fixture = build_fixture(configurator, fonts, args.logo)
    with tempfile.TemporaryDirectory() as tmp:
        fixture_path = Path(tmp) / "fixture.json"
        fixture_path.write_text(json.dumps(fixture), encoding="utf-8")
        result = subprocess.run(
            ["node", str(HARNESS), str(fixture_path)],
            text=True,
        )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(_main())
