# Task: TASK-018 - Pipeline diagram component

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-003
prd: site

---

## Goal

The home page can show the one memorable drawing of the site as a component: an isometric pipeline of five gates through which a task passes, with one task stopped and sent back and one finished, animated by CSS only, with a text alternative, a key line and a legend of the five gates in English and in Turkish.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: NFR-5 (the diagram uses no script), NFR-6 (labels, text alternative, reduced motion, no state by colour alone).

- Design: `/docs/design/DESIGN-marketing.md` sections "The diagram (the one memorable thing)" (rules R-1, R-2, R-3, R-7, the text alternative, the legend sentences), "Layout rules" (rule R-4 hatching, the frame, the legend as the frame's last row) and "States of the first screen" (rows "Reduced motion" and "Narrow (phone)"); `/docs/design/DESIGN.md` sections "Tokens" (`--block`, `--accent`, `--frame`, `--hatch`, `--rule`), "Spacing" (breakpoint 820 px) and "Accessibility baseline". Approved sample: `/docs/design/references/direction-c/` with `c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html` (the frame, the key line and the legend are in them). The sample's SVG is generated and is not the source: the drawing is rebuilt from the description. A look reference, not code to copy one to one; where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (no inline style attribute, no script), `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (anything not in the address table is 404, so the component gets no page of its own).
- Today: `src/layouts/Base.astro` and the placeholder pages exist; TASK-003 adds the tokens (`src/styles/tokens.css`), among them `--block`, `--accent`, `--frame`, `--hatch`, `--rule`. The home page that places the component is TASK-019.
- Texts of the sample used here. English key line: "Cross: blocked at review and sent back for a fix round. Check mark: CODE_DONE." Turkish key line: "Çarpı: review’da engellendi, fix round’a geri döner. Onay işareti: CODE_DONE." Legend, English (from the design document): PLAN "frozen with a scope: file list"; TEST "RED, then GREEN, reproduced by the gates"; REVIEW "never by whoever wrote the change"; SECURITY "cannot be waived"; VERIFY "CODE_DONE only when every required gate passed". Legend, Turkish (from the sample): PLAN "scope: dosya listesiyle dondurulur"; TEST "önce RED, sonra GREEN; kapılar bağımsız yeniden üretir"; REVIEW "değişikliği yazan onu asla review etmez"; SECURITY "waive edilemez"; VERIFY "gerekli her kapı geçmeden CODE_DONE olmaz".
- Assumption: the text alternative (`aria-label` of the drawing) says in one or two sentences that a task passes the five gates plan, test, review, security and verify, that a claim failing review is sent back, and that a finished task leaves as CODE_DONE; its exact wording is chosen by the plan, with the Turkish translation on Turkish pages.
- Assumption: "a phone" for the narrow rail width is the stack breakpoint of the base design, 820 px (as in the sample).
- Note for TASK-030: the token `--block` is declared once in `src/styles/tokens.css` with the two colour values, so the red-rule check of the later task must allow that declaration and look for the use `var(--block)`; this task proves the use is a single rule.
- The test harness for a component that has no page is chosen by the plan (for example Astro's container rendering into a static file loaded in Chromium); no page is added to the address table of the site.
- Expected scope: `src/components/marketing/PipelineDiagram.astro`, `src/styles/pipeline.css`, `tests/pipeline.test.mjs`, `tests/browser/pipeline.mjs`, `tests/fixtures/pipeline/`. 5 paths.

## Acceptance criteria

- AC-1: The component is rendered for English and for Turkish -> the output holds one `svg` with `role="img"` and a non-empty `aria-label` that names PLAN, TEST, REVIEW, SECURITY, VERIFY, BLOCKED and CODE_DONE, and the Turkish label differs from the English one.
  Covers: NFR-6
- AC-2: The drawing's text elements are read left to right -> they show `TASK`, `01 PLAN`, `02 TEST`, `03 REVIEW`, `04 SECURITY`, `05 VERIFY`, `CODE_DONE` in this order of increasing horizontal position, with five gate arches and each gate label above its arch.
- AC-3: The still frame is measured -> the blocked slab carries the label `BLOCKED` and a cross shape and its centre lies within the horizontal range of the `03 REVIEW` arch; the finished slab carries a check mark shape and lies at the exit, right of the `05 VERIFY` arch.
  Covers: NFR-6
- AC-4: The component CSS and the rendered drawing are read -> the blocked slab's fill is `var(--block)`, the finished slab's fill is `var(--accent)`, `var(--block)` is used by exactly one rule, and the drawing and its CSS hold 0 colour literals (`#` colours or `rgb(`), so both themes apply by tokens.
- AC-5: The built CSS of a page with the component is searched for `#c4152b` and `#e0354a` -> they occur only in the declaration of the token `--block`, and `var(--block)` occurs only in the blocked-slab rule of the diagram.
- AC-6: The page is opened with motion allowed -> the animated elements of slab A and slab B compute `animation-duration` of 20 s with `animation-iteration-count: infinite`, and the component output holds 0 `script` elements, 0 `on*` attributes and 0 SMIL elements (`animate`, `animateTransform`, `set`).
  Covers: NFR-5
- AC-7: The page is opened with `prefers-reduced-motion: reduce` -> every element of the drawing computes `animation-name: none` and the drawing shows the still frame of AC-3.
  Covers: NFR-6
- AC-8: The drawing's labels are measured on screen at viewport widths 460, 500, 600, 721, 1000 and 1440 px -> every label shows a height of at least 12 px, and at 460, 500 and 600 px the heights are at least 12.7, 14.0 and 17.3 px (the design's measurements, 0.1 px tolerance).
  Covers: NFR-6
