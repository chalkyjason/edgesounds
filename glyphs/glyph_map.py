"""The authoritative Betaflight analog OSD glyph map.

Every one of the 256 indexes is named and described here. This is the
single source of truth for what each slot *means*; the art modules decide
what it looks like, and ``MODIFIED_INDEXES.md`` is generated from this
table so the docs cannot drift from the build.

Sources, both read directly rather than recalled:

* ``src/main/drivers/osd_symbols.h`` in betaflight/betaflight (master) --
  the firmware's own symbol constants.
* ``src/js/utils/osdFont.js`` in betaflight/betaflight-configurator
  (commit 505bd6d) -- the subset Configurator renders, which agrees.

Where the two disagree with what the stock font actually draws, the stock
art wins and the discrepancy is noted on the entry. See ``0x24``.

A note on ASCII. Betaflight's analog OSD is uppercase-only: indexes
``0x60``-``0x7E``, which are lowercase and trailing punctuation in ASCII,
are direction arrows and unit icons in every stock Betaflight font. The
handoff's "0x20-0x7E must retain their ASCII meanings" therefore cannot be
applied literally past ``0x5F`` without breaking the firmware. The rule is
honoured where Betaflight honours it -- ``0x20``-``0x5F`` keep true ASCII
(bar ``0x24``) -- and the firmware map wins above that.
"""

from __future__ import annotations

from typing import NamedTuple

#: Indexes that must never carry custom art.
PROTECTED = (0x00, 0xFF)

#: Boot splash tile block. 24 wide x 4 rows from SYM_LOGO_START.
LOGO_START = 0xA0
LOGO_COLUMNS = 24
LOGO_ROWS = 4
LOGO_TILE_COUNT = LOGO_COLUMNS * LOGO_ROWS  # 96, running 0xA0..0xFF

#: The last splash tile collides with protected 0xFF, so the artwork uses
#: 95 tiles and leaves the bottom-right corner transparent -- which is
#: exactly what the stock Betaflight splash does.
LOGO_USABLE_END = 0xFE


class Slot(NamedTuple):
    """One glyph index: what Betaflight calls it and what it is for."""

    index: int
    symbol: str
    meaning: str
    category: str  # ascii | icon | arrow | logo | protected | unassigned


def _ascii_slots() -> list[Slot]:
    """0x20-0x5F, which keep their true ASCII meanings."""
    names = {
        0x20: ("SYM_BLANK", "space"),
        0x21: ("", "exclamation mark"),
        0x22: ("SYM_GPS_SECOND", 'double quote / GPS seconds'),
        0x23: ("", "hash"),
        0x24: (
            "SYM_CHECKERED_FLAG",
            'lap timer flag -- stock draws the word "MAX"; art follows stock',
        ),
        0x25: ("", "percent"),
        0x26: ("", "ampersand"),
        0x27: ("SYM_GPS_MINUTE", "apostrophe / GPS minutes"),
        0x28: ("", "left parenthesis"),
        0x29: ("", "right parenthesis"),
        0x2A: ("", "asterisk"),
        0x2B: ("", "plus"),
        0x2C: ("", "comma"),
        0x2D: ("SYM_HYPHEN", "hyphen / minus"),
        0x2E: ("", "period"),
        0x2F: ("", "forward slash"),
        0x3A: ("", "colon"),
        0x3B: ("", "semicolon"),
        0x3C: ("", "less than"),
        0x3D: ("", "equals"),
        0x3E: ("", "greater than"),
        0x3F: ("", "question mark"),
        0x40: ("", "at sign"),
        0x5B: ("", "left bracket"),
        0x5C: ("", "backslash"),
        0x5D: ("", "right bracket"),
        0x5E: ("", "caret"),
        0x5F: ("", "underscore"),
    }
    slots = []
    for index in range(0x20, 0x60):
        if index in names:
            symbol, meaning = names[index]
        elif 0x30 <= index <= 0x39:
            symbol, meaning = "", f"digit {index - 0x30}"
        elif 0x41 <= index <= 0x5A:
            symbol, meaning = "", f"letter {chr(index)}"
        else:  # pragma: no cover - the table above is exhaustive
            raise AssertionError(f"unmapped ASCII index 0x{index:02X}")
        slots.append(Slot(index, symbol, meaning, "ascii"))
    return slots


#: Betaflight's arrow block runs anticlockwise: 0x60 is south, 0x64 east,
#: 0x68 north, 0x6C west, so the bearing *decreases* by 22.5 degrees per
#: index. Getting this backwards points every home arrow the wrong side of
#: the S-N axis, so the ordering is asserted by the test suite.
ARROW_BEARING_STEP = -22.5
ARROW_FIRST_BEARING = 180.0

