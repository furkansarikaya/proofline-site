# Task: TASK-003 - Design tokens, self-hosted fonts and base styles

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-001
prd: site
---

## Goal

Every page of the site loads one stylesheet that holds the design tokens of `DESIGN.md` for light and dark, the three self-hosted font families with their licence texts, and the base typography and spacing rules, with no font or style coming from another host.

## Context

- Source requirement: NFR-1 of `/docs/product/site/PRD.md` (no page loads anything from a third-party host; fonts are self-hosted). This task adds no page content.
- Design documents: `/docs/design/DESIGN.md` sections "Tokens", "Typography", "Spacing", "Colour roles and contrast" and "Accessibility baseline"; surface document `/docs/design/DESIGN-marketing.md` (rule R-1, "The red is only the blocked slab"). Approved sample: `/docs/design/references/direction-c/` with `c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html`; the font files and OFL texts are in `/docs/design/references/direction-c/fonts/`. Where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0001-astro-static-site-and-toolchain.md` (plain `.mjs` tests, Astro 7.4.13); `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (`style-src 'self'`, so `build.inlineStylesheets: 'never'`; no third-party host).
- Existing: `src/layouts/Base.astro` has no stylesheet; `astro.config.mjs` has no `build.inlineStylesheets`; `.gitignore` already ignores `dist/` and `.astro/`.
- Expected scope (7 paths): `src/styles/tokens.css`, `src/styles/base.css`, `public/fonts/` (ten `.woff2` files and three `OFL-*.txt` files), `src/layouts/Base.astro`, `astro.config.mjs`, `tests/design.test.mjs`, `tests/fixtures/design/` (only if a test needs a fixture).
- Assumption: the custom property names are the token names of `DESIGN.md` unchanged (`--bg`, `--surface`, `--frame`, `--ink`, `--muted`, `--accent`, `--block`, `--rule`, `--grid`, `--hatch`), and the type steps are the custom properties `--step-head`, `--step-h2`, `--step-lead`, `--step-body`, `--step-small`, `--step-mono` (the step names of the `DESIGN.md` type scale).
- Assumption: the theme attribute is `data-theme` on the `html` element with the values `light` and `dark`, as in the approved sample `controls.js` (`d.dataset.theme`); the script that sets it is TASK-005.
- Assumption: the ten font files keep the file names they have in `/docs/design/references/direction-c/fonts/` (Stack Sans Headline 400 and Stack Sans Text 400 and 500 each in `latin` and `latin-ext`, JetBrains Mono 400 and 500 each in `latin` and `latin-ext`, which gives 2 + 4 + 4 files), as the "planned" paths in `DESIGN.md` Typography name them.

## Acceptance criteria

- AC-1: The token table of `docs/design/DESIGN.md` ("Tokens") is read by a test and compared with `src/styles/tokens.css` -> all 10 token names exist, and each light and each dark value equals the table value when both are parsed as colours (same red, green, blue and alpha numbers).
- AC-2: `src/styles/tokens.css` is read as rules -> the file sets the light values when no `data-theme` attribute exists, sets the dark values under `prefers-color-scheme: dark` when `data-theme` is absent, and sets the light values for `data-theme="light"` and the dark values for `data-theme="dark"` whatever the system setting is.
- AC-3: `public/fonts/` is listed -> it holds the 10 `.woff2` files named in the Context assumption, each starting with the bytes `wOF2`, and three licence texts `OFL-jetbrains-mono.txt`, `OFL-stack-sans-headline.txt` and `OFL-stack-sans-text.txt`, each containing the text "SIL OPEN FONT LICENSE Version 1.1".
  Covers: NFR-1
