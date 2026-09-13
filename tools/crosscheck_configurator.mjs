/**
 * Cross-check the built fonts against Betaflight Configurator's own code.
 *
 * Our encoder and Configurator's parser are two independent implementations
 * of the same spec. Agreeing with ourselves proves nothing; agreeing with
 * the client that actually uploads the font proves a great deal. This
 * harness runs Configurator's real source -- not a reimplementation of it:
 *
 *   1. `FONT.parseMCMFontFile` from src/js/utils/osdFont.js is run over each
 *      built font, and every pixel of all 256 glyphs is compared against
 *      what our Python decoder reports.
 *   2. `FONT.msp.encode` is run over every glyph, checking the 54 bytes that
 *      actually reach the OSD chip.
 *   3. `imageToCharacter` from src/js/LogoManager.js is run over the boot
 *      splash PNG, checking that uploading that image through Font Manager
 *      would produce byte-for-byte the tiles already baked into our .mcm.
 *
 * The Configurator sources are ES modules that import i18n, MSP and
 * FileSystem. None of that is reachable from the code under test, so the
 * import lines are stripped and the module is loaded from a temp file. The
 * function bodies are untouched.
 *
 * Usage:
 *   python tools/crosscheck_configurator.py        # drives this script
 *   node tools/crosscheck_configurator.mjs <fixture.json>
 */

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const fixturePath = process.argv[2];
if (!fixturePath) {
    console.error("usage: node crosscheck_configurator.mjs <fixture.json>");
    process.exit(2);
}
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