_COMPASS = [
    "south",
    "south-southeast",
    "southeast",
    "east-southeast",
    "east",
    "east-northeast",
    "northeast",
    "north-northeast",
    "north",
    "north-northwest",
    "northwest",
    "west-northwest",
    "west",
    "west-southwest",
    "southwest",
    "south-southwest",
]


def arrow_bearing(index: int) -> float:
    """Compass bearing in degrees for a home-arrow index (0 = north)."""
    if not 0x60 <= index <= 0x6F:
        raise ValueError(f"0x{index:02X} is not a home-arrow index")
    offset = index - 0x60
    return (ARROW_FIRST_BEARING + ARROW_BEARING_STEP * offset) % 360.0

_ARROW_SYMBOLS = {
    0x60: "SYM_ARROW_SOUTH",
    0x64: "SYM_ARROW_EAST",
    0x68: "SYM_ARROW_NORTH",
    0x6C: "SYM_ARROW_WEST",
}

_LOW_ICONS: dict[int, tuple[str, str]] = {
    0x00: ("SYM_NONE", "blank -- written to clear the screen on video init"),
    0x01: ("SYM_RSSI", "RSSI antenna"),
    0x02: ("SYM_AH_RIGHT", "artificial horizon right bracket"),
    0x03: ("SYM_AH_LEFT", "artificial horizon left bracket / menu cursor"),
    0x04: ("SYM_THR", "throttle"),
    0x05: ("SYM_OVER_HOME", "over home"),
    0x06: ("SYM_VOLT", "volts"),
    0x07: ("SYM_MAH", "milliamp hours"),
    0x08: ("SYM_STICK_OVERLAY_SPRITE_HIGH", "stick overlay high / GPS degrees"),
    0x09: ("SYM_STICK_OVERLAY_SPRITE_MID", "stick overlay mid"),
    0x0A: ("SYM_STICK_OVERLAY_SPRITE_LOW", "stick overlay low"),
    0x0B: ("SYM_STICK_OVERLAY_CENTER", "stick overlay centre"),
    0x0C: ("SYM_M", "metres"),
    0x0D: ("SYM_F", "degrees Fahrenheit"),
    0x0E: ("SYM_C", "degrees Celsius"),
    0x0F: ("SYM_FT", "feet"),
    0x10: ("SYM_BBLOG", "blackbox logging"),
    0x11: ("SYM_HOMEFLAG", "home flag"),
    0x12: ("", "unassigned (SYM_RPM is commented out in the firmware)"),
    0x13: ("SYM_AH_DECORATION", "AH side decoration / altitude ladder"),
    0x14: ("SYM_ROLL", "roll angle"),
    0x15: ("SYM_PITCH", "pitch angle"),
    0x16: ("SYM_STICK_OVERLAY_VERTICAL", "stick overlay vertical rule"),
    0x17: ("SYM_STICK_OVERLAY_HORIZONTAL", "stick overlay horizontal rule"),
    0x18: ("SYM_HEADING_N", "heading tape N"),
    0x19: ("SYM_HEADING_S", "heading tape S"),
    0x1A: ("SYM_HEADING_E", "heading tape E"),
    0x1B: ("SYM_HEADING_W", "heading tape W"),
    0x1C: ("SYM_HEADING_DIVIDED_LINE", "heading tape minor tick"),
    0x1D: ("SYM_HEADING_LINE", "heading tape major tick"),
    0x1E: ("SYM_SAT_L", "satellite icon, left half"),
    0x1F: ("SYM_SAT_R", "satellite icon, right half"),
}

