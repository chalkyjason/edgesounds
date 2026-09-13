"""MAX7456 `.mcm` decoder.

Parses a font file into :class:`~mcm_encode.Glyph` objects and can dump it
back out as reviewable ASCII art. The parser is deliberately stricter than
Betaflight Configurator's: it rejects anything that would not round trip,
because a font that only *mostly* parses is a font that renders garbage in
goggles.

Two levels of parsing are offered:

* :func:`parse_mcm` -- structural. Enforces header, line count, line width,
  and character set. Returns glyphs.
* :func:`parse_mcm_raw` -- the same, but also hands back the raw 64-byte
  fields per glyph so ``validate.py`` can inspect padding and pixel pairs
  that the :class:`Glyph` model normalises away.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Sequence

if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from mcm_encode import (
    DATA_LINE_COUNT,
    FIELD_BYTES_PER_GLYPH,
    GLYPH_COUNT,
    GLYPH_HEIGHT,
    HEADER,
    Glyph,
    GlyphError,
)


class McmParseError(ValueError):
    """Raised when a `.mcm` file does not conform to the format."""


def split_lines(text: str) -> list[str]:
    """Split `.mcm` text into lines, tolerating CRLF and a trailing newline.

    The stock fonts end without a trailing newline; some editors add one.
    Both are accepted, and both re-encode identically.
    """
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    if text.endswith("\n"):
        text = text[:-1]
    return text.split("\n")


def parse_mcm_raw(text: str, source: str = "<string>") -> list[bytes]:
    """Parse `.mcm` text into 256 raw 64-byte glyph fields.

    Validates the file's structure but not its semantics -- padding bytes
    and ``11`` pixel pairs are preserved verbatim so callers can check them.
    """
    lines = split_lines(text)
    if not lines:
        raise McmParseError(f"{source}: file is empty")
    if lines[0].strip() != HEADER:
        raise McmParseError(
            f"{source}: line 1 must be {HEADER!r}, got {lines[0]!r}"
        )

    data = lines[1:]
    if len(data) != DATA_LINE_COUNT:
        raise McmParseError(
            f"{source}: expected {DATA_LINE_COUNT} byte lines after the "
            f"header ({DATA_LINE_COUNT + 1} lines total), got {len(data)} "
            f"({len(data) + 1} total)"
        )

    for offset, line in enumerate(data):
        if len(line) != 8:
            raise McmParseError(
                f"{source}: line {offset + 2} has {len(line)} characters, "
                f"expected 8: {line!r}"
            )
        if set(line) - {"0", "1"}:
            raise McmParseError(
                f"{source}: line {offset + 2} is not binary: {line!r}"
            )

    fields: list[bytes] = []
    for index in range(GLYPH_COUNT):
        start = index * FIELD_BYTES_PER_GLYPH
        chunk = data[start : start + FIELD_BYTES_PER_GLYPH]
        fields.append(bytes(int(line, 2) for line in chunk))
    return fields


def parse_mcm(text: str, source: str = "<string>") -> list[Glyph]:
    """Parse `.mcm` text into 256 glyphs."""
    fields = parse_mcm_raw(text, source=source)
    return [
        Glyph.from_bytes(field, name=f"0x{index:02X}")
        for index, field in enumerate(fields)
    ]


def read_font(path: Path | str) -> list[Glyph]:
    """Read and parse a `.mcm` file from disk."""
    path = Path(path)
    return parse_mcm(path.read_text(encoding="ascii"), source=str(path))


def read_font_raw(path: Path | str) -> list[bytes]:
    """Read a `.mcm` file from disk as raw 64-byte glyph fields."""
    path = Path(path)
    return parse_mcm_raw(path.read_text(encoding="ascii"), source=str(path))


# -- ASCII dump format ---------------------------------------------------
#
# A dump is a reviewable, diffable text rendering of a whole font: one
# header line per glyph followed by its 18 rows. It round trips through
# parse_ascii_dump, which is what lets validate.py assert that the decoded
# art and the encoded bytes describe the same pixels.

_DUMP_PREFIX = "# glyph "


def dump_ascii(glyphs: Sequence[Glyph], labels: Sequence[str] | None = None) -> str:
    """Render a font as an ASCII-art dump."""
    out: list[str] = []
    for index, glyph in enumerate(glyphs):
        label = f" {labels[index]}" if labels else ""
        out.append(f"{_DUMP_PREFIX}{index:3d} 0x{index:02X}{label}")
        out.extend(glyph.rows)
    return "\n".join(out) + "\n"


def parse_ascii_dump(text: str, source: str = "<string>") -> list[Glyph]:
    """Parse an ASCII-art dump back into glyphs."""
    glyphs: list[Glyph] = []
    rows: list[str] = []
    name = ""

    def flush() -> None:
        if not rows and not name:
            return
        try:
            glyphs.append(Glyph(rows, name=name))
        except GlyphError as exc:
            raise McmParseError(f"{source}: {exc}") from exc
        rows.clear()

    for raw in text.split("\n"):
        line = raw.rstrip("\r")
        if line.startswith(_DUMP_PREFIX):
            flush()
            name = line[len(_DUMP_PREFIX) :].strip()
            continue
        if not line.strip():
            continue
        rows.append(line)
        if len(rows) == GLYPH_HEIGHT:
            flush()
            name = ""
    flush()

    if len(glyphs) != GLYPH_COUNT:
        raise McmParseError(
            f"{source}: dump describes {len(glyphs)} glyphs, "
            f"expected {GLYPH_COUNT}"
        )
    return glyphs


def _main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Decode a .mcm font to reviewable ASCII art."
    )
    parser.add_argument("font", type=Path, help=".mcm file to decode")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="write the dump here instead of stdout",
    )
    parser.add_argument(
        "-i",
        "--index",
        type=lambda v: int(v, 0),
        action="append",
        help="decode only this glyph index (repeatable; accepts 0x41)",
    )
    args = parser.parse_args(argv)

    glyphs = read_font(args.font)
    if args.index:
        for index in args.index:
            if not 0 <= index < GLYPH_COUNT:
                parser.error(f"index {index} out of range 0..255")
            print(f"{_DUMP_PREFIX}{index:3d} 0x{index:02X}")
            print(glyphs[index].to_ascii())
        return 0

    dump = dump_ascii(glyphs)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(dump, encoding="ascii", newline="\n")
        print(f"wrote {args.output} ({GLYPH_COUNT} glyphs)")
    else:
        sys.stdout.write(dump)
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
