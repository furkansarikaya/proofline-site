# Task: TASK-021 - Get-started page in English and Turkish

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-005
  - TASK-010
  - TASK-020
prd: site

---

## Goal

A developer opens `/get-started/` or `/tr/baslarken/`, follows the install steps and the first-task steps for Claude Code and for Codex, finds only commands that the proofline README itself shows, and reads that `init` and `doctor` take a few seconds without any claim about the time of a first installation.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-3, FR-4, FR-5, US-2 (AC-3, AC-5), AC-12 (get-started page).

- Design: `/docs/design/DESIGN-marketing.md` sections "Typography use", "Layout rules" (cards, shadows and gradients are not used), "Copy rules" (no install time; Turkish pages keep technical terms and proofline's own names in English) and "Gaps" (this page is not drawn: it follows the rules and is specified by its task); `/docs/design/DESIGN.md` sections "Typography", "Spacing" and "Header controls (rules)". Approved sample: `/docs/design/references/direction-c/` with `c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html` (the command block, the step blocks and the Turkish menu word "Başlarken"). A look reference, not code to copy one to one; where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (addresses `/get-started/` and `/tr/baslarken/`, point 4 content files and the stamp, point 5 titles), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` (pin facts), `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (one controls script).
- README at the candidate pin (`.agents/local/scratch/pl-tree/README.md`, section "Install" to "What it supports", which includes "Quick start") holds these command lines: `/plugin marketplace add furkansarikaya/proofline` and `/plugin install proofline@proofline` (Claude Code); `git clone https://github.com/furkansarikaya/proofline` and `node proofline/adapters/codex/install.mjs` with a trailing comment (Codex and terminal); an inline span starting `npx skills add furkansarikaya/proofline --skill` (skills only); `proofline init`, `proofline doctor`, `proofline status` (each with a trailing comment); `/proofline task --grill Add rate limiting to the login endpoint` and `/proofline run TASK-001`. The real pin (v0.0.173) is the source at build time; this list is the shape, not a copy.
- Today: TASK-005 gives the header, footer, `controls.js` and the copyable command component; TASK-010 gives `readme_commands[]` and `readme_inline_spans[]`; TASK-020 gives the guards (command lines against the README range, the install-time pattern against PROBES.md) and the marker `data-command` for inline spans.
- Assumption: the Turkish wording of the measured-scope sentence is chosen by the plan; it must contain "init ve doctor birkaç saniye", "boş bir klasör" and "zaten kurulu" (the PRD gives only the first phrase).
- Assumption: the prerequisites sentence of the README ("Requirements: Git, Node.js ...") is not repeated; the page shows what the PRD asks for only.
- Assumption: only the first-screen install command of the home page has a copy button (`controls.js` serves one command block); the blocks here are selectable text.
- Expected scope: `src/content/` get-started files in both languages (location set by TASK-004), `src/pages/get-started/index.astro` and `src/pages/tr/baslarken/index.astro` (or the route files of TASK-004's content setup), `src/components/marketing/CommandBlock.astro` (a block that marks its lines for the guard, if TASK-005's component does not), `src/styles/get-started.css`, `tests/get-started.test.mjs`, `tests/fixtures/get-started/`. 7 paths.

## Acceptance criteria

- AC-1: `/get-started/` and `/tr/baslarken/` are built -> the html element carries `lang="en"` and `lang="tr"`, each page has one H1 ("Get started", "Başlarken"), and the title is the page title plus the suffix of ADR 0002 point 5 (`Get started | proofline: a deterministic engineering team for Claude Code and Codex`, `Başlarken | proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi`) with no "evidence" or "kanıt".
  PRD ids: AC-10, US-2
  Covers: FR-3
- AC-2: The Claude Code part is read -> it shows the two plugin lines `/plugin marketplace add furkansarikaya/proofline` and `/plugin install proofline@proofline` in one command block under a heading "Claude Code", and the Codex part shows `git clone https://github.com/furkansarikaya/proofline` and `node proofline/adapters/codex/install.mjs` in a command block under a heading "Codex".
  Covers: FR-3
- AC-3: The first-task part is read -> it shows `proofline init`, `proofline doctor` and `proofline status` in order, then `/proofline task --grill Add rate limiting to the login endpoint` and `/proofline run TASK-001`, and the skills-only inline span starting `npx skills add furkansarikaya/proofline --skill`.
  Covers: FR-3
- AC-4: Every command line of every block of the built pages is trimmed and stripped of a trailing comment starting with " #" -> each equals a line of `readme_commands` of the pin facts, and the marked inline span equals a member of `readme_inline_spans`; the command blocks carry `lang="en"` and `translate="no"`.
  PRD ids: AC-3
  Covers: FR-4
- AC-5: One command line of the fixture content is changed so that the README does not hold it -> `npm run build` exits non-zero and the message names the page and the line (the guard of TASK-020 is wired to these pages).
  PRD ids: AC-3
  Covers: FR-4, NFR-4
- AC-6: Each page is read -> the English page shows the sentence that `init` and `doctor` take a few seconds, and the Turkish page shows "init ve doctor birkaç saniye"; both show that this was measured from an empty folder on a machine where the plugin and the command line tool were already installed (Turkish: the words "boş bir klasör" and "zaten kurulu").
  PRD ids: AC-5
  Covers: FR-5
- AC-7: Each page is searched for time -> it matches neither pattern of PRD AC-4, holds no number followed by a unit of time (minute, hour, "dakika", "saat") and no sentence that gives a duration for the first installation, and PROBES.md still has no PB-3 `confirmed` result in the test fixture.
  PRD ids: AC-4, AC-5, AC-36
  Covers: FR-5
- AC-8: The Turkish page is read -> all prose and interface text is Turkish, the only elements with `lang="en"` are command blocks, the inline command span and proofline's own names, and the language link of the header leads from `/get-started/` to `/tr/baslarken/` and back.
  PRD ids: AC-12
  Covers: FR-17
- AC-9: The two pages are read -> they list each other as `hreflang` alternates with `x-default` to `/get-started/`, taken from the translation index, and the Turkish content file records the hash of the English content file so no stale notice shows.
  Covers: FR-17
- AC-10: Failure criterion (anti-goal): the task is not done if a command appears that the README range does not hold (for example an invented Codex command), if any text gives a time for the first installation, or if the Turkish page is only the English text with Turkish headings, even when the build is green.

## Out of scope

- The guards and their tests (TASK-020), the pin facts (TASK-010), the header, footer and `controls.js` (TASK-005).
- Running PB-3 and stating the time of a first installation (TASK-044; allowed only on a `confirmed` result).
- Copy buttons for these blocks (the first-screen command of the home page only).
- The page for Claude Code and Codex together (TASK-023), the trust page and the home page.
- The README prerequisites sentence, uninstall steps, troubleshooting and the existing-project guide (a synced guide).

## Constraints

- Expected test exception: none; text, structure and build behaviour have a RED.
- PRD FR-4 and FR-5 as written: blocks are hand-written and checked; no install time until PB-3 is `confirmed`.
- Site-written Turkish pages follow ADR 0002 point 4: a content file with `translatedFrom` (page and hash) written by `npm run translation:stamp`.
- Turkish prose follows `/docs/design/DESIGN-marketing.md` "Copy rules".
- No new dependency; no inline style or script (ADR 0006).

## Risks

- A README rewording of a command makes this page's build fail by design until the page is edited.
- The Codex steps rest on README lines at one pin; the Codex limit sentence is shown on TASK-023, not here, so a reader may assume Codex is fully supported from this page alone.
- The measured sentence rests on one probe (PB-1, 5 seconds); the page must not generalise it.

## Pre-existing defects

none

## Suggested class

STANDARD - two content pages on the existing layout with hand-written blocks checked by an existing guard; no new integration (COMPLEX considered: it reads the pin facts)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run check:guards`
- `npm run test:axe`
