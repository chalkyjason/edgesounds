"""Build the `.mcm` fonts described by ``variants.toml``.

One pipeline, every variant. The assembly is the same each time:

1. Start from the base art -- letters, numbers, punctuation, icons, and the
   sliced boot-splash tiles.
2. Layer the variant's icon overrides on top, in order.
3. Take ``0x00`` and ``0xFF`` from the stock font. They are protected: one
   blanks the screen on video init, the other is reserved.
4. Apply the variant's extra outlining to the ASCII block.
5. Assert all 256 indexes are defined -- an undefined index is a build
   failure, never a silently blank glyph.
6. Encode and write.

Run ``tools/validate.py`` afterwards (or ``--validate``) to check the
output against the acceptance tests.
"""

from __future__ import annotations

import argparse
import importlib
import sys
import tomllib
from pathlib import Path
from collections.abc import Sequence

if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mcm_decode import read_font
from mcm_encode import GLYPH_COUNT, Glyph, GlyphError, write_font
from outline_art import outline

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = REPO_ROOT / "variants.toml"

#: Indexes taken verbatim from the stock font. Never generated.
PROTECTED_INDEXES = (0x00, 0xFF)

#: The block that `extra_outline` applies to.
ASCII_BLOCK = range(0x20, 0x60)

TEXT_SETS = {
    "standard": [
        ("glyphs.letters", "LETTERS"),
        ("glyphs.numbers", "NUMBERS"),
        ("glyphs.punctuation", "PUNCTUATION"),
    ],
}


class BuildError(RuntimeError):
    """Raised when a variant cannot be assembled."""


def load_table(module_name: str, attribute: str | None = None) -> dict[int, str]:
    """Import a glyph module and return its index -> ASCII-art mapping."""
    module = importlib.import_module(module_name)
    if attribute is None:
        candidates = [
            name
            for name, value in vars(module).items()
            if name.isupper() and isinstance(value, dict) and value
        ]
        if len(candidates) != 1:
            raise BuildError(
                f"{module_name}: expected exactly one glyph table, found "
                f"{candidates or 'none'}"
            )
        attribute = candidates[0]
    table = getattr(module, attribute)
    if not isinstance(table, dict):
        raise BuildError(f"{module_name}.{attribute} is not a dict")
    return table


def assemble(
    text_set: str,
    icon_overrides: Sequence[str],
    logo_module: str,
    extra_outline: int,
    stock: Sequence[Glyph],
) -> list[Glyph]:
    """Build one variant's 256 glyphs."""
    if text_set not in TEXT_SETS:
        raise BuildError(
            f"unknown text_set {text_set!r}; known: {sorted(TEXT_SETS)}"
        )

    art: dict[int, str] = {}
    sources: dict[int, str] = {}

    def layer(table: dict[int, str], origin: str, *, overriding: bool = False) -> None:
        for index, glyph_art in table.items():
            if index in art and not overriding:
                raise BuildError(
                    f"index 0x{index:02X} defined twice: "
                    f"{sources[index]} and {origin}"
                )
            art[index] = glyph_art
            sources[index] = origin

    for module_name, attribute in TEXT_SETS[text_set]:
        layer(load_table(module_name, attribute), module_name)
    layer(load_table("glyphs.icons", "ICONS"), "glyphs.icons")
    layer(load_table(logo_module, "LOGO_TILES"), logo_module)

    for module_name in icon_overrides:
        layer(load_table(module_name), module_name, overriding=True)

    for index in PROTECTED_INDEXES:
        if index in art:
            raise BuildError(
                f"index 0x{index:02X} is protected but {sources[index]} "
                "defines art for it"
            )

    glyphs: list[Glyph] = []
    missing: list[int] = []
    for index in range(GLYPH_COUNT):
        if index in PROTECTED_INDEXES:
            glyphs.append(stock[index])
            continue
        if index not in art:
            missing.append(index)
            glyphs.append(Glyph.blank())
            continue
        glyph = Glyph.from_ascii(art[index], name=f"0x{index:02X}")
        if extra_outline and index in ASCII_BLOCK:
            glyph = Glyph(
                outline(glyph.rows, weight=extra_outline).split("\n"),
                name=glyph.name,
            )
        glyphs.append(glyph)

    if missing:
        listed = ", ".join(f"0x{i:02X}" for i in missing[:12])
        more = f" (+{len(missing) - 12} more)" if len(missing) > 12 else ""
        raise BuildError(
            f"{len(missing)} glyph indexes are undefined: {listed}{more}. "
            "Every index must be explicit -- the build will not ship a "
            "blank glyph by accident."
        )
    return glyphs


