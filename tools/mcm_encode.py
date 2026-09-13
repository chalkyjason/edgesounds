"""MAX7456 `.mcm` encoder and the shared glyph model.

This module owns the authoritative description of the on-disk format. Every
other tool in the pipeline imports its constants from here rather than
restating them, so there is exactly one place where the spec lives.

Format (verified against the stock Betaflight fonts in
``assets/references/stock/``):

* Plain ASCII text.
* Line 1 is ``MAX7456``.
* Lines 2..16385 are exactly 16384 lines of 8 ``0``/``1`` characters, one
  byte each: 256 glyphs x 64 bytes.
* A glyph is 12 px wide x 18 px tall = 216 pixels at 2 bits per pixel, so
  54 bytes of real data, padded out to the 64-byte NVM field with 10 bytes
  of ``0x55``.
* Pixels run left-to-right, top-to-bottom.
* ``00`` black, ``10`` white, ``01`` transparent. ``11`` also reads as
  transparent on the hardware but is never emitted -- all transparent
  pixels normalize to ``01``.

The stock fonts ship without a trailing newline on the final byte line, and
this encoder matches that so a decode/encode round trip is byte-identical.

Glyphs are authored as 12x18 ASCII art:

* ``.`` transparent
* ``#`` white
* ``-`` black
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from collections.abc import Iterable, Sequence

HEADER = "MAX7456"

GLYPH_COUNT = 256
GLYPH_WIDTH = 12
GLYPH_HEIGHT = 18
PIXELS_PER_GLYPH = GLYPH_WIDTH * GLYPH_HEIGHT  # 216

PIXELS_PER_BYTE = 4
DATA_BYTES_PER_GLYPH = PIXELS_PER_GLYPH // PIXELS_PER_BYTE  # 54
FIELD_BYTES_PER_GLYPH = 64
PAD_BYTES_PER_GLYPH = FIELD_BYTES_PER_GLYPH - DATA_BYTES_PER_GLYPH  # 10
PAD_BYTE = 0b01010101  # 0x55

DATA_LINE_COUNT = GLYPH_COUNT * FIELD_BYTES_PER_GLYPH  # 16384
TOTAL_LINE_COUNT = DATA_LINE_COUNT + 1  # 16385, including the header

TRANSPARENT = "."
WHITE = "#"
BLACK = "-"
PIXEL_CHARS = (TRANSPARENT, WHITE, BLACK)

#: ASCII-art character -> the 2-bit pair written to the file.
CHAR_TO_BITS = {
    BLACK: "00",
    WHITE: "10",
    TRANSPARENT: "01",
}

#: The reverse mapping. ``11`` is accepted on read (some third-party fonts
#: emit it) and folded to transparent; it is never produced on write.
BITS_TO_CHAR = {
    "00": BLACK,
    "10": WHITE,
    "01": TRANSPARENT,
    "11": TRANSPARENT,
}


class GlyphError(ValueError):
    """Raised when glyph art or encoded glyph data is malformed."""


class Glyph:
    """One 12x18 glyph, stored as 18 rows of 12 ASCII-art characters."""

    __slots__ = ("rows", "name")

    def __init__(self, rows: Sequence[str], name: str = "") -> None:
        rows = tuple(rows)
        if len(rows) != GLYPH_HEIGHT:
            raise GlyphError(
                f"{name or 'glyph'}: expected {GLYPH_HEIGHT} rows, got {len(rows)}"
            )
        for y, row in enumerate(rows):
            if len(row) != GLYPH_WIDTH:
                raise GlyphError(
                    f"{name or 'glyph'}: row {y} has {len(row)} chars, "
                    f"expected {GLYPH_WIDTH}: {row!r}"
                )
            bad = sorted(set(row) - set(PIXEL_CHARS))
            if bad:
                raise GlyphError(
                    f"{name or 'glyph'}: row {y} has illegal characters {bad}; "
                    f"legal characters are {list(PIXEL_CHARS)}"
                )
        self.rows = rows
        self.name = name

    # -- construction ----------------------------------------------------

    @classmethod
    def from_ascii(cls, art: str, name: str = "") -> "Glyph":
        """Parse a triple-quoted ASCII-art block into a glyph.

        Leading and trailing blank lines are ignored so glyph sources can be
        written naturally in Python source. Every remaining line must be
        exactly 12 legal characters.
        """
        lines = [line.rstrip("\r") for line in art.split("\n")]
        while lines and not lines[0].strip():
            lines.pop(0)
        while lines and not lines[-1].strip():
            lines.pop()
        return cls(lines, name=name)

    @classmethod
    def blank(cls, name: str = "") -> "Glyph":
        """A fully transparent glyph."""
        return cls([TRANSPARENT * GLYPH_WIDTH] * GLYPH_HEIGHT, name=name)

    @classmethod
    def from_bytes(cls, data: bytes, name: str = "") -> "Glyph":
        """Decode a 64-byte (or 54-byte) NVM field into a glyph.

        Padding bytes beyond the first 54 are ignored here; ``validate.py``
        is what asserts they are ``0x55``.
        """
        if len(data) not in (DATA_BYTES_PER_GLYPH, FIELD_BYTES_PER_GLYPH):
            raise GlyphError(
                f"{name or 'glyph'}: expected {DATA_BYTES_PER_GLYPH} or "
                f"{FIELD_BYTES_PER_GLYPH} bytes, got {len(data)}"
            )
        bits = "".join(f"{byte:08b}" for byte in data[:DATA_BYTES_PER_GLYPH])
        chars = [BITS_TO_CHAR[bits[i : i + 2]] for i in range(0, len(bits), 2)]
        rows = [
            "".join(chars[y * GLYPH_WIDTH : (y + 1) * GLYPH_WIDTH])
            for y in range(GLYPH_HEIGHT)
        ]
        return cls(rows, name=name)

    # -- serialisation ---------------------------------------------------

    def to_ascii(self) -> str:
        """Render back to the ASCII-art form accepted by :meth:`from_ascii`."""
        return "\n".join(self.rows)

    def to_bytes(self) -> bytes:
        """Encode to the full 64-byte NVM field, padding included."""
        bits = "".join(CHAR_TO_BITS[char] for row in self.rows for char in row)
        assert len(bits) == PIXELS_PER_GLYPH * 2
        data = bytes(
            int(bits[i : i + 8], 2) for i in range(0, len(bits), 8)
        )
        return data + bytes([PAD_BYTE] * PAD_BYTES_PER_GLYPH)

    def to_lines(self) -> list[str]:
        """Encode to the 64 eight-character byte lines written to the file."""
        return [f"{byte:08b}" for byte in self.to_bytes()]

    # -- dunders ---------------------------------------------------------

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Glyph):
            return NotImplemented
        return self.rows == other.rows

    def __hash__(self) -> int:
        return hash(self.rows)

    def __repr__(self) -> str:
        label = f" {self.name!r}" if self.name else ""
        return f"<Glyph{label} {GLYPH_WIDTH}x{GLYPH_HEIGHT}>"


def encode_font(glyphs: Sequence[Glyph]) -> str:
    """Serialise exactly 256 glyphs to `.mcm` text.

    The returned string has no trailing newline, matching the stock fonts
    byte for byte.
    """
    if len(glyphs) != GLYPH_COUNT:
        raise GlyphError(
            f"a font needs exactly {GLYPH_COUNT} glyphs, got {len(glyphs)}"
        )
    lines: list[str] = [HEADER]
    for glyph in glyphs:
        lines.extend(glyph.to_lines())
    assert len(lines) == TOTAL_LINE_COUNT
    return "\n".join(lines)


def write_font(path: Path | str, glyphs: Sequence[Glyph]) -> Path:
    """Write a font to ``path``. Returns the path written."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # newline="\n" so a build on Windows still produces LF, as the format
    # requires and as the round-trip test asserts.
    path.write_text(encode_font(glyphs), encoding="ascii", newline="\n")
    return path