/** Strip ES imports/exports so a browser module can be loaded head-less. */
function loadModule(sourcePath, exportNames) {
    const raw = readFileSync(sourcePath, "utf8");
    const stripped = raw
        .split("\n")
        .filter((line) => !/^\s*import\s/.test(line))
        .filter((line) => !/^\s*export\s+(\{|default)/.test(line))
        .join("\n");
    const shim = `
const i18n = { getMessage: () => "" };
const gui_log = () => {};
const MSP = { promise: () => Promise.resolve() };
const MSPCodes = {};
const FileSystem = {};
${stripped}
export { ${exportNames.join(", ")} };
`;
    const dir = mkdtempSync(join(tmpdir(), "bfcfg-"));
    const file = join(dir, "mod.mjs");
    writeFileSync(file, shim);
    return import(pathToFileURL(file).href);
}

const failures = [];
const notes = [];

function check(name, condition, detail = "") {
    if (condition) {
        console.log(`  ok    ${name}${detail ? ` -- ${detail}` : ""}`);
    } else {
        console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
        failures.push(`${name}: ${detail}`);
    }
}

const { FONT } = await loadModule(fixture.osdFontPath, ["FONT", "SYM"]);
const { imageToCharacter } = await loadModule(fixture.logoManagerPath, [
    "imageToCharacter",
]);

// ---------------------------------------------------------------------------
// 1 + 2: parse every font with Configurator's parser
// ---------------------------------------------------------------------------

for (const font of fixture.fonts) {
    console.log(`\n${font.name}`);
    FONT.initData();
    // A fresh parse per font: parseMCMFontFile clears its own arrays, but
    // the cached data-URI list is keyed by index and must not leak between
    // fonts or the pixel comparison would silently test the wrong glyphs.
    FONT.data.character_image_urls.length = 0;

    let characters;
    try {
        characters = FONT.parseMCMFontFile(readFileSync(font.path, "utf8"));
    } catch (error) {
        check(`${font.name} parses`, false, error.message);
        continue;
    }

    check(
        "Configurator parses the file",
        characters.length === 256,
        `${characters.length} characters`,
    );
    if (characters.length !== 256) {
        continue;
    }

    // Every pixel, against our own decoder.
    //
    // parseMCMFontFile decodes all 64 bytes of the NVM field, so it yields
    // 64 x 4 = 256 two-bit values per glyph. Only the first 216 are real
    // pixels -- characterBitmapDataUri reads y*12+x for y<18 -- and the
    // remaining 40 come from the padding bytes. Compare the pixels, then
    // check the tail decodes as transparent, which is what 0x55 means.
    const PIXELS = 216;
    let mismatched = 0;
    let firstBad = null;
    let badTail = 0;
    for (let index = 0; index < 256; index++) {
        const theirs = characters[index];
        const ours = font.pixels[index];
        if (theirs.length !== 256 || ours.length !== PIXELS) {
            mismatched++;
            firstBad ??= `0x${index.toString(16)} length ${theirs.length} vs ${ours.length}`;
            continue;
        }
        for (let p = 0; p < PIXELS; p++) {
            // Configurator keeps 1 and 3 apart; both mean transparent, and
            // our decoder normalises them to 1. Compare on that footing.
            const t = theirs[p] === 3 ? 1 : theirs[p];
            if (t !== ours[p]) {
                mismatched++;
                firstBad ??= `0x${index.toString(16)} pixel ${p}: ${t} vs ${ours[p]}`;
                break;
            }
        }
        for (let p = PIXELS; p < 256; p++) {
            if (theirs[p] !== 1 && theirs[p] !== 3) {
                badTail++;
                break;
            }
        }
    }
    check(
        "every pixel of all 256 glyphs agrees with our decoder",
        mismatched === 0,
        mismatched ? `${mismatched} glyphs differ; first: ${firstBad}` : "216 px x 256 glyphs",
    );
    check(
        "padding decodes as transparent in Configurator",
        badTail === 0,
        badTail ? `${badTail} glyphs have non-transparent padding` : "40 trailing values x 256",
    );

    // The bytes that actually reach the OSD chip.
    let badUpload = 0;
    let uploadNote = null;
    for (let index = 0; index < 256; index++) {
        const payload = FONT.msp.encode(index);
        if (payload[0] !== index || payload.length !== 55) {
            badUpload++;
            uploadNote ??= `0x${index.toString(16)}: addr ${payload[0]}, len ${payload.length}`;
            continue;
        }
        const expected = font.uploadBytes[index];
        for (let b = 0; b < 54; b++) {
            if (payload[b + 1] !== expected[b]) {
                badUpload++;
                uploadNote ??= `0x${index.toString(16)} byte ${b}: ${payload[b + 1]} vs ${expected[b]}`;
                break;
            }
        }
    }
    check(
        "MSP_OSD_CHAR_WRITE payloads match (54 data bytes per glyph)",
        badUpload === 0,
        badUpload ? uploadNote : "256 payloads of 1 + 54 bytes",
    );

    // The 10 padding bytes are sliced off before upload, so they cannot
    // affect the chip. Worth stating rather than assuming.
    const padIgnored = FONT.msp.encode(0).length === 55;
    notes.push(
        padIgnored
            ? `${font.name}: padding bytes are not uploaded (54 of 64 sent)`
            : `${font.name}: unexpected upload payload size`,
    );
}

// ---------------------------------------------------------------------------
// 3: the boot splash PNG, through Configurator's own tile encoder
// ---------------------------------------------------------------------------

console.log(`\n${fixture.logo.name}`);

const logoCtx = {
    constants: {
        TILES_NUM_HORIZ: 24,
        TILES_NUM_VERT: 4,
        MCM_COLORMAP: {
            "0-255-0": "01",
            "0-0-0": "00",
            "255-255-255": "10",
            default: "01",
        },
    },
    font: { constants: { SIZES: { MAX_NVM_FONT_CHAR_FIELD_SIZE: 64 } } },
};

const { width, height, rgba } = fixture.logo;
check(
    "raster is the size Configurator expects",
    width === 288 && height === 72,
    `${width}x${height}`,
);

// Only the three palette colours, or Configurator's uploader silently maps
// the stray ones to transparent.
const strays = new Set();
for (let i = 0; i < rgba.length; i += 4) {
    const key = `${rgba[i]}-${rgba[i + 1]}-${rgba[i + 2]}`;
    if (!(key in logoCtx.constants.MCM_COLORMAP) || key === "default") {
        strays.add(key);
    }
}
check(
    "raster uses only the uploader's palette",
    strays.size === 0,
    strays.size ? `stray colours: ${[...strays].slice(0, 4).join(", ")}` : "black, white, green only",
);

// Re-slice exactly as replaceLogoInFont does, and compare against the tiles
// already in the built font.
let tileMismatch = 0;
let firstTile = null;
let charAddr = 0xa0;
for (let ty = 0; ty < logoCtx.constants.TILES_NUM_VERT; ty++) {
    for (let tx = 0; tx < logoCtx.constants.TILES_NUM_HORIZ; tx++) {
        const data = [];
        for (let y = 0; y < 18; y++) {
            for (let x = 0; x < 12; x++) {
                const px = ((ty * 18 + y) * width + (tx * 12 + x)) * 4;
                data.push(rgba[px], rgba[px + 1], rgba[px + 2], rgba[px + 3]);
            }
        }
        const produced = imageToCharacter.apply(logoCtx, [data]);
        const expected = fixture.logo.tiles[charAddr - 0xa0];
        if (produced.length !== 64) {
            tileMismatch++;
            firstTile ??= `0x${charAddr.toString(16)}: ${produced.length} lines`;
        } else if (produced.join("") !== expected.join("")) {
            tileMismatch++;
            firstTile ??= `0x${charAddr.toString(16)} differs`;
        }
        charAddr++;
    }
}
check(
    "Font Manager's logo upload reproduces the tiles in the .mcm",
    tileMismatch === 0,
    tileMismatch ? `${tileMismatch} tiles differ; first ${firstTile}` : "96 tiles identical",
);

console.log("");
for (const note of notes.slice(0, 1)) {
    console.log(`note: ${note}`);
}

if (failures.length) {
    console.log(`\nFAILED -- ${failures.length} cross-check(s) did not pass`);
    for (const failure of failures) {
        console.log(`  - ${failure}`);
    }
    process.exit(1);
}
console.log("\nPASSED -- Configurator's own code agrees with every built font");