- AC-4: The glyph table of the font files is read (not the CSS) -> for each of the three families at least one of its files contains a glyph for every one of the 12 letters `ğ Ğ ş Ş ı İ ç Ç ö Ö ü Ü`.
- AC-5: The font-face rules are read -> every file of `public/fonts/` has exactly one rule naming its family and weight; each `latin-ext` rule has a unicode range that includes U+011E, U+011F, U+0130, U+0131, U+015E and U+015F, and each `latin` rule has one that includes U+00C7, U+00E7, U+00D6, U+00F6, U+00DC and U+00FC.
- AC-6: The source styles and the built `dist/` are scanned -> they hold 0 `http://` or `https://` addresses, 0 `@import` rules and 0 `url(` values that do not start with `/fonts/` or `/_astro/`.
  Covers: NFR-1
- AC-7: `/` and `/tr/` are built -> each page links one same-origin stylesheet, and `dist/` pages hold 0 `style` elements and 0 `style=` attributes.
- AC-8: The base styles are read -> headings render in Stack Sans Headline at weight 400, text renders in Stack Sans Text at weights 400 and 500, and JetBrains Mono is set only on `code`, `pre`, `kbd` and `samp`.
- AC-9: The base styles are read -> the six type steps hold the values of the `DESIGN.md` type scale: head 28 to 40 px on mobile and at most 70 px on desktop, h2 26 and 36, lead 17, body 15.5 to 17, small 13.5 to 15, mono 13.5 to 14.
- AC-10: The base styles are read -> the page grid has 12 columns with 1px hairlines in `--grid`, a maximum width of 1400px and 20px side gutters, the breakpoints are 820px and 1000px, and the files hold 0 `border-radius` values other than 0, 0 `box-shadow` values other than `none` and 0 gradient functions.
- AC-11: The source styles are searched for the two values `#c4152b` and `#e0354a` and for `var(--block)` -> the two values appear only in `src/styles/tokens.css` and `var(--block)` appears 0 times (the diagram rule that may use it is TASK-018).
- AC-12: `npm test`, `npm run check:links` and `npm run test:axe` run on the built site -> they exit 0 and the axe run reports 0 violations on `/` and `/tr/` with the new styles.
- AC-13: Failure criterion (anti-goal): the task is not done if one token value differs from `DESIGN.md` by a single digit, if the dark values are computed from the light ones instead of being listed, if any font, stylesheet or image is requested from a host other than the site, or if the stylesheet is inlined into a page, even when the build is green.

## Out of scope

- The header, footer, theme button and `controls.js` (TASK-005) and every page content.
- The `--install-bg`, `--code-bg` and `--measure` tokens and the 1180px breakpoint of the docs surface (TASK-015).
- The diagram styles and the one allowed use of `--block` (TASK-018).
- The `style-src` CSP header itself (TASK-027); this task only makes the built pages compatible with it.
- Preloading fonts, subsetting or converting font files, and any font other than the three families of `DESIGN.md`.

## Constraints

- Expected test exception: the font binaries have no test-first RED (they are binary files copied from the approved sample). What is tested instead: the files exist, the signature bytes, the licence texts, the glyph coverage of the 12 Turkish letters read from the font files, the font-face rules, the absence of an external host, and the token names and values read from `DESIGN.md`.
- `DESIGN.md` Typography: all faces are self-hosted from the project (no CDN) under OFL-1.1; the licence texts are kept next to the fonts.
- ADR 0006: no inline `style` element or `style=` attribute; `astro.config.mjs` gets `build.inlineStylesheets: 'never'`.
- ADR 0001: tests are plain `.mjs` under `node --test`; no dependency is added by this task.

## Risks

- Astro inlines small stylesheets by default; without the config option the CSP of TASK-027 would block the page styles (AC-7).
- A font file with a missing Turkish glyph would fall back to a system font only for that letter; AC-4 reads the glyph table so the gap is found at build time.
- The dark values are separate designs, not derived (`DESIGN.md` "Tokens"); AC-1 compares them one by one against the document.

## Pre-existing defects

none

## Suggested class

STANDARD - bounded presentation-layer change (styles, static font assets, one layout and one build option) with no integration, persistence or security boundary of its own

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
