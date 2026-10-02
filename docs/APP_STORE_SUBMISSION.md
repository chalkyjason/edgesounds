# App Store Connect Submission

## App

bundle_id: com.armyjay.app
name: Callsign FPV                  # free on the App Store as of 2026-10-02; home-screen label "Callsign"
subtitle: Radio sounds & OSD emblems
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
  Callsign FPV is a toolkit for FPV pilots: the sounds your radio plays, the font your goggles show, and the emblem Betaflight puts on screen at power-up, all made right on your iPhone.

  BUILD YOUR EMBLEM
  Design the 288x72 start screen Betaflight shows at boot the way you'd build a game emblem: stack shapes, text and a picture as layers. Drag with a finger, pinch to resize, twist to rotate. Fill each layer white or black, give it an outline so it reads over sky and ground, or cut it out of the layers below. Over 100 shapes in six packs, from basic geometry and rank insignia to skulls, eagles, wings and quads, plus starter emblems to make your own.

  SOUNDS FOR EDGETX
  Turn any audio clip into the exact file EdgeTX radios accept: 32 kHz, mono, 16-bit WAV. Pick a file from Files, trim it to the second you want, choose which event it should play on, and save it straight to Files or AirDrop it to your computer. Conversion happens on your phone; nothing is uploaded.

  Not sure what to call it? Trigger presets fill in the filenames EdgeTX plays on its own, for events like arming, disarming and low battery. A handful of ready-made warning tones is included, and every clip you convert is kept in My Sounds so you can save them all as one ZIP for your SD card.

  OSD FONTS FOR BETAFLIGHT
  Browse the Army Jay MAX7456 character sets for analog Betaflight OSDs: bold stencil letters and chunky icons, each outlined in black so they read over bright sky and dark ground. Every glyph is shown decoded from the font file itself.

  Edit any glyph pixel by pixel with your finger, with undo, and touch up your emblem the same way. Then save a .mcm font with your start screen in it, ready for Betaflight Configurator's Font Manager.

  Features:
  - Layered start-screen emblem builder with 100+ shapes and starter designs
  - Convert MP3, M4A, WAV and FLAC to EdgeTX-ready WAV
  - Trim clips and name them for EdgeTX's built-in events
  - Ready-made warning tones and sound effects
  - My Sounds keeps everything you convert; save it all as one ZIP
  - Three Army Jay OSD font variants, including a high-readability set
  - Pixel glyph editor
  - Works offline; no account, no tracking, nothing uploaded

keywords: fpv,edgetx,betaflight,osd,font,drone,quad,emblem,callsign,radio,callouts,wav,sounds
whats_new: Initial release.
promo_text: Make your radio talk back and put your own emblem on your OSD. EdgeTX sounds and Betaflight start screens, built on your iPhone.
support_url: https://chalkyjason.github.io/MyWebsite/projects/callsign-fpv/support
marketing_url: https://chalkyjason.github.io/MyWebsite/projects/callsign-fpv/

## Screenshots

### 6.9-inch (iPhone 17 Pro Max)

- screenshots/appstore/01-emblem.png    # the layered start screen: skull, props and a callsign
- screenshots/appstore/02-shapes.png    # the shape library, Military pack
- screenshots/appstore/03-convert.png   # a clip trimmed, named for the "armed" event, converted
- screenshots/appstore/04-glyphs.png    # the pixel glyph editor
- screenshots/appstore/05-home.png      # Callsign FPV's home screen

1320 x 2868. Rendered in WebKit at 440 x 956 pt, 3x, with the app's
native mode on and the iPhone 17 Pro Max's safe areas, under the status bar
captured from the simulator. There are no UI screenshot tests yet.

## Review Contact

first_name: Jason
last_name: Chalky
phone:                              # TODO: required -- not in the repo
email: chalkyjason@gmail.com
notes: |
  Callsign FPV works fully offline and needs no account.

  To try the sound converter: Sounds > Convert, tap "Choose an audio file",
  pick any MP3/M4A/WAV from Files, choose a Trigger preset (e.g. "On arm"),
  tap Convert, then Download .wav to open the share sheet and save the
  result to Files. The output is a 32 kHz mono 16-bit WAV, the format
  EdgeTX radios play.

  To try the emblem builder: OSD Fonts > Start screen > Starters, pick one,
  then drag, pinch or twist a layer on the preview, or add a Shape from the
  library; save the .mcm font from the Export panel. To edit glyphs: OSD
  Fonts > full > Edit glyphs, and drag on the large glyph.

  Files are produced for FPV hardware (EdgeTX radios, Betaflight flight
  controllers) and saved through the standard share sheet.

## Pricing

price: Free
availability: all
pre_order: false

## Privacy

privacy_url: https://chalkyjason.github.io/MyWebsite/projects/callsign-fpv/privacy-policy
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
