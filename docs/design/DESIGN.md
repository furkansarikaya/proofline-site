# Design system (shared base)

Status: direction contract written in the promotional design step (`design ui`, direction C "quiet instrument", chosen by the product owner). It describes what the site will be built to; nothing here is built yet, so the "Defined in" paths are planned paths and are marked `planned`. After the build the knowledge step updates this file from the world as built.

Approved direction sample (a look reference, not code to copy one to one): [references/direction-c/](references/direction-c/README.md). Where it and this document differ, this document wins.

Surface documents: [DESIGN-marketing.md](DESIGN-marketing.md) (persuade) and [DESIGN-docs.md](DESIGN-docs.md) (read). Everything on this page applies to both.

## Tokens
Light and dark are designed separately; neither is derived from the other.

| Token | Light | Dark | Defined in |
|---|---|---|---|
| `--bg` | `#dedad3` | `#0d0f10` | planned `src/styles/tokens.css` |
| `--surface` | `#d3cec6` | `#161a1c` | planned |
| `--frame` | `#e6e3dd` | `#111416` | planned |
| `--ink` | `#0a0a0a` | `#e8e4dc` | planned |
| `--muted` | `#5c5852` | `#979c9f` | planned |
| `--accent` (pass, focus, links of emphasis) | `#256f82` | `#4aa3b8` | planned |
| `--block` (see rule R-1) | `#c4152b` | `#e0354a` | planned |
| `--rule` | `rgba(10,10,10,.30)` | `rgba(232,228,220,.26)` | planned |
| `--grid` | `rgba(10,10,10,.09)` | `rgba(232,228,220,.07)` | planned |
| `--hatch` | `rgba(10,10,10,.20)` | `rgba(232,228,220,.17)` | planned |

Colour strategy: a warm grey ground, near-black ink, one teal accent. No gradients, no glows, no second accent.

## Typography
All faces are self-hosted from the project (no CDN), open licence (OFL-1.1), and checked to contain `ğ Ğ ş Ş ı İ ç Ç ö Ö ü Ü` (measured in a browser on the sample page, and seen in screenshots in both languages).

| Role | Family | Weight | Where it will live |
|---|---|---|---|
| Headings | Stack Sans Headline | 400 | planned `public/fonts/stack-sans-headline-{latin,latin-ext}-400.woff2` |
| Text | Stack Sans Text | 400, 500 | planned `public/fonts/stack-sans-text-*` |
| Commands and code only | JetBrains Mono | 400, 500 | planned `public/fonts/jetbrains-mono-*` |

The licence texts (OFL-1.1) of the three families are kept with the approved sample, in references/direction-c/fonts/.

Why: the product's idea is "a script decides, not a prompt". A geometric sans cut in a light-to-regular weight reads as exact and calm, like lettering on a drawing; the text cut underneath keeps long Turkish sentences readable. A monospace appears only where a command or code is shown, so a reader can tell at a glance what to type. Serif headings on a cream ground, a very common AI-site look, are avoided on purpose, and so are Inter, Roboto, Poppins, Montserrat and Open Sans.

Type scale (px at 1440 wide; fluid between the mobile and desktop values):

| Step | Mobile | Desktop | Use |
|---|---|---|---|
| step-head | 28 to 52 (`8vw`; 31.2 at 390 wide) | 70 (`4.9vw`, max 70) | page headline, at most two lines |
| step-h2 | 26 | 36 | section headline |
| step-lead | 17 | 17 | description |
| step-body | 16 to 17 | 16 to 17 | body; on the marketing surface at most 75 characters a line; on the docs surface a text column of `33em` (measured: longest line 75 characters, see DESIGN-docs.md). Never `75ch`: `ch` is the width of a zero, and `75ch` gave lines of about 94 characters |
| step-small | 13.5 to 15 | 13.5 to 15 | captions, notes |
| step-mono | 13.5 to 14 | 13.5 to 14 | commands |

Headlines are sentence case, never all capitals. A headline may be two-tone (first line `--muted`, second `--ink`).

## Spacing
12-column grid with visible 1px hairlines (`--grid`) at the column edges, max width 1400px, 20px side gutters. Breakpoints: 820px (stack columns), 1000px (tighter menu). Radii: none (square corners). Elevation: none (no shadows).

