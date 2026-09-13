"""Acceptance tests for `.mcm` fonts.

Runs the checks from section 8 of the build handoff against one or more
font files and exits non-zero if any of them fail, so it drops straight
into CI. With no arguments it validates the vendored stock fonts, which is
the step-1 proof that the encoder and decoder agree with the real format.

Checks:

1. Structure -- 16385 lines, ``MAX7456`` header, 8 binary chars per line.
2. Coverage -- all 256 indexes present; coverage table printed.
3. Padding -- the 10 trailing bytes of every glyph are ``0x55``.
4. Pixels -- no ``11`` pairs emitted.
5. Round trip -- encode -> decode -> encode is byte-identical.
6. Re-render -- decoded ASCII art re-parses to the same pixels.
7. Protected glyphs -- ``0x00`` and ``0xFF`` match stock.
8. Stock diff -- report changed indexes, cross-checked against
   ``MODIFIED_INDEXES.md`` when that file exists.
9. Logo ranges -- boot splash and in-flight tiles do not overlap
   unintentionally. Skipped until the logo allocation exists.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Callable, Sequence

if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from mcm_decode import (
    McmParseError,
    dump_ascii,
    parse_ascii_dump,
    parse_mcm,
    parse_mcm_raw,
    split_lines,
)
from mcm_encode import (
    DATA_BYTES_PER_GLYPH,
    FIELD_BYTES_PER_GLYPH,
    GLYPH_COUNT,
    HEADER,
    PAD_BYTE,
    TOTAL_LINE_COUNT,
    Glyph,
    encode_font,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_STOCK = REPO_ROOT / "assets" / "references" / "stock" / "default_v2.mcm"
MODIFIED_INDEXES = REPO_ROOT / "MODIFIED_INDEXES.md"

#: Indexes that must never carry custom art.
#: 0x00 blanks the screen on video init; 0xFF is reserved.
PROTECTED_INDEXES = (0x00, 0xFF)

#: Boot splash tile block: SYM_LOGO is 0xA0 in Betaflight, 24x4 = 96 tiles,
#: which runs to 0xFF inclusive. Verified against betaflight-configurator
#: (src/js/utils/osdFont.js SYM.LOGO, src/js/LogoManager.js TILES_NUM_*).
LOGO_START = 0xA0
LOGO_TILES_HORIZ = 24
LOGO_TILES_VERT = 4
LOGO_TILE_COUNT = LOGO_TILES_HORIZ * LOGO_TILES_VERT  # 96


class CheckFailure(AssertionError):
    """Raised by a check to report a failure with a human-readable reason."""


class Reporter:
    """Collects check results and prints them as they run."""

    def __init__(self, verbose: bool = False) -> None:
        self.verbose = verbose
        self.failures: list[str] = []
        self.skipped: list[str] = []

    def run(self, number: int, title: str, check: Callable[[], str | None]) -> None:
        try:
            detail = check()
        except CheckFailure as exc:
            self.failures.append(f"{number}. {title}: {exc}")
            print(f"  FAIL  {number}. {title}")
            for line in str(exc).split("\n"):
                print(f"          {line}")
            return
        except (McmParseError, ValueError) as exc:
            self.failures.append(f"{number}. {title}: {exc}")
            print(f"  FAIL  {number}. {title}")
            print(f"          {exc}")
            return
        if detail is not None and detail.startswith("SKIP"):
            self.skipped.append(f"{number}. {title}")
            print(f"  SKIP  {number}. {title} -- {detail[4:].lstrip(': ')}")
            return
        suffix = f" -- {detail}" if detail else ""
        print(f"  ok    {number}. {title}{suffix}")


# -- individual checks ---------------------------------------------------


def check_structure(text: str, source: str) -> str:
    lines = split_lines(text)
    if lines[0].strip() != HEADER:
        raise CheckFailure(f"line 1 is {lines[0]!r}, expected {HEADER!r}")
    if len(lines) != TOTAL_LINE_COUNT:
        raise CheckFailure(
            f"file has {len(lines)} lines, expected {TOTAL_LINE_COUNT}"
        )
    for offset, line in enumerate(lines[1:], start=2):
        if len(line) != 8 or set(line) - {"0", "1"}:
            raise CheckFailure(
                f"line {offset} is not 8 binary characters: {line!r}"
            )
    trailing = "with" if text.endswith("\n") else "without"
    return f"{len(lines)} lines, {trailing} trailing newline"


def check_coverage(fields: Sequence[bytes], verbose: bool) -> str:
    if len(fields) != GLYPH_COUNT:
        raise CheckFailure(
            f"file yields {len(fields)} glyphs, expected {GLYPH_COUNT}"
        )
    wrong = [i for i, f in enumerate(fields) if len(f) != FIELD_BYTES_PER_GLYPH]
    if wrong:
        raise CheckFailure(
            f"{len(wrong)} glyphs are not {FIELD_BYTES_PER_GLYPH} bytes: "
            + ", ".join(f"0x{i:02X}" for i in wrong[:8])
        )
    if verbose:
        print_coverage_table(fields)
    return f"{GLYPH_COUNT}/{GLYPH_COUNT} indexes defined"


def check_padding(fields: Sequence[bytes]) -> str:
    bad: list[str] = []
    for index, field in enumerate(fields):
        pad = field[DATA_BYTES_PER_GLYPH:]
        if any(byte != PAD_BYTE for byte in pad):
            offenders = {f"0x{b:02X}" for b in pad if b != PAD_BYTE}
            bad.append(f"0x{index:02X} (saw {', '.join(sorted(offenders))})")
    if bad:
        raise CheckFailure(
            f"{len(bad)} glyphs have padding that is not 0x{PAD_BYTE:02X}: "
            + ", ".join(bad[:8])
        )
    pad_count = len(fields) * (FIELD_BYTES_PER_GLYPH - DATA_BYTES_PER_GLYPH)
    return f"{pad_count} padding bytes all 0x{PAD_BYTE:02X}"


def check_no_eleven_pairs(fields: Sequence[bytes]) -> str:
    offenders: list[int] = []
    for index, field in enumerate(fields):
        for byte in field[:DATA_BYTES_PER_GLYPH]:
            bits = f"{byte:08b}"
            if any(bits[i : i + 2] == "11" for i in range(0, 8, 2)):
                offenders.append(index)
                break
    if offenders:
        raise CheckFailure(
            f"{len(offenders)} glyphs emit '11' pixel pairs (normalize them "
            "to '01'): "
            + ", ".join(f"0x{i:02X}" for i in offenders[:8])
        )
    return "only 00 / 10 / 01 pairs present"


def check_round_trip(text: str, source: str) -> str:
    glyphs = parse_mcm(text, source=source)
    once = encode_font(glyphs)
    twice = encode_font(parse_mcm(once, source=f"{source} (re-encoded)"))
    if once != twice:
        raise CheckFailure("encode -> decode -> encode is not stable")

    canonical = "\n".join(split_lines(text))
    if once != canonical:
        # Locate the first divergence so the failure is actionable.
        for offset, (a, b) in enumerate(zip(canonical.split("\n"), once.split("\n"))):
            if a != b:
                raise CheckFailure(
                    f"re-encoding the file does not reproduce it; first "
                    f"difference at line {offset + 1}: file has {a!r}, "
                    f"encoder produces {b!r}"
                )
        raise CheckFailure("re-encoding the file does not reproduce it")
    return "byte-identical through encode -> decode -> encode"


def check_rerender(glyphs: Sequence[Glyph], source: str) -> str:
    reparsed = parse_ascii_dump(dump_ascii(glyphs), source=f"{source} (ascii)")
    mismatched = [
        index
        for index, (a, b) in enumerate(zip(glyphs, reparsed))
        if a.rows != b.rows
    ]
    if mismatched:
        raise CheckFailure(
            f"{len(mismatched)} glyphs differ after ASCII re-render: "
            + ", ".join(f"0x{i:02X}" for i in mismatched[:8])
        )
    return f"{len(glyphs)} glyphs match pixel for pixel"


def check_protected(fields: Sequence[bytes], stock: Sequence[bytes] | None) -> str:
    if stock is None:
        return "SKIP: no stock reference available"
    mismatched = [
        index for index in PROTECTED_INDEXES if fields[index] != stock[index]
    ]
    if mismatched:
        raise CheckFailure(
            "protected indexes differ from stock: "
            + ", ".join(f"0x{i:02X}" for i in mismatched)
        )
    return ", ".join(f"0x{i:02X}" for i in PROTECTED_INDEXES) + " match stock"


def check_stock_diff(
    fields: Sequence[bytes], stock: Sequence[bytes] | None, verbose: bool
) -> str:
    if stock is None:
        return "SKIP: no stock reference available"
    changed = [i for i in range(GLYPH_COUNT) if fields[i] != stock[i]]
    if verbose and changed:
        print("          changed: " + format_index_ranges(changed))

    declared = read_declared_indexes()
    if declared is None:
        return (
            f"{len(changed)} of {GLYPH_COUNT} indexes differ from stock "
            f"(MODIFIED_INDEXES.md not written yet)"
        )
    undeclared = sorted(set(changed) - declared)
    unchanged = sorted(declared - set(changed))
    problems: list[str] = []
    if undeclared:
        problems.append(
            "changed but not in MODIFIED_INDEXES.md: "
            + format_index_ranges(undeclared)
        )
    if unchanged:
        problems.append(
            "listed in MODIFIED_INDEXES.md but identical to stock: "
            + format_index_ranges(unchanged)
        )
    if problems:
        raise CheckFailure("\n".join(problems))
    return f"{len(changed)} changed indexes, all declared"


def check_logo_ranges() -> str:
    allocation = REPO_ROOT / "glyphs" / "logo.py"
    if not allocation.exists():
        return (
            "SKIP: glyphs/logo.py does not exist yet; boot splash occupies "
            f"0x{LOGO_START:02X}-0x{LOGO_START + LOGO_TILE_COUNT - 1:02X} "
            f"({LOGO_TILE_COUNT} tiles)"
        )
    raise CheckFailure(
        "glyphs/logo.py exists but the index allocation check is not "
        "implemented -- implement it alongside the logo (handoff step 4)"
    )


# -- helpers -------------------------------------------------------------


def format_index_ranges(indexes: Sequence[int]) -> str:
    """Collapse a sorted index list into ``0x20-0x7E, 0x90`` form."""
    if not indexes:
        return "(none)"
    parts: list[str] = []
    start = prev = indexes[0]
    for index in list(indexes[1:]) + [None]:
        if index is not None and index == prev + 1:
            prev = index
            continue
        parts.append(
            f"0x{start:02X}" if start == prev else f"0x{start:02X}-0x{prev:02X}"
        )
        if index is not None:
            start = prev = index
    return ", ".join(parts)


def print_coverage_table(fields: Sequence[bytes]) -> None:
    """Print a 16x16 map of which indexes carry ink."""
    print("          index coverage (# = has ink, . = fully transparent)")
    print("               " + " ".join(f"{c:X}" for c in range(16)))
    for row in range(16):
        cells = []
        for col in range(16):
            field = fields[row * 16 + col]
            data = field[:DATA_BYTES_PER_GLYPH]
            blank = all(byte == PAD_BYTE for byte in data)
            cells.append("." if blank else "#")
        print(f"          0x{row:X}_  " + " ".join(cells))


def read_declared_indexes() -> set[int] | None:
    """Parse the index column out of ``MODIFIED_INDEXES.md``.

    Returns ``None`` when the file does not exist yet, so check 8 degrades
    to a report rather than a failure before step 7.
    """
    if not MODIFIED_INDEXES.exists():
        return None
    declared: set[int] = set()
    for line in MODIFIED_INDEXES.read_text(encoding="utf-8").split("\n"):
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        first = stripped.strip("|").split("|")[0].strip().strip("`")
        try:
            declared.add(int(first, 16))
        except ValueError:
            continue
    return declared


def load_stock(path: Path) -> list[bytes] | None:
    if not path.exists():
        return None
    return parse_mcm_raw(path.read_text(encoding="ascii"), source=str(path))


def validate_font(path: Path, stock_path: Path, verbose: bool) -> Reporter:
    print(f"\n{path}")
    reporter = Reporter(verbose=verbose)
    text = path.read_text(encoding="ascii")

    reporter.run(1, "structure", lambda: check_structure(text, str(path)))
    if reporter.failures:
        # Every later check assumes a parseable file.
        print("          (remaining checks skipped: file is unparseable)")
        return reporter

    fields = parse_mcm_raw(text, source=str(path))
    glyphs = parse_mcm(text, source=str(path))
    stock = load_stock(stock_path)
    if stock is None:
        print(f"          note: stock reference {stock_path} not found")

    reporter.run(2, "coverage", lambda: check_coverage(fields, verbose))
    reporter.run(3, "padding", lambda: check_padding(fields))
    reporter.run(4, "pixel encoding", lambda: check_no_eleven_pairs(fields))
    reporter.run(5, "round trip", lambda: check_round_trip(text, str(path)))
    reporter.run(6, "ascii re-render", lambda: check_rerender(glyphs, str(path)))
    reporter.run(7, "protected glyphs", lambda: check_protected(fields, stock))
    reporter.run(8, "stock diff", lambda: check_stock_diff(fields, stock, verbose))
    reporter.run(9, "logo ranges", check_logo_ranges)
    return reporter


def _main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate .mcm fonts against the MAX7456 format spec."
    )
    parser.add_argument(
        "fonts",
        nargs="*",
        type=Path,
        help="fonts to validate (default: the vendored stock references)",
    )
    parser.add_argument(
        "--stock",
        type=Path,
        default=DEFAULT_STOCK,
        help=f"stock font to diff against (default: {DEFAULT_STOCK.name})",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="print the coverage table and the changed-index list",
    )
    args = parser.parse_args(argv)

    fonts = args.fonts
    if not fonts:
        fonts = sorted((REPO_ROOT / "assets" / "references" / "stock").glob("*.mcm"))
        if not fonts:
            parser.error("no fonts given and no vendored stock fonts found")

    missing = [f for f in fonts if not f.exists()]
    if missing:
        parser.error("no such file: " + ", ".join(str(f) for f in missing))

    failures: list[str] = []
    for font in fonts:
        reporter = validate_font(font, args.stock, args.verbose)
        failures.extend(f"{font}: {failure}" for failure in reporter.failures)

    print()
    if failures:
        print(f"FAILED -- {len(failures)} check(s) did not pass:")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print(f"PASSED -- {len(fonts)} font(s) validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
