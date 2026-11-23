# Task: TASK-019 - Home page in English and Turkish

**Status:** done

---
origin: prd:site
type: feature
size: L
depends_on:
  - TASK-004
  - TASK-005
  - TASK-010
  - TASK-018
prd: site

---

## Goal

A first-time visitor who opens `/` or `/tr/` sees within the first screen what makes proofline different (a script blocks a claim with no proof), can copy the install command, sees the pipeline drawing, reads the three steps from install to a finished run with a real output excerpt, and reads the limits statement, in English and in Turkish.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-1, FR-2, FR-16, FR-17; US-1 (AC-1, AC-2), AC-10, AC-12 (home page), N-1 and N-2 (notes of the promotional design step).

- Design: `/docs/design/DESIGN-marketing.md` sections "Idea and argument", "Typography use" (the headline), "Layout rules" (first screen order and columns, rule R-4, the lower reading column), "Real output as the visual material" (rule R-5), "Limits and trust statement (R-6)", "Copy rules" and "States of the first screen"; `/docs/design/DESIGN.md` sections "Typography" (type scale), "Spacing" and "Header controls (rules)". Approved sample: `/docs/design/references/direction-c/` with `c-quiet-instrument-v2-en.html` and `c-quiet-instrument-v2-tr.html`, which hold the texts used below. A look reference, not code to copy one to one; where the sample and the design document differ, the design document wins.
- ADRs: `/docs/adr/0002-addresses-languages-hreflang-and-titles.md` (address table; point 4 content files; point 5 titles: the home title is the name and phrase only; JSON-LD `WebSite` on the home pages), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` (pin facts and the 'Real output' excerpt), `/docs/adr/0006-privacy-headers-csp-and-referrer.md` (one controls script, the JSON-LD data block is the only other script element).
- Today: `src/pages/index.astro` and `src/pages/tr/index.astro` are placeholders of TASK-001. TASK-004 gives the title and description builders, the translation index and the `og-default.png`; TASK-005 gives the header, footer, `controls.js` and the copyable command component; TASK-010 gives the pin facts (`real_output`, `readme_commands`, `commit`, `tag`); TASK-018 gives the pipeline diagram with its frame, key line and legend.
- Texts (from the sample, not edited): English headline "A script blocks / a claim with no proof."; Turkish "Dayanaksız iddiayı / bir script engeller."; English lead "proofline is a deterministic engineering team for Claude Code and Codex, for developers who let an agent change real code."; Turkish lead "proofline, Claude Code ve Codex için deterministik bir mühendislik ekibi; bir ajanın gerçek kodu değiştirmesine izin veren geliştiriciler için."; section headline "From install to a finished run." ("Bitmiş bir run’a kurulumdan."); step lines "First, install it." / "Then ask for a task, and run it." / "Last, read how it ended." ("Önce kurun." / "Sonra bir görev isteyin ve çalıştırın." / "En sonda nasıl bittiğini okuyun."); the install command `/plugin marketplace add furkansarikaya/proofline` and `/plugin install proofline@proofline`; the task commands `/proofline task --grill Add rate limiting to the login endpoint` and `/proofline run TASK-001`; the note link "Codex and terminal: Get started" ("Codex ve terminal: Başlarken").
- The limits sentence R-6 and its links are in `/docs/design/DESIGN-marketing.md` section "Limits and trust statement (R-6)" and in the PRD note N-1; the links are the site repository `https://github.com/furkansarikaya/proofline-site` and the README at the pinned commit.
- Assumption: JSON-LD is written here (TASK-004 builds titles, descriptions and tags); if TASK-004 already emits it, this task verifies it instead.
- Assumption: the Turkish home page links to the skills catalogue and the concepts section at their English addresses, with a link text that says the page is in English (they have no Turkish version, FR-17).
- Assumption: the install command and the two task commands are compared with the README commands of the pin facts by this task's own test (the get-started guard of TASK-020 covers the get-started page only).
- Expected scope: `src/pages/index.astro`, `src/pages/tr/index.astro`, the content files of the home page in both languages (location set by TASK-004), `src/components/marketing/Hero.astro`, `src/components/marketing/Steps.astro`, `src/components/marketing/RealOutput.astro`, `src/components/marketing/Limits.astro`, `src/styles/home.css`, `tests/home.test.mjs`, `tests/browser/home.mjs`, `tests/fixtures/home/`. 12 paths.

