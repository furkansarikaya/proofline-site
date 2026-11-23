# Task: TASK-021 - Get-started page in English and Turkish

**Status:** done

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

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-021 -->
- run: TASK-021
- type: feature
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-23T17:36:43Z
- runtime: claude
- session: 8303465e-75e9-456e-b28c-83159dca7957
- estimate: size M
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-021 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-021 -->
# Completion Report: TASK-021

<!-- proofline:summary:begin -->
Changed: the English and Turkish get-started pages with hand-written command blocks checked against the README range, their content files, helper, component, stylesheet and tests, and the pair registered so the menu, language link and hreflang appear.
Verify: `npm run build && npm test`
<!-- proofline:summary:end -->

## Implementation Summary

The pages `/get-started/` and `/tr/baslarken/` exist. Two content files (`src/content/pages/en/get-started.md` and `tr/baslarken.md`) hold the text; `src/lib/get-started.ts` reads and checks the content and holds the command lines (the two plugin lines, the two Codex lines, the five first-task commands and the skills-only span with its trailing name placeholder), which are compared with the README range of the pin facts before the page is built. `GetStarted.astro` builds three plain framed command blocks (English, not translated, no copy button) and the measured-scope sentence; `src/styles/get-started.css` styles them and wraps the blocks at every width. The pair is registered in `src/lib/translations.ts`, so the menu entry, the language link, the hreflang alternates and the note link on the home pages appear. No install time is stated anywhere.

Two amendments were applied. Amendment 001 added three existing test files (`tests/site.test.mjs`, `tests/indexing.test.mjs`, `tests/design.test.mjs`) because several existing tests asserted the old three-page set, the no-script rule and the no-external-host rule; the plan had wrongly expected them to adapt by themselves. Amendment 002 stated the wrapping criterion in the plan and started a fresh fix budget (user budget approval) after fix rounds were exhausted on a hollow wrapping test.

## TDD Evidence

Worker evidence holds RED then GREEN per scope path with the plan commands. Fix rounds added tests for the wrapping rule (every rule that reaches a command block, every size property and unit family that can exceed the column, container-query units read like viewport units), for every prop of both page files, and for the content helper rules.

## Verification

All plan commands passed on the final tree in the verifier's own evidence worktree: tests, build with the guards (5 pages, 2 get-started, 0 failures), determinism check, link check and the accessibility check. Every acceptance criterion AC-1 to AC-10 maps to a passing named test. The Turkish prose and the Turkish measured-scope sentence were written by the implementer and are human checks (see the QA report).

## Assumptions

- AS-1 (low): the Turkish wording of the measured-scope sentence is chosen by the plan and contains the three phrases named in the task — unverified
- AS-2 (medium): the build in the worktree reads the pinned documents from the cache or fetches them; build tests use the fixture cache — unverified

## Review Result

- REVIEW_PLAN: pass.
- REVIEW_RULES: pass; the first run failed on a blocking layout bug (command blocks scrolled sideways between about 821 and 1100 px) that the fix rounds closed; REVIEW_RULES-1, REVIEW_RULES-2 and REVIEW_RULES-3 are info rows (a test hook that fetches the pinned cache like four other tests, the budget reading of the determinism command, a pre-existing clock line).
- REVIEW_TESTS: pass after hollow-test findings (page props, the wrapping rule, fixed sizes, container-query units, a budget reading) were fixed in rounds; REVIEW_TESTS-1, REVIEW_TESTS-2, REVIEW_TESTS-3 and REVIEW_TESTS-4 are info rows (an unasserted note paragraph, overflow through properties outside the plan wording, reader expectations, a clock candidate).
- SECURITY: pass; SECURITY-1 is an info row carried over (the clone-line allowance in the host scan test is narrow and not exploitable).
- Fix rounds: see the Facts block.

## QA Result

QA gate: waived by the user for the three design rows; all frozen scenarios (QA-1 to QA-48 of the QA plan) passed in the QA run. Findings of QA: QA-1 blocking waived (nothing drawn in the first screen), QA-2 blocking waived (nothing animates), QA-3 blocking waived (headline ratio at 390 px, the same value as the home pages). The design group focus is waived with the same rows.
- VERIFY: pass; VERIFY-1, VERIFY-2 and VERIFY-3 info rows named design-document lines that the knowledge step then updated (the component table of the design document and the architecture row; VERIFY-2 named a line about another page and needed no change).

