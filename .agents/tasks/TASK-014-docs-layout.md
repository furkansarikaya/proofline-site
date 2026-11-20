# Task: TASK-014 - Docs layout

---
origin: prd:site
type: feature
size: L
depends_on:
  - TASK-005
  - TASK-011
prd: site

---

## Goal

Every synced documentation page is shown in the docs layout of the approved docs-surface design: a header with a place for search, a sticky documentation tree, a text column of `33em`, a page outline, a provenance row and a page foot, in English and in Turkish, from a phone to a wide desktop.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: NFR-6 (accessibility of the layout), FR-17 (Turkish tree marks English-only pages), FR-12 (shown by TASK-011, laid out here).

- Design: `/docs/design/DESIGN-docs.md` sections "Page structure", "Layout rules", "Provenance (every page)", "Responsive", "States", "Accessibility", "Copy" and "New items"; `/docs/design/DESIGN.md` sections "Header controls (rules)" (rules 5, 8 and 9: tab order, search button place, scripts on docs pages) and "Spacing". Approved sample: `/docs/design/references/docs-surface/` with `en-concept-workflow.html`, `en-skills.html` and `tr-guide-gunluk-kullanim.html`. A look reference, not code to copy one to one; where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (address table, point 8 navigation: `/docs/#guides` and `/docs/#concepts` are the breadcrumb targets), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` (point 6: the Markdown address of a page), `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (point 2: `style-src 'self'`, so no inline style).
- Today: TASK-011 builds the synced pages with the shared Base layout only (`src/layouts/Base.astro`); TASK-005 builds the header, footer and `controls.js`. This task moves the synced pages to a docs layout that reuses the TASK-005 header unchanged except for one empty search place.
- Not here: the stale notice of the Turkish guides (TASK-013; this layout keeps its place above the H1), the content components inside the text (code block, table, anchors: TASK-015), `docs.js` and every button behaviour (TASK-016), the docs home, the catalogue and the skill page (TASK-017), the search widget (TASK-028).
- Assumption: the three navigation regions (site menu, documentation tree, "On this page") each get an accessible name; the design text says "two named `nav` regions" and lists three, so all three are named.
- Assumption: "previous" and "next" follow the order of the tree, top to bottom, across groups (the design does not say).
- Assumption: the Markdown address of a page is its address without the trailing slash plus `.md` (the design's example `/docs/guides/daily-use.md`).
- Browser checks follow `/docs/adr/0009-browser-checks-with-the-playwright-library-under-node-test.md`: `node:test` files that drive Chromium through the `playwright` library against the built fixture site served by `scripts/serve-dist.mjs`, kept under `tests/browser/` (not matched by the default `node --test` discovery) and run by an npm script `test:browser` (`node --test tests/browser/*.mjs`), which this task adds if no earlier task has.
- Expected scope: `src/layouts/docs/DocsLayout.astro`, `src/components/docs/DocsTree.astro`, `src/components/docs/DocsOutline.astro`, `src/components/docs/DocsProvenance.astro`, `src/components/docs/DocsPageFoot.astro`, `src/lib/docs-nav.mjs`, `src/styles/docs.css`, `src/components/marketing/Header.astro` (the search place), the synced page routes of TASK-011 under `src/pages/docs/` and `src/pages/tr/docs/`, `tests/docs-nav.test.mjs`, `tests/browser/docs-layout.mjs`, `tests/fixtures/docs/`, `package.json` (the `test:browser` script). 13 paths.

## Acceptance criteria

- AC-1: A synced page (the fixture page `/docs/concepts/workflow/`) is opened in a 1440 px wide window -> the header sits above three columns in this order from the left: the tree (256 px wide), the text column, the outline (216 px wide); the page is at most 1400 px wide and the column gap is 48 px.
- AC-2: The same page is measured at 1440 px -> the text column is `33em` wide (561 px at its 17 px font size, 1 px tolerance), and its CSS holds the length `33em`, not `75ch`.
- AC-3: The page is opened in a 1000 px wide window -> two columns show (tree 240 px, text), the column gap is 36 px, the outline is not a column but a closed panel for the "On this page" button row above the text, and the "Docs" button is not shown (the tree is open).
- AC-4: The page is opened in a 390 px wide window -> one column shows, the page itself has no sideways scroll (`document.documentElement.scrollWidth` is at most 390), and the button row for "Docs" and "On this page" exists with `aria-expanded="false"` on both buttons.
  Covers: NFR-6
- AC-5: The page is opened with scripts disabled at 390 px and at 1440 px -> the tree, the outline and the text are all visible in the document order skip link, header, tree, outline, text; the menu buttons and the search place are not visible; the system colour theme applies by CSS.
  Covers: NFR-6
- AC-6: The tree and the outline are measured at 1440 px -> both compute `position: sticky`, `top: 0` and their own vertical scroll; above 819 px a 1 px line in the `--rule` colour closes the tree on the right, and at 819 px and below there is no such line.
- AC-7: The tree is read on the page of the current address -> the current page's link shows `aria-current="page"`, a 2 px `--accent` bar on its left edge, font weight 500 and the `--surface` ground, so the state does not rest on colour alone.
  Covers: NFR-6
- AC-8: The tree is read on an English and on a Turkish page -> its title is "Documentation" ("Belgeler"), its groups are "Docs home", "Skill catalogue", "Guides", "Concepts", "Skills (28)", "Reference" ("Belgeler ana sayfası", "Skill kataloğu", "Kılavuzlar", "Kavramlar", "Skill'ler (28)", "Başvuru"), and the number in "Skills (28)" is the count of `skills/*/SKILL.md` entries of the lock (a fixture lock with 3 skills shows "Skills (3)").
- AC-9: A Turkish docs page is built -> its tree links the two Turkish guides to their `/tr/docs/guides/` addresses and shows every page that has no Turkish version as a link to the English page followed by the small tag `EN` (`lang="en"`), with 0 `/tr/` addresses for those pages.
  PRD ids: AC-13
  Covers: FR-17
- AC-10: Any docs page is built -> under its H1 the provenance row reads "Taken from proofline v0.0.173" ("proofline v0.0.173 sürümünden alındı") using the tag of `sync/pin.json`; with a fixture pin whose tag is null it reads the 7-character short commit instead; the page holds 0 strings of 40 hexadecimal characters and 0 blob ids in its visible text.
  PRD ids: AC-17
  Covers: FR-12
- AC-11: A docs page is built -> its page foot holds two text links, "Edit source" to `https://github.com/furkansarikaya/proofline/edit/main/` plus the repository path of the file, and "Markdown version" to the page address with `.md` (for the Turkish guide `/tr/docs/guides/gunluk-kullanim.md`), each at least 44 px high; the Turkish texts are "Kaynakta düzenle" and "Markdown sürümü".
- AC-12: The tree order is guide, concept, skill pages in that order and a fixture page in the middle of it is built -> below the foot row two bordered links show the previous and the next page, each with the small label "Previous" ("Önceki") or "Next" ("Sonraki") over the page title and no arrow; the first page has no "Previous" link and the last page has no "Next" link.
- AC-13: A docs page is built -> the header holds an empty element with the attribute `data-search-slot` after the menu links and before the GitHub link, and no search button is rendered by this task; the focus order of the header is brand, menu links, search place, GitHub, language, theme.
  Covers: NFR-6
- AC-14: A docs page is built -> the first focusable element is the skip link "Skip to the text" ("Metne geç") that leads to the `main` element; the page has one `header`, one `main`, three `nav` elements each with an accessible name (site menu, "Documentation", "On this page"), exactly one H1, and `lang` of the page is `en` or `tr` by its address.
  Covers: NFR-6
- AC-15: The skip link, a tree link, an outline link, the "Docs" button and a page-foot link are focused with the keyboard -> each shows a 2 px `--accent` focus ring with a 3 px offset; the "Docs" and "On this page" buttons and both page-foot links are at least 44 px high, and tree and outline rows are at least 32 px high.
  Covers: NFR-6
- AC-16: The docs CSS is read and the page is opened with reduced motion asked -> the CSS holds 0 `transition` and 0 `animation` properties, and `scroll-behavior` computes to `auto`.
- AC-17: Failure criterion (anti-goal): the task is not done if a docs page still renders in the Base layout without a tree, if any docs page holds a `style=` attribute, an inline style element, a diagram, a hatched fill or the `controls.js` script, if a Turkish tree entry for an English-only page points to a `/tr/` address, or if the text column is `75ch` wide, even when every other check is green.

## Out of scope

- The stale notice of Turkish guides (TASK-013) and the docs home, catalogue and skill page (TASK-017); this layout only keeps the place above the H1 for the notice.
- Code blocks with copy buttons, scrollable tables, heading anchors and inline code ground (TASK-015) and the tokens `--install-bg`, `--code-bg`, `--measure` (TASK-015).
- `docs.js`, every button behaviour (menus opening, outline highlight, shortcuts) and the saved theme on docs pages (TASK-016).
- The search button and the Pagefind panel (TASK-028); this task leaves the empty place only.
- Syntax highlighting, breadcrumbs beyond the provenance row, and any change to the header controls of TASK-005.
- Marketing pages and their layout.

## Constraints

- Expected test exception: none for layout; the geometry is asserted with Playwright measurements, so a RED exists. Visual likeness to the approved sample (spacing feel, type rhythm) is not asserted by a test and is left to review against the sample.
- `/docs/design/DESIGN-docs.md` is the contract: the text column is `33em`, never `75ch`; hairlines separate sections and rows, square corners, no shadow, no gradient, no cards.
- ADR 0006: no inline style and no inline script in pages; a docs page carries `docs.js` and the search script only (`/docs/design/DESIGN.md`, header rule 9), so `controls.js` is not loaded there.
- Colours come from the tokens of TASK-003 (`--bg`, `--surface`, `--rule`, `--accent`, `--ink`, `--muted`); this task adds no token.
- No new dependency in `package.json`; the only change there is the script `test:browser`.
- Turkish text follows `/docs/design/DESIGN-docs.md` section "Copy": technical terms and proofline's own names stay English.

## Risks

- The tree lists about 50 pages; a slow sticky tree on a phone is not measured here (the phone tree is a menu panel of at most 70vh).
- TASK-013 is a sibling task: if it ships its note inside the Base layout, moving the pages to this layout can drop the note; the note's place above the H1 is the agreed contact point.
- The header component is shared with every page; adding the search place can shift the header of the four site pages by nothing visible, and the test of TASK-005 for the header must still pass.
- The "Skills (28)" count is read from the lock; if the lock fixture and the real lock differ, the test fixture is the only place that proves the count is not typed.
- Browser tests need Chromium installed in CI; they are not part of `npm test` (ADR 0009).

## Pre-existing defects

none

## Suggested class

COMPLEX - two or more modules (layout, components, navigation data, styles, shared header, routes) and a design choice with real tradeoffs

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
- `npm run test:browser`