## Acceptance criteria

- AC-1: `/` and `/tr/` are built -> the `lang` attribute of the html element is `en` and `tr`, the page holds exactly one H1 whose text is "A script blocks a claim with no proof." and "Dayanaksız iddiayı bir script engeller.", the H1 breaks after "blocks" and after "iddiayı" at 1440 px (two lines), the first part computes the `--muted` colour and the second part the `--ink` colour.
  Covers: FR-2
- AC-2: The text of each built page is read in document order -> the headline sentence comes before the first match of `/evidence/i` (English) or of `kan[ıi]t` after Turkish lower-casing (Turkish), or the word does not occur at all.
  PRD ids: AC-2
  Covers: FR-2
- AC-3: The first screen is read at 1440 px and at 390 px -> the document order shows headline, description, install command, diagram frame (with the key line and the legend inside it); at 1440 px the headline sits on the left (7 of 12 columns) and the description with the command on the right (5 columns), at 390 px they stack in that order.
  Covers: FR-1
- AC-4: The built home pages are searched for lists -> the only list elements are the five-item gate legend of the diagram (and none lists roles or skills), the page holds the names of none of the roles and none of the 28 skills, and it links to the skills catalogue (`/docs/skills/`) and to the concepts section (`/docs/#concepts`).
  PRD ids: AC-1
  Covers: FR-1
- AC-5: The three steps are read -> they are in the order install, ask for a task and run it, read how it ended; the install and task commands are in code blocks marked `lang="en"` and `translate="no"`, each command line trimmed and without a trailing comment equals a line of `readme_commands` of the pin facts, and the page carries the English or Turkish step sentences of the Context.
  PRD ids: AC-1
  Covers: FR-1
- AC-6: The install command on the first screen is read -> it shows the two lines of the Context under the label "Claude Code", the copy button of TASK-005 is attached to it with the accessible name "Copy the install commands" ("Kurulum komutlarını kopyala"), and the note link leads to `/get-started/` (`/tr/baslarken/`) with the text "Codex and terminal: Get started" ("Codex ve terminal: Başlarken").
- AC-7: The real-output excerpt is read -> its text equals `real_output` of the pin facts of the fixture archive character for character (a changed fixture text shows on the page; the source holds no typed copy), it sits in an element with `lang="en"` on both pages, the caption says that the text is unedited, which lines are shown and which are left out and links to `docs/concepts/workflow.md#real-output` at the pinned commit, and the Turkish caption says the excerpt is quoted from the English source.
  Covers: FR-17
- AC-8: The limits section is read in English and in Turkish -> it holds the sentence of rule R-6 in the page's language exactly as written in `/docs/design/DESIGN-marketing.md` (the whole text, "site repository" linked to `https://github.com/furkansarikaya/proofline-site` and "README, Status" linked to the README at the pinned commit), and the phrase "not yet proven on real projects" does not stand alone anywhere on the page.
  PRD ids: N-1
- AC-9: The built home pages are searched for numbers -> they hold no count of tasks, pull requests or CI runs (no numeral next to the words task, pull request or run in either language), and no sentence that states an install time (the AC-4 pattern of the PRD finds 0 matches).
  PRD ids: N-2, AC-4
