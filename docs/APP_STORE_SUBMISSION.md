# App Store Connect Submission

## App

bundle_id: com.armyjay.app
name: Army Jay                      # TODO: App Store names are unique -- if taken, try "Army Jay FPV"
subtitle: FPV radio sounds & OSD fonts
platform: ios
version: 1.0.0
build: 1
category_primary: Utilities
content_rights: no
copyright: 2026 Jason Chalky

## Age Rating

violence: none
cartoon_violence: none
mature_suggestive: none
nudity: none
sexual_content: none
horror: none
medical: none
alcohol_tobacco: none
gambling: no
unrestricted_web: no                # the only outside link (Source) opens in Safari

## Localizations

### English (en-US)

description: |
  Army Jay is a toolkit for FPV pilots: the sounds your radio plays and the font your goggles show, made right on your iPhone.

  SOUNDS FOR EDGETX
  Turn any audio clip into the exact file EdgeTX radios accept: 32 kHz, mono, 16-bit WAV. Pick a file from Files, trim it to the second you want, choose which event it should play on, and save it straight to Files or AirDrop it to your computer. Conversion happens on your phone; nothing is uploaded.

  Not sure what to call it? Trigger presets fill in the filenames EdgeTX plays on its own, for events like arming, disarming and low battery. A handful of ready-made warning tones is included, and every clip you convert is kept in My Sounds so you can save them all as one ZIP for your SD card.

  OSD FONTS FOR BETAFLIGHT
  Browse the Army Jay MAX7456 character sets for analog Betaflight OSDs: bold stencil letters and chunky icons, each outlined in black so they read over bright sky and dark ground. Every glyph is shown decoded from the font file itself.

  Edit any glyph pixel by pixel with your finger, with undo. Design the boot splash Betaflight shows at power-up: type a callsign, bring in a picture, or paint it. Then save a .mcm font ready for Betaflight Configurator's Font Manager.

  Features:
  - Convert MP3, M4A, WAV and FLAC to EdgeTX-ready WAV
  - Trim clips and name them for EdgeTX's built-in events
  - Ready-made warning tones and sound effects
  - My Sounds keeps everything you convert; save it all as one ZIP
  - Three Army Jay OSD font variants, including a high-readability set
  - Pixel glyph editor and boot splash designer
  - Works offline; no account, no tracking, nothing uploaded

keywords: fpv,edgetx,betaflight,osd,font,drone,quad,radio,callouts,wav,sounds,opentx,analog
whats_new: Initial release.
promo_text: Make your radio talk back and your OSD readable. Convert sounds for EdgeTX and design Betaflight OSD fonts, all on your iPhone.
support_url: https://chalkyjason.github.io/MyWebsite/projects/army-jay/support
marketing_url: https://chalkyjason.github.io/MyWebsite/projects/army-jay/

## Screenshots

### 6.9-inch (iPhone 17 Pro Max)

- screenshots/appstore/01-convert.png        # a clip trimmed, named for the "armed" event, converted
- screenshots/appstore/02-library.png        # the library of ready-made tones
- screenshots/appstore/03-font.png           # the armyjay_full font and its boot splash
- screenshots/appstore/04-editor.png         # the pixel glyph editor
- screenshots/appstore/05-start-screen.png   # a boot splash typed in with the text template

1320 x 2868. Rendered in WebKit at 440 x 956 pt, 3x, with the app's
native mode on and the iPhone 17 Pro Max's safe areas, under the status bar
captured from the simulator. There are no UI screenshot tests yet.

## Review Contact

first_name: Jason
last_name: Chalky
phone:                              # TODO: required -- not in the repo
email: chalkyjason@gmail.com
notes: |
  Army Jay works fully offline and needs no account.

  To try the sound converter: Sounds > Convert, tap "Choose an audio file",
  pick any MP3/M4A/WAV from Files, choose a Trigger preset (e.g. "On arm"),
  tap Convert, then Download .wav to open the share sheet and save the
  result to Files. The output is a 32 kHz mono 16-bit WAV, the format
  EdgeTX radios play.

  To try the font tools: OSD Fonts > full > Edit glyphs, drag on the large
  glyph to paint pixels; or OSD Fonts > Start screen, type into Big line,
  then save the .mcm font from the Export panel.

  Files are produced for FPV hardware (EdgeTX radios, Betaflight flight
  controllers) and saved through the standard share sheet.

## Pricing

price: Free
availability: all
pre_order: false

## Privacy

privacy_url: https://chalkyjason.github.io/MyWebsite/projects/army-jay/privacy-policy
data_collected: none

## Compliance

uses_encryption: no                 # Info.plist sets ITSAppUsesNonExemptEncryption = false
france_declaration: no

## Review Questions

- question: Does your app use the Advertising Identifier (IDFA)?
  answer: no

- question: Does this app contain, display, or access third-party content?
  answer: no

## Before submitting

Open items the app's code can't settle:

1. ~~**The stock Betaflight font.**~~ Resolved: Betaflight's default font
   (GPL-3.0) is no longer in the app; the start screen exports into the
   Army Jay fonts only. The Army Jay fonts match stock at 8 of 256 indexes
   (MODIFIED_INDEXES.md), and all 8 are blank or transparent -- no stock
   artwork ships.
2. ~~**The Zira voice callouts.**~~ Resolved: the 21 callouts made with
   Windows' Zira TTS voice are tagged `windows-tts` and left out of the app;
   it ships the 6 synthesized tones only. The website keeps them.
3. **Test on a real iPhone**: the device checklist in
   `docs/superpowers/specs/2026-09-30-capacitor-ios-app-design.md`.
4. **Phone number** for the review contact, above.
5. **Upload**: Xcode > Product > Archive with the Army Jay team
   (82S6ZVW7V2), then Distribute App > App Store Connect.