def glyphs_from_ascii_map(source: Iterable[tuple[int, str, str]]) -> list[Glyph]:
    """Build a 256-glyph font from ``(index, name, ascii_art)`` triples.

    Fails loudly on a duplicate index or on any index left undefined -- the
    build must never silently ship a blank glyph.
    """
    slots: dict[int, Glyph] = {}
    for index, name, art in source:
        if not 0 <= index < GLYPH_COUNT:
            raise GlyphError(f"{name}: index {index} out of range 0..255")
        if index in slots:
            raise GlyphError(
                f"index 0x{index:02X} defined twice: "
                f"{slots[index].name!r} and {name!r}"
            )
        slots[index] = Glyph.from_ascii(art, name=name)
    missing = [i for i in range(GLYPH_COUNT) if i not in slots]
    if missing:
        preview = ", ".join(f"0x{i:02X}" for i in missing[:16])
        more = f" (+{len(missing) - 16} more)" if len(missing) > 16 else ""
        raise GlyphError(
            f"{len(missing)} glyph indexes are undefined: {preview}{more}"
        )
    return [slots[i] for i in range(GLYPH_COUNT)]


def _main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Encode an ASCII-art glyph dump (as produced by mcm_decode.py "
            "--ascii) back into a .mcm font."
        )
    )
    parser.add_argument("source", type=Path, help="ASCII-art dump to encode")
    parser.add_argument("output", type=Path, help=".mcm file to write")
    args = parser.parse_args(argv)

    # Imported lazily: the decoder imports this module, not the other way
    # round, so pulling it in at call time keeps the dependency one-way.
    from mcm_decode import parse_ascii_dump

    glyphs = parse_ascii_dump(args.source.read_text(encoding="ascii"))
    write_font(args.output, glyphs)
    print(f"wrote {args.output} ({len(glyphs)} glyphs)")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(_main())
