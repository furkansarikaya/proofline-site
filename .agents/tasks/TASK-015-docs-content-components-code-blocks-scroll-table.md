# Task: TASK-015 - Docs content components: code blocks, scroll tables, heading anchors, inline code

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-014
prd: site

---

## Goal

The text of a synced page shows its code blocks with a copy button, its tables in a labelled box that scrolls sideways, a link to each heading and a ground behind inline code, using the three new tokens of the docs surface.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: NFR-6 (keyboard reach, target size, contrast of the content components).

- Design: `/docs/design/DESIGN-docs.md` sections "Layout rules" (bullets "Code block", "Table", "Heading anchors"), "Typography use" (table rows for code, inline code and tables), "Copy" (copy button rows), "States" (row "Copied", "Page without script"), "Accessibility" (contrast numbers, focus, scroll regions) and "New items (for the knowledge step)" (the tokens). `/docs/design/DESIGN.md` section "Tokens". Approved sample: `/docs/design/references/docs-surface/` with `en-concept-workflow.html` (long tables and code) and `docs.css`. A look reference, not code to copy one to one; where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` (no syntax highlighting in version 1; the transform emits plain `pre` and `code`), `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (point 2: no inline style, no inline script).
- Today: TASK-008 turns the synced Markdown into HTML (fenced blocks as `pre` with `code`, GFM tables, headings with ids); TASK-014 puts that HTML in the docs layout. Behaviour of the copy button (clipboard, announcements) belongs to `docs.js` (TASK-016); this task builds the markup and the style.
- Tokens added here when not already defined in `src/styles/tokens.css` (if an earlier task defined one, its values are checked to be equal): `--install-bg` (`#e8e5df` light, `#121618` dark), `--code-bg` (`rgba(10,10,10,.07)` light, `rgba(232,228,220,.09)` dark), `--measure` (`33em`). TASK-014 writes the literal `33em` in the docs CSS; this task replaces it by `var(--measure)`.
- Assumption: "below 720px they may wrap only where the source is a command" (design text) is read as: a fenced block whose language word is `sh`, `bash`, `shell` or `console` wraps below 720 px, every other block scrolls sideways.
- Assumption: the Turkish accessible name of the heading anchor is "Bu bölüme bağlantı" (the design gives only the English name "Link to this section"); this task adds the row to the Copy table of `DESIGN-docs.md`.
- Assumption: heading ids already exist in the transform output (the page manifest holds `headings[]`); the anchor reuses them.
- Browser checks follow ADR 0009 (`tests/browser/` and `npm run test:browser`, see TASK-014).
- Expected scope: `src/styles/tokens.css`, `src/styles/docs.css`, `src/lib/docs-enhance.mjs` (wraps blocks and tables, adds anchors in the transform's HTML), `src/layouts/docs/DocsLayout.astro` (calls it, reads `--measure`), `tests/docs-enhance.test.mjs`, `tests/browser/docs-components.mjs`, `tests/fixtures/docs/` (a page with a long table, code in two languages, a duplicated heading), `docs/design/DESIGN-docs.md` (the Turkish anchor name). 8 paths.

## Acceptance criteria

- AC-1: A fenced code block of a synced page is built -> the block sits in a box with the `--install-bg` ground and a 1 px `--rule` border, its `pre` has `tabindex="0"` and scrolls sideways, and a button with the accessible name "Copy this code" ("Bu kodu kopyala") and the visible text "Copy" ("Kopyala") sits at its top right corner.
  Covers: NFR-6
- AC-2: The copy button is measured -> it is 44 by 44 px with a `--rule` border on its left and bottom edges, and the computed right padding of the block is at least 44 px so the first line clears the button.
  Covers: NFR-6
- AC-3: The text of the `code` element inside a block is compared with the source code text of the fixture -> they are identical, and the button text is not part of that `code` element.
- AC-4: A block with the language word `bash` and a block with the language word `json` are opened in a 390 px wide window -> the `bash` block wraps its lines, the `json` block keeps its lines and scrolls sideways; at 1440 px neither wraps.
- AC-5: A GFM table of the fixture (more than 6 columns and 57 rows) is built -> it shows inside a `div` with `role="region"`, `tabindex="0"` and the accessible name "Table, scrolls sideways" ("Tablo, yana kaydırılır"), the box has a 1 px border, the header row has the `--surface` ground and weight 500, each cell is at least 9ch and at most 14ch wide, and at 390 px the box scrolls sideways while the page does not (`scrollWidth` of the page is at most 390).
  Covers: NFR-6
- AC-6: A heading of level 2, 3 or 4 is built -> a link `#` follows the heading text with the accessible name "Link to this section" ("Bu bölüme bağlantı"), its `href` is the heading's id, it is visible on hover and on keyboard focus, and the heading text without the link equals the source heading text unedited.
  Covers: NFR-6
- AC-7: A fixture holds two headings with the same text -> the two anchors point to two different ids and both targets exist on the page.
- AC-8: Inline code in running text is built -> it has the `--code-bg` ground over `--bg`, the JetBrains Mono face at 0.88em and the `--ink` text colour; the code inside a block does not get the inline ground.
- AC-9: `src/styles/tokens.css` is read -> `--install-bg`, `--code-bg` and `--measure` exist with the values of the Context in the light and the dark theme, the docs CSS holds no `33em` literal, and the text column computes the same width as before (561 px at 17 px).
- AC-10: The contrast of `--ink` on `--install-bg` and of `--muted` on `--install-bg` is computed from the token values by the WCAG formula -> the test reports four ratios that equal 15.75 and 14.36 for ink (light, dark) and 5.62 and 6.56 for muted (light, dark) at two decimals, and all stay at least 4.5.
  Covers: NFR-6
- AC-11: The page is opened with scripts disabled -> the copy buttons are not visible, the code stays selectable, the block and table boxes stay keyboard focusable and scroll, and the anchors still work.
  Covers: NFR-6
- AC-12: A block, the table box and a heading anchor are focused with the keyboard -> each shows a 2 px `--accent` focus ring with a 3 px offset.
  Covers: NFR-6
- AC-13: Failure criterion (anti-goal): the task is not done if a built page holds a syntax-highlighting span or class, an inline `style=` attribute, an inline script or `onclick` attribute, if the copied text could include the button label, or if a heading's text is changed by the anchor, even when the build is green.

## Out of scope

- The behaviour of the copy button, the "Copied" announcement and the refused-clipboard path (TASK-016).
- Syntax highlighting (ADR 0003: not in version 1).
- Transform rules, sanitising and the link map (TASK-008, TASK-009).
- The layout, tree, outline and page foot (TASK-014), the catalogue list and the skill page (TASK-017).
- The copy button of the install command on the four site pages (TASK-005).

## Constraints

- Expected test exception: none for markup and style (they have a RED). The two ratios of AC-10 are computed from token values, not measured in a browser.
- Tokens only: no colour literal in the docs CSS outside `var(--token)`; the three new tokens are the only additions to `tokens.css`.
- ADR 0006: no inline style and no inline script; `style-src 'self'`.
- No new dependency. The enhancement is a module over the transform's HTML; the choice of how to parse it is left to the plan.
- Square corners, no shadow, no gradient (`/docs/design/DESIGN-docs.md`, "Layout rules").

## Risks

- A synced document may hold a table with a header row spanning more columns than the box can show; the box scrolls, the page must not.
- The language word of a fence is whatever the source wrote (`text`, `sh`, no word); a command block with no language word scrolls instead of wrapping.
- Duplicate heading ids are produced upstream of this task; if the transform gives two headings one id, AC-7 fails and the transform is where it changes (TASK-008).
- The inline code ground contrast is not measured by the design (`/docs/design/DESIGN-docs.md`, "Gaps"); the text colour stays `--ink`.

## Pre-existing defects

none

## Suggested class

COMPLEX - two or more modules (shared tokens, the docs layout, a new enhancement module) and a design choice about how HTML is wrapped

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
- `npm run test:browser`