def apply_craft_name(
    glyphs: list[Glyph], logo_module: str
) -> tuple[list[Glyph], str, list[tuple[int, str]]]:
    """Copy the wordmark tiles onto sacrificial ASCII slots.

    The craft-name route, which is what works on Betaflight 4.4 through
    current: the craft-name field reaches only typeable ASCII indexes, so
    showing the wordmark in flight means overwriting glyphs that live at
    those indexes. Returns the modified glyphs, the craft name to type, and
    the slots consumed.
    """
    module = importlib.import_module(logo_module)
    wordmark = list(module.WORDMARK_INDEXES)
    slots = list(module.CRAFT_NAME_SLOTS)[: len(wordmark)]
    if len(slots) < len(wordmark):
        raise BuildError(
            f"the wordmark needs {len(wordmark)} slots but only "
            f"{len(slots)} are defined"
        )
    out = list(glyphs)
    for (slot_index, _), tile_index in zip(slots, wordmark, strict=True):
        out[slot_index] = glyphs[tile_index]
    return out, "".join(char for _, char in slots), slots


def build(
    config_path: Path,
    only: Sequence[str] | None = None,
    craft_name: bool = False,
) -> list[Path]:
    config = tomllib.loads(config_path.read_text(encoding="utf-8"))
    meta = config.get("meta", {})
    stock_path = REPO_ROOT / meta.get(
        "protected_source", "assets/references/stock/default_v2.mcm"
    )
    if not stock_path.exists():
        raise BuildError(
            f"stock reference {stock_path} is missing; 0x00 and 0xFF must "
            "come from it"
        )
    stock = read_font(stock_path)
    output_dir = REPO_ROOT / meta.get("output_dir", "fonts")
    logo_module = meta.get("logo_module", "glyphs.logo")

    craft_cfg = config.get("craft_name", {})
    want_craft = craft_name or craft_cfg.get("enabled", False)
    suffix = craft_cfg.get("suffix", "_craftname")

    written: list[Path] = []
    for name, spec in config.get("variants", {}).items():
        if only and name not in only:
            continue
        glyphs = assemble(
            text_set=spec.get("text_set", "standard"),
            icon_overrides=spec.get("icon_overrides", []),
            logo_module=logo_module,
            extra_outline=int(spec.get("extra_outline", 0)),
            stock=stock,
        )
        path = write_font(output_dir / spec["output"], glyphs)
        written.append(path)
        changed = sum(1 for i in range(GLYPH_COUNT) if glyphs[i] != stock[i])
        print(f"built {path.relative_to(REPO_ROOT)}  ({changed}/256 differ from stock)")

        if want_craft:
            craft_glyphs, craft_text, slots = apply_craft_name(glyphs, logo_module)
            craft_path = write_font(
                output_dir / f"{Path(spec['output']).stem}{suffix}.mcm",
                craft_glyphs,
            )
            written.append(craft_path)
            consumed = ", ".join(f"0x{i:02X} {c!r}" for i, c in slots)
            print(
                f"built {craft_path.relative_to(REPO_ROOT)}  "
                f"(craft name: {craft_text!r})"
            )
            print(f"      sacrificed: {consumed}")

    if not written:
        raise BuildError("no variants matched; check variants.toml and --only")
    return written


def _main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the Army Jay OSD fonts.")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument(
        "--only",
        action="append",
        metavar="VARIANT",
        help="build only this variant (repeatable)",
    )
    parser.add_argument(
        "--craft-name",
        action="store_true",
        help=(
            "also build the Betaflight 4.4 craft-name variants, which "
            "relocate the wordmark onto sacrificial punctuation slots"
        ),
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="run the acceptance checks on the built fonts",
    )
    args = parser.parse_args(argv)

    try:
        written = build(args.config, only=args.only, craft_name=args.craft_name)
    except (BuildError, GlyphError) as exc:
        print(f"build failed: {exc}", file=sys.stderr)
        return 1

    if args.validate:
        import validate

        return validate._main([str(p) for p in written])
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