## Colour roles and contrast
Measured on the sample page (WCAG 2.x contrast ratio).

| Pair | Light | Dark |
|---|---|---|
| ink on bg | 14.21 | 15.15 |
| muted on bg (also the grey line of a two-tone headline) | 5.07 | 6.93 |
| accent as focus ring on bg | 4.10 | 6.61 |
| inactive icon (`--muted`) on bg | 5.07 | 6.93 |
| selected text (`--bg` on an `--ink` ground, also the SVG labels of the diagram) | 14.21 | 15.15 |
| scrollbar thumb (`--muted`) on its track (`--bg`) | 5.07 | 6.93 |

Every text pair is at least 4.5. The accent is used as a fill or a ring only where 3:1 is enough (non-text), never for small text in the light theme.

## Components (shared)
| Component | Path | States handled |
|---|---|---|
| Header with menu and three controls | `src/components/marketing/Header.astro` | hover, focus-visible, mobile wrap, current page (`aria-current="page"`, 2px `--ink` underline) |
| GitHub icon link, theme toggle, language link | `src/components/marketing/Header.astro` (same file) | see "Header controls" |
| One-line footer | `src/components/marketing/Footer.astro` | wraps on a phone, links at least 44 high up to 820px |
| Copyable command block | `src/components/marketing/CommandBlock.astro` | default, copied (announced politely), copy refused (command selected, the message is also shown visibly under the command and announced politely) |
| Get-started page (two languages) | `src/components/marketing/GetStarted.astro`, `src/styles/get-started.css` | plain framed command blocks (`pre`, English, no translation, no copy button), wrapping at every width, no horizontal scroll from 320px; no drawing and no motion by design |
| Icons: `github.svg`, `sun.svg`, `moon.svg` | `src/assets/icons/` | `currentColor`, readable in both themes |
| Controls script | `public/assets/controls.js` (at most 2048 bytes) | theme key `theme`, copy button, hidden controls without the script |
| Marketing component styles | `src/styles/components.css` (imported in `Base.astro` after tokens.css and base.css) | one bundled stylesheet |

## Header controls (rules)
These are rules, not suggestions; a page that breaks one fails review.