_HIGH_ICONS: dict[int, tuple[str, str]] = {
    0x70: ("SYM_SPEED", "ground speed"),
    0x71: ("SYM_TOTAL_DISTANCE", "total distance flown"),
    0x72: ("SYM_AH_CENTER_LINE", "AH centre, left"),
    0x73: ("SYM_AH_CENTER", "AH centre, middle"),
    0x74: ("SYM_AH_CENTER_LINE_RIGHT", "AH centre, right"),
    0x75: ("SYM_ARROW_SMALL_UP", "small up arrow (climb)"),
    0x76: ("SYM_ARROW_SMALL_DOWN", "small down arrow (sink)"),
    0x77: ("SYM_ARROW_SMALL_RIGHT", "small right arrow (Configurator only)"),
    0x78: ("", "unassigned"),
    0x79: ("SYM_PREV_LAP_TIME", "previous lap time -- blank in stock"),
    0x7A: ("SYM_TEMPERATURE", "thermometer"),
    0x7B: ("SYM_LINK_QUALITY", "link quality"),
    0x7C: ("", "unassigned (stock draws a vertical bar)"),
    0x7D: ("SYM_KM", "kilometres"),
    0x7E: ("SYM_MILES", "miles"),
    0x7F: ("SYM_ALTITUDE", "altitude"),
    0x80: ("SYM_AH_BAR9_0", "AH ladder rung 0 (lowest)"),
    0x81: ("SYM_AH_BAR9_1", "AH ladder rung 1"),
    0x82: ("SYM_AH_BAR9_2", "AH ladder rung 2"),
    0x83: ("SYM_AH_BAR9_3", "AH ladder rung 3"),
    0x84: ("SYM_AH_BAR9_4", "AH ladder rung 4 (level)"),
    0x85: ("SYM_AH_BAR9_5", "AH ladder rung 5"),
    0x86: ("SYM_AH_BAR9_6", "AH ladder rung 6"),
    0x87: ("SYM_AH_BAR9_7", "AH ladder rung 7"),
    0x88: ("SYM_AH_BAR9_8", "AH ladder rung 8 (highest)"),
    0x89: ("SYM_LAT", "GPS latitude"),
    0x8A: ("SYM_PB_START", "progress bar, left cap"),
    0x8B: ("SYM_PB_FULL", "progress bar, full segment"),
    0x8C: ("SYM_PB_HALF", "progress bar, half segment"),
    0x8D: ("SYM_PB_EMPTY", "progress bar, empty segment"),
    0x8E: ("SYM_PB_END", "progress bar, right cap"),
    0x8F: ("SYM_PB_CLOSE", "progress bar, close"),
    0x90: ("SYM_BATT_FULL", "battery 7/7"),
    0x91: ("SYM_BATT_5", "battery 6/7"),
    0x92: ("SYM_BATT_4", "battery 5/7"),
    0x93: ("SYM_BATT_3", "battery 4/7"),
    0x94: ("SYM_BATT_2", "battery 3/7"),
    0x95: ("SYM_BATT_1", "battery 2/7"),
    0x96: ("SYM_BATT_EMPTY", "battery 1/7 (empty)"),
    0x97: ("SYM_MAIN_BATT", "main battery"),
    0x98: ("SYM_LON", "GPS longitude"),
    0x99: ("SYM_FTPS", "feet per second"),
    0x9A: ("SYM_AMP", "amperes"),
    0x9B: ("SYM_ON_M", "power-on time, minutes"),
    0x9C: ("SYM_FLY_M", "flight time, minutes"),
    0x9D: ("SYM_MPH", "miles per hour"),
    0x9E: ("SYM_KPH", "kilometres per hour"),
    0x9F: ("SYM_MPS", "metres per second"),
}


def build_map() -> dict[int, Slot]:
    """Return the complete 256-entry glyph map."""
    slots: dict[int, Slot] = {}

    for index, (symbol, meaning) in _LOW_ICONS.items():
        category = "protected" if index in PROTECTED else "icon"
        slots[index] = Slot(index, symbol, meaning, category)

    for slot in _ascii_slots():
        slots[slot.index] = slot

    for offset, bearing in enumerate(_COMPASS):
        index = 0x60 + offset
        symbol = _ARROW_SYMBOLS.get(index, f"SYM_ARROW_{offset + 1}")
        slots[index] = Slot(
            index, symbol, f"home direction arrow, {bearing}", "arrow"
        )

    for index, (symbol, meaning) in _HIGH_ICONS.items():
        slots[index] = Slot(index, symbol, meaning, "icon")

    for offset in range(LOGO_TILE_COUNT):
        index = LOGO_START + offset
        row, col = divmod(offset, LOGO_COLUMNS)
        if index in PROTECTED:
            slots[index] = Slot(
                index,
                "SYM_END_OF_FONT",
                "reserved -- also the splash bottom-right tile, kept "
                "transparent so both rules hold",
                "protected",
            )
        else:
            slots[index] = Slot(
                index,
                "SYM_LOGO_START" if offset == 0 else "",
                f"boot splash tile row {row}, column {col}",
                "logo",
            )

    missing = [i for i in range(256) if i not in slots]
    if missing:  # pragma: no cover - guards the table above
        raise AssertionError(
            f"glyph map is incomplete: {[f'0x{i:02X}' for i in missing]}"
        )
    return slots


GLYPH_MAP: dict[int, Slot] = build_map()


def describe(index: int) -> str:
    """One-line description of an index, for tables and error messages."""
    slot = GLYPH_MAP[index]
    return f"{slot.symbol} -- {slot.meaning}" if slot.symbol else slot.meaning


def indexes_in(category: str) -> list[int]:
    """All indexes in a category, ascending."""
    return sorted(i for i, slot in GLYPH_MAP.items() if slot.category == category)
