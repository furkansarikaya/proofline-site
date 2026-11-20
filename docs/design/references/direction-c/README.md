# Direction C: approved direction sample

The product owner's approved direction sample ("the quiet instrument") for the marketing surface. It is a look reference, not code to copy one to one.

## What it is
- `c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html`: the first screen and one lower section of the home page, in English and Turkish, light and dark (the theme follows the system setting).
- `controls.js`: the one controls script the sample uses (1462 bytes; limit 2048, see ADR 0006 and ADR 0008). It is the approved size and behaviour: remember the theme, run the copy button.
- `fonts/`: the font files the sample loads (Stack Sans Headline 400, Stack Sans Text 400 and 500, JetBrains Mono 400 and 500; Latin and Latin Extended subsets, which hold the Turkish letters), each family with its OFL-1.1 licence text (`OFL-*.txt`, as published with the package). Opened from this folder the sample shows the real faces.
- `icons/`: the three SVG icons (`github.svg`, `sun.svg`, `moon.svg`).
- `screenshots/`: first screens, desktop (1440 wide) and mobile (390 wide), light and dark, English and Turkish.

## How to use it
- Rules live in [DESIGN.md](../../DESIGN.md) and [DESIGN-marketing.md](../../DESIGN-marketing.md). Where the sample and those documents differ, the documents win.
- Match the look: layout, type scale, spacing, colour roles, the drawing and its states, the header controls. Do not copy the markup: the sample is one flat file with its own CSS and a hand-made bilingual pair, while the site is Astro with shared tokens and separate pages per language.
- Take the SVG icon files as they are. Rebuild the drawing as a component from the description in DESIGN-marketing.md; the sample's SVG is generated and is not the source.
- All text on the sample comes from the proofline repository at commit `b6d7f0ff`; the real pages read it from the pin. The sample links are placeholders (`#`) except GitHub, license and source links.

## Fonts
The fonts are open-licensed (OFL-1.1) and may be kept with the sample. The site hosts its own copies (DESIGN.md names faces and weights); these files are a reference, not the deployed fonts.