- AC-10: The title element, `og:title`, meta description, `og:description` and the JSON-LD name of each home page are read -> the title equals "proofline: a deterministic engineering team for Claude Code and Codex" ("proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi"), `og:title` equals it, the description and `og:description` carry the name and the phrase and are 70 to 160 characters long, one `script` element of type `application/ld+json` holds a `WebSite` whose `name` equals the title, and 0 titles, headings or `og:title` values contain "evidence" or "kanıt".
  PRD ids: AC-10
  Covers: FR-16
- AC-11: The two home pages are read -> each has a reciprocal `hreflang` alternate set (`en`, `tr`, `x-default` to `/`) taken from the translation index, the language link of the header leads from `/` to `/tr/` and back, and the other head tags (canonical, `og:image` with its localised alt) come from the builders of TASK-004.
  Covers: FR-17
- AC-12: `/tr/` is read -> all prose and interface text is Turkish, the page carries `lang="tr"`, and the only elements with another `lang` are command blocks, the real-output excerpt, product names and the links to English-only pages, which say in their text that the page is in English.
  PRD ids: AC-12, AC-13
  Covers: FR-17
- AC-13: The lower section is measured at 1440 px -> it is one reading column that starts at column 4 of the 12-column grid and is six columns wide, with a hatched tab of 14 by 92 px beside the section headline, and no other hatched element on the page lies outside the rails of the diagram frame.
- AC-14: The page is opened with `controls.js` blocked -> everything reads, the install command is selectable, the language link navigates, the theme follows the system by CSS, and the theme and copy buttons are not visible.
  Covers: NFR-5
- AC-15: Failure criterion (anti-goal): the task is not done if "evidence" or "kanıt" comes before the headline sentence or appears in a title or heading, if a count, an install time, a list of roles or skills or a typed copy of the real output is on the page, if the Turkish page shows English prose outside the exceptions of AC-12, or if the R-6 sentence is shortened to its README half, even when both pages build.

## Out of scope

- The pipeline drawing itself (TASK-018) and the header, footer and `controls.js` (TASK-005).
- The title and description builders, the translation index and `og-default.png` (TASK-004); the sitemap and indexing switch (TASK-006).
- The first-screen check with three developers (TASK-045, FR-29).
- The get-started, trust and Claude Code and Codex pages and the contact page.
- A claim of install time, statistics, customer logos or third-party logos (`/docs/design/DESIGN-marketing.md`, "Copy rules").
- The full lists of roles, skills and gates (they stay in the documents).

## Constraints

- Expected test exception: the visual likeness of the page to the approved sample (spacing feel, type rhythm, colour) has no RED and is left to review against the sample. Tested instead: text, order, columns at 1440 px and 390 px, computed colours, fonts and sizes, links, head tags and counts.
- All pin-derived text (real output, commit, tag) comes from the pin facts of TASK-010, never typed (NFR-4, N-2).
- ADR 0006: the only script files are `controls.js` and the JSON-LD data block; no inline style and no inline script body.
- Headline in sentence case, two-tone; the words "evidence" and "kanıt" are not used in any title or heading (`/docs/design/DESIGN-marketing.md`, "Typography use").
- Turkish pages follow `/docs/design/DESIGN-marketing.md` "Copy rules": Turkish sentences, technical terms and proofline's own names in English.
- No new dependency.

## Risks

- PRD AC-1 asks for 0 lists of gates while the design shows a legend of the five gates inside the diagram frame; AC-4 reads the legend as part of the drawing's text alternative. The PRD wording should be confirmed by the product owner.
- The first-screen claim is untested with real developers until TASK-045; a no-go reopens this page.
- The real-output excerpt text and caption come from the pinned workflow page; if the pin moves to a version whose excerpt differs in length, the first screen is unchanged but the lower section grows.
- Two scripts (controls and JSON-LD) are on the page; the later script gate (TASK-030) must allow the JSON-LD data block.

## Pre-existing defects

none

## Suggested class