- AC-9: The page is opened at 459 px -> the drawing labels are not visible, the cross and check shapes still are, and the key line (English or Turkish text above) is visible at 14 px or more; at 460 px and wider the key line is not visible.
  Covers: NFR-6
- AC-10: The legend is read in English and in Turkish -> it is an ordered list of five items `01 PLAN` to `05 VERIFY`, each with its sentence from the Context in the page's language, visible at every width; at 1440 px the five items stand in one row, at 720 px and below in one column.
- AC-11: The frame is measured -> it shows a 1 px `--rule` border on the `--frame` ground, side rails of 26 px above 820 px and of 12 px at 820 px and below that carry the `--hatch` pattern, no other element of the component has a hatched fill, and the legend is the frame's last row.
- AC-12: Failure criterion (anti-goal): the task is not done if a state is told by colour alone (the blocked and finished slabs lack their shape or their label), if `--block` is used for anything but the blocked slab, if any element animates under `prefers-reduced-motion: reduce`, if a drawing label is smaller than 12 px on screen, or if the drawing needs a script, even when the screenshot looks like the sample.

## Out of scope

- Placing the component on the home page, the headline and the install command (TASK-019).
- The build check that searches the whole built CSS for the red values and the script count (TASK-030).
- A build check that the legend sentences still equal the README sentences; they are hand-written here and a README rewording is not detected (see Risks).
- The 14 by 92 px hatched tab beside a section headline (rule R-4); it belongs to the home page.
- Any other animation, illustration or icon on the site.

## Constraints

- Expected test exception: the drawing geometry has no RED for its look (isometric shapes are drawn, not computed). Tested instead: label texts and order, roles and names, the still-frame positions by bounding boxes, the reduced-motion rule, the single `--block` use, no script, the frame and rail widths, and the legend texts.
- Motion is CSS only, 20 s loop, off under `prefers-reduced-motion: reduce` (`/docs/design/DESIGN-marketing.md`, R-3).
- Colours only through the tokens of `/docs/design/DESIGN.md`; no gradient, no glow, no shadow.
- No inline `style` attribute and no inline script (ADR 0006).
- No new dependency.

## Risks

- The legend sentences are copied from the README by hand; if the README changes a gate sentence the legend goes stale without a failing build.
- The red and teal slabs differ little in lightness (1.05 light, 1.51 dark); only shapes and labels tell the states apart, which AC-3 and AC-12 guard.
- The loop is 20 s with two slabs; a slow device may drop frames, but the page stays readable because the still frame and the legend carry the same information.
- A component with no page of its own needs a test harness that does not leak into the address table.

## Pre-existing defects

none

## Suggested class

STANDARD - one new component with its styles and tests, no integration, persistence or security boundary (the red-rule check and the home page are other tasks)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
- `npm run test:browser`