## Unsupported Checks

none

## Waivers

| Finding | Gate | Reason | Approval |
|---|---|---|---|
| QA-1 | QA | the page is plain text by design (the design document says this page is not drawn), so the first screen holds no drawing; the home page has the pipeline drawing | user, approve qa-1 |
| QA-2 | QA | no animated element by design; the home page has the drawing motion | user, approve qa-2 |
| QA-3 | QA | headline to body ratio 1.95 at 390 px, same value as the home pages and the base revision (user option A) | user, approve qa-3 |

NOT_RERUN lines:

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)

## Execution

Generated from the decision records by `agent.sh report-execution TASK-021` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | sonnet | high | none | agent path |
| qa | - | claude | opus | medium | large_diff | escalated (ESCALATED_MODEL); agent path |
| implementer | - | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| implementer | - | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| qa | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |
| qa | visual | claude | sonnet | medium | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| implementer | - | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff,recent_fail_same_focus | agent path |
| qa | visual | claude | sonnet | medium | large_diff,recent_fail_same_focus | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff,recent_fail_same_focus | agent path |
| verifier | - | claude | sonnet | medium | large_diff | agent path |

## Amendments

- 001-page-list-tests: scope paths `tests/site.test.mjs`, `tests/indexing.test.mjs`, `tests/design.test.mjs` added (scope approved by the user).
- 002-width-rule-and-budget: the wrapping criterion stated in the plan; new fix budget (budget approved by the user).

## Reopen History

none

## Known Limitations / Follow-up

- `tests/axe.mjs` scans only the two home pages, so the get-started pages have no automated accessibility scan in `npm test`; the gates scanned them separately.
- `.home-call` in `src/styles/home.css` has the same overflow between about 900 and 1000 px that the get-started blocks no longer have; not part of this task.
- The wrapping test reads size properties only; overflow through margins, transforms or positioning is not covered (outside the plan wording).

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 26)
- Gate REVIEW_PLAN: ran on an EARLIER tree (gate REVIEW_PLAN, record 20; fix rounds used in the run: 1, as in the Facts block); it is not a check of the final tree
- Gate REVIEW_RULES: ran on an EARLIER tree (gate REVIEW_RULES, record 21; fix rounds used in the run: 1, as in the Facts block); it is not a check of the final tree
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 29)
- Gate SECURITY: ran on an EARLIER tree (gate SECURITY, record 22; fix rounds used in the run: 1, as in the Facts block); it is not a check of the final tree
- Gate QA: ran on the final tree: pass (gate QA, record 28)
- Visual/browser check: failed on the final tree and was waived by the user (visual/browser check, gate QA:visual, record 27)
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 30)

Final message line (paste it unchanged): Verification claims (from the ledger): 4 of 7 gates hold a record for the final tree; not on the final tree: REVIEW_PLAN (earlier tree), REVIEW_RULES (earlier tree), SECURITY (earlier tree); visual/browser check: failed on the final tree and was waived by the user (gate QA:visual, record 27).
Claims-hash: 6943d2a9d7b7d763f165a7780fbabef36ca19e52614c82d1f9bd1e4f97b6939b
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-021` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: STANDARD
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: none
- Gate REVIEW_RULES: pass; findings: REVIEW_RULES-1 REVIEW_RULES-2 REVIEW_RULES-3
- Gate REVIEW_TESTS: pass; findings: REVIEW_TESTS-1 REVIEW_TESTS-2 REVIEW_TESTS-3 REVIEW_TESTS-4
- Gate SECURITY: pass; findings: SECURITY-1
- Gate QA: waived; findings: QA-1 QA-2 QA-3
  - Focus QA:visual: waived; findings: QA-1 QA-2 QA-3
- Gate VERIFY: pass; findings: VERIFY-1 VERIFY-2 VERIFY-3
- Friction notes recorded (A200): proofline_bug 0, user-command 0, user-shell 0
- Knowledge step: KNOWLEDGE_DONE
- Fix rounds: 1 of 2
- Refreezes: 2
- Files changed (task-owned paths): 15
- Worker-evidence run records: total 63, ended pass 54, ended fail 9 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-021 -->