1. **GitHub.** An icon link (the GitHub mark, `github.svg`), not text. It goes to `https://github.com/furkansarikaya/proofline`, with no `rel="noreferrer"` (ADR 0006, M-3). Accessible name: "proofline on GitHub" (Turkish: "GitHub'da proofline").
2. **Theme.** One button with a sun cell and a moon cell; the cell of the current theme is filled (`--ink` background), so the state does not depend on colour alone. Its accessible name says the current theme and what a press does: "Theme: light. Switch to dark" (Turkish: "Tema: açık. Koyu temaya geç"). The first visit follows the operating system (`prefers-color-scheme`); a saved choice (made by pressing the button) wins afterwards; with no saved choice the page follows later changes of the system setting. The theme is applied before first paint because the controls script is synchronous in `<head>` (PRD N-5). If the script does not run, the theme follows the system setting by CSS and the theme button stays hidden.
3. **Language.** A link, not a button. On an English page it shows only "TR"; on a Turkish page only "EN". It goes to the same page in the other language; when that page has no translation (FR-17), to `/tr/docs/` for a docs page and to `/tr/` for any other page, and the target says that the page has no Turkish version (ADR 0002 point 3, ADR 0011). Its name states the language: "TR: read this page in Turkish" (Turkish: "EN: bu sayfayı İngilizce oku"), with `lang` and `hreflang` set to the target language.
4. **Icons** are SVG files kept in the project (`src/assets/icons/`), drawn with `currentColor` so they follow the theme, and clear in both themes (contrast of the glyph on its ground at least 3:1).
5. **Touch and keyboard.** Every control is at least 44 by 44 CSS pixels (measured on the sample: GitHub 44x44, language 44x44, theme 88x44, copy 44 high). Every control shows a focus ring (2px, `--accent`, 3px offset) when reached with the keyboard; the tab order is brand, menu links, GitHub, language, theme. On the docs surface a search button sits between the menu links and GitHub (44 by 44 at least; icon, the word "Search" / "Ara" and the key `/` from 820px up).
6. **One script, 2 KB.** The only script on the four site pages is `/assets/controls.js`: same origin, at most 2048 bytes uncompressed, no inline script, no `async` or `defer`. It does two things: remember the theme (and keep the theme button's accessible name current) and run the copy button. Everything else, including the language link, works without it. The sample page's script is 1462 bytes.
7. **Order on a phone.** The header wraps (brand and controls on the first row, menu links on the second); the first screen then reads headline, description, install command, diagram.
8. **Search on the docs surface.** Below 820px the search button leaves the header (it did not fit with the other three controls) and moves to the row of the "Docs" and "On this page" menu buttons (right end, icon only, 44 by 44). The header then keeps brand and the three controls on the first row. The key `/` and Control or Command with K open the search on every docs page whatever the width.
9. **Scripts on docs pages.** A docs page carries two scripts only: `/assets/docs.js` (same origin, no inline script, no `async` or `defer`, at most 4096 bytes uncompressed; it does what `controls.js` does and also the copy buttons of code blocks, the menus and the search shortcut) and the search script of ADR 0004. `controls.js` is not loaded there, so the theme is applied before first paint by `docs.js` in `<head>`. CI checks the size of `docs.js` and that no other script is on a docs page (ADR 0008). The sample's `docs.js` is 2806 bytes.

## Accessibility baseline
- Drawing labels: at least 12 CSS pixels on screen; below 460px viewport width they are hidden and the key sentence under the drawing carries the same information (the gate legend is always shown).
- WCAG 2.2 AA target (NFR-6): contrast as above; target size 44px for header controls and the copy button; focus ring on every interactive element; no information by colour alone (see diagram rules in DESIGN-marketing.md).
- Reduced motion: the only animation on the site is the diagram, and it is off under `prefers-reduced-motion: reduce`.
- Language: the page `lang` is `en` or `tr`; a quotation in another language, a command, or a block copied from the proofline repository carries its own `lang` (a Turkish page shows the English run output with `lang="en"`).
- Content must work without scripts: the language link, the menu, the command text and the system theme need none; only the saved theme and the copy button need the controls script.

## Pattern justifications
The patterns centred title with two buttons and a floating panel, stat band, logo wall, testimonial slider, gradient blobs, glass cards and all-capitals eyebrow labels stay unused. Three lint patterns fire on the approved direction, each for a stated reason:
- mono-labels: the monospace face is set only on commands and gate names, a decision of the approved direction C (Quiet Instrument)
- hairline-newspaper: the thin rules are part of the engineering-drawing grid of the approved direction, not decoration
- numbered-steps: the numbered steps are the real order of the gates, 01 PLAN to 05 VERIFY

## Gaps
- Nothing is built yet: every path above marked `planned` is to be created by the implementation tasks. The docs surface is specified in DESIGN-docs.md.
- Decided 2026-11-20 (PRD N-5, ADR 0006 and 0008): one small same-origin controls script, at most 2048 bytes uncompressed, for the saved theme and the copy button; CI checks the size and that no other script is on the four pages. Without it the theme follows the system setting and the command is selected by hand.
- Decided 2026-11-20 (docs surface design): docs pages load `docs.js` (at most 4096 bytes uncompressed) and the search script only; the size check and the "no other script" check run in CI (ADR 0008). The sample's `docs.js` is 2806 bytes; the 4096 limit leaves room for the search wiring.
- Contrast of the diagram's red box against the teal box is 1.05 (light) and 1.51 (dark): the two states are told apart by shape and label, not by colour or lightness (DESIGN-marketing.md, R-1).
- Decided 2026-11-23 (TASK-019, user option A): the two-line phone headline stays at 31.2 px at 390 wide, so its ratio to the 16 px body is 1.95, below the check minimum of 3 (design_type_scale, rows D-29 and D-68); the rows are waived. The copy button is hidden without the controls script by design (AC-14), so the design_no_script_visible rows D-84, D-87, D-92 and D-95 are waived.
- Decided 2026-11-24 (TASK-021, user waivers): the get-started pages are plain text by design, so the design checker rows design_empty_hero (no visual in the first viewport) and design_motion_count (nothing animates) fail on them and are waived; the 390 px headline ratio of 1.95 is the same waived value as on the home pages.