COMPLEX - two or more modules (two pages, four components, content files, pin facts, translation index) and a design choice about composing the first screen

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`
- `npm run test:browser`

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-019 -->
- run: TASK-019
- type: feature
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-23T12:37:53Z
- runtime: claude
- session: 8303465e-75e9-456e-b28c-83159dca7957
- estimate: size L
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-019 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-019 -->
# Completion Report: TASK-019

<!-- proofline:summary:begin -->
Changed: the English and Turkish home pages (hero, three steps, real output excerpt, pipeline diagram, limits) with their content files, helper, styles and tests, plus the type-scale and selection fixes in the design base.
Verify: `npm run build && npm test`
<!-- proofline:summary:end -->

## Implementation Summary

The home page exists in English and Turkish: `src/content/pages/en/home.md` and `tr/home.md` hold the text, `src/lib/home.ts` reads and checks it, and the `Home`, `Hero`, `Steps`, `RealOutput` and `Limits` components plus `PipelineDiagram` (now with an accessible section name) build the page, styled by `src/styles/home.css`. The real output excerpt is composed from the pinned facts; links to pages that do not exist yet are not printed.

Two amendments were applied. Amendment 001 added `PipelineDiagram.astro` to the scope so the diagram section has an accessible name. Amendment 002 added `src/styles/base.css` after the user decided the design base is fixed in this task: phone body text is at least 16 px, the headline step is 28 to 52 px, and the selection colour and the scrollbar follow both themes. A fifth rule keeps selected diagram labels readable (`.pipeline text::selection`), found by the rules review.

## TDD Evidence

Worker evidence holds RED then GREEN per scope path with the plan commands and full test titles (see the Facts block). The last fix round recorded RED and GREEN for the selection rule and for the empty-value cases of `readHomeContent`.

## Verification

All plan commands passed on the final tree in the verifier's own evidence worktree: tests, build with the guards, determinism check, link check and the accessibility check. Every acceptance criterion AC-1 to AC-15 maps to a passing test named in the plan. The text of the Turkish caption and the docs sentence on the Turkish page was written by the implementer and is a human check (QA-2 records it); the links are not printed until the pairs are registered (AS-1).

## Assumptions

- AS-1 (low): the links to pages that do not exist yet are printed only when their page pair is registered — unverified
- AS-2 (low): the AC-4 list count is taken over the main element — unverified
- AS-3 (low): the AC-4 name scan skips the product name and the excerpt — unverified
- AS-4 (low): the AC-9 numeral scan skips command blocks and the excerpt — unverified
- AS-5 (low): the AC-12 language check covers the main element — unverified
- AS-6 (low): the caption omits the run details of the sample — unverified
- AS-7 (low): the excerpt shows its markdown markers as written — unverified
- AS-8 (medium): one stylesheet link per page when Base imports the extra CSS files — unverified

## Review Result

- REVIEW_PLAN: pass; REVIEW_PLAN-1 info, the fifth `base.css` rule is requested behaviour because it fixes a defect of the new selection rule.
- REVIEW_RULES: pass after one fix round; REVIEW_RULES-1 was blocking (selected diagram labels were ink on ink) and is fixed and re-reviewed.
- REVIEW_TESTS: pass; earlier hollow findings (README command call sites, column spans, empty-value checks of `readHomeContent`) were strengthened and re-mutated.
- SECURITY: pass, no findings.
- Fix rounds: see the Facts block.

## QA Result

QA gate: waived by the user for the listed rows; all frozen scenarios passed. Findings of QA, as rows: QA-1 info, QA-2 info, QA-3 info, QA-10 info, QA-11 info (judged items and the two human checks), and QA-4, QA-5, QA-6, QA-7, QA-8, QA-9 blocking and waived (below). The QA design-group focus is waived with the same rows.
- VERIFY: pass; VERIFY-1 info and VERIFY-2 info named design-document lines that the knowledge step then updated.

## Unsupported Checks

none

## Waivers

| Finding | Gate | Reason | Approval |
|---|---|---|---|
| QA-4 | QA | headline to body ratio 1.95 at 390 px on the English page (rule design_type_scale, row D-29); the user chose option A, the two-line headline stays at 31.2 px; fails identically on the base | user, approve qa-4 |
| QA-5 | QA | same rule on the Turkish page (row D-68) | user, approve qa-5 |
| QA-6 | QA | copy button hidden without the controls script as AC-14 requires (row D-84) | user, approve qa-6 |
| QA-7 | QA | same rule, English page (row D-87) | user, approve qa-7 |
| QA-8 | QA | same rule, Turkish page (row D-92) | user, approve qa-8 |
| QA-9 | QA | same rule, Turkish page (row D-95) | user, approve qa-9 |

QA-11 of an earlier gate record was waived by the user earlier (approve qa-11) for the same copy-button rule and is recorded as an approved known issue for the batch.

NOT_RERUN lines:

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)

## Execution

Generated from the decision records by `agent.sh report-execution TASK-019` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| architect | - | claude | opus | high | none | agent path |
| designer | - | claude | sonnet | medium | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | sonnet | high | none | agent path |
| implementer | - | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | plan | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff,recent_fail_same_focus | agent path |
| architect | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff,recent_fail_same_focus | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff,recent_fail_same_focus | agent path |
| verifier | - | claude | sonnet | medium | large_diff | agent path |

## Amendments

- 001-pipeline-section-name: scope path `PipelineDiagram.astro` added so the diagram section has an accessible name (scope approved by the user).
- 002-design-base-fix: scope path `src/styles/base.css` added for the type scale and the selection and scrollbar colours (scope approved by the user).

## Reopen History

none

## Known Limitations / Follow-up

- The headline drops from 52 px at 820 px to about 40 px at 821 px when the layout goes to two columns; accepted in amendment 002.
- `docs/design/DESIGN-docs.md` names a different selection and scrollbar for the docs surface; the docs task has to reconcile it.
- The selection fix was proven in one engine only; others were not run.
- A line of the limits sentence can hold more than 75 characters at some widths; not new in this task.

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 22)
- Gate REVIEW_PLAN: ran on the final tree: pass (gate REVIEW_PLAN, record 23)
- Gate REVIEW_RULES: ran on the final tree: pass (gate REVIEW_RULES, record 25)
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 28)
- Gate SECURITY: ran on the final tree: pass (gate SECURITY, record 24)
- Gate QA: ran on the final tree: pass (gate QA, record 26)
- Visual/browser check: failed on the final tree and was waived by the user (visual/browser check, gate QA:visual, record 27)
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 29)

Final message line (paste it unchanged): Verification claims (from the ledger): 7 of 7 gates hold a record for the final tree; visual/browser check: failed on the final tree and was waived by the user (gate QA:visual, record 27).
Claims-hash: 65a78e2ab60af56b48d0a80363cb979899cfcc828b845ae58ba826bd5cfef2fa
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-019` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: COMPLEX
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: REVIEW_PLAN-1
- Gate REVIEW_RULES: pass; findings: REVIEW_RULES-1
- Gate REVIEW_TESTS: pass; findings: none
- Gate SECURITY: pass; findings: none
- Gate QA: waived; findings: QA-1 QA-2 QA-3 QA-4 QA-5 QA-6 QA-7 QA-8
  - Focus QA:visual: waived; findings: QA-1 QA-10 QA-11 QA-2 QA-3 QA-4 QA-5 QA-6 QA-7 QA-8 QA-9
- Gate VERIFY: pass; findings: VERIFY-1 VERIFY-2
- Friction notes recorded (A200): proofline_bug 0, user-command 0, user-shell 0
- Knowledge step: KNOWLEDGE_DONE
- Fix rounds: 1 of 2
- Refreezes: 2
- Files changed (task-owned paths): 21
- Worker-evidence run records: total 27, ended pass 12, ended fail 15 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-019 -->
