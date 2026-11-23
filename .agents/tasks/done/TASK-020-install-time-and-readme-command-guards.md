# Task: TASK-020 - Install-time and README command guards

**Status:** done

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-010
prd: site

---

## Goal

The build fails, naming the page and the line, when a command on the get-started page does not appear in the README of the pinned commit, and when a page written for the site states an install time while the first-time installation probe PB-3 has no `confirmed` result.

## Context

Source: the product owner's split of the PRD `site` (2026-11-20). PRD ids: FR-4, FR-5, FR-6 (the guard part), NFR-4, AC-3, AC-4, AC-36.

- PRD: FR-4 (command lines compared after trimming white space and removing a trailing comment that starts with " #" on both sides; the lines come from the fenced blocks between the heading "Install" and the heading "What it supports" of the README at the pin; an inline code span that starts with a command is compared with the inline spans of the same range; the blocks of `docs/guides/existing-project.md` are not compared), FR-5, FR-6, AC-3, AC-4 (the two patterns, copied below) and NFR-4 (naming the page and the pattern).
- ADRs: `/docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` point 4 (the guards of AC-3 and AC-4 live in the dist checker `scripts/check-dist.mjs`), `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` (pin facts, the README range), `/docs/design/ARCHITECTURE.md` section "Trade-offs" (rows "Get-started command spans compared only when marked" and "AC-4 pattern as written (no word boundary)"). Design documents: none, this task has no user interface.
- Patterns of AC-4, case-insensitive, applied to the text of a page written for the site: `(?<![\w-])(five|5)[ -]?(minutes?|mins?)` and `(?<![\w-])(beş|5)[ -]?(dakika|dk)`. The look-behind keeps "15 minutes" and "twenty-five minutes" from matching.
- PB-3 lives in `docs/product/site/PROBES.md` as the list item `- PB-3 ...` followed by indented lines `success:`, `failure:`, `locked:` and, once run, `result:` with the value `confirmed`, `failed` or `inconclusive`. Today the PB-3 item has no `result:` line, while the PB-1 and PB-2 items have `result: confirmed`.
- Today: `scripts/check-dist.mjs` exists with the modes `determinism` and `links` (`package.json`); TASK-010 produces the pin facts `readme_commands[]` and `readme_inline_spans[]` (ARCHITECTURE boundary C17 to C19). The get-started page does not exist yet (TASK-021 writes it), so the guard must pass when no such page exists and must work on fixtures.
- Assumption: the guard reads the built HTML of `dist/` (ADR 0008 point 4); which pages are site-written and which are synced is decided by the plan (for example by a marker written by the page route), and the tests prove both classes.
- Assumption: an inline code span of the get-started page is compared only when it carries the attribute `data-command` (ARCHITECTURE: "compared only when marked"); an unmarked span is prose and is not compared.
- Assumption: the guard runs in `npm run build` after the Astro build step and is also callable as `node scripts/check-dist.mjs guards` followed by the path of a dist folder with options for fixture facts and a fixture PROBES file; an npm script `check:guards` is added.
- Expected scope: `scripts/lib/guards.mjs`, `scripts/check-dist.mjs` (the `guards` mode), `package.json` (scripts `build` and `check:guards`), `tests/guards.test.mjs`, `tests/fixtures/guards/` (small dist trees, facts and PROBES files). 5 paths.

## Acceptance criteria

- AC-1: A fixture get-started page holds a command line in a fenced block that is not among `readme_commands` -> the guard exits with a non-zero code and the message names the page address and the line text.
  PRD ids: AC-3
  Covers: FR-4, NFR-4
- AC-2: The same fixture page holds lines that differ from `readme_commands` only by leading or trailing white space or by a trailing comment starting with " #" (on either side) -> the guard exits 0.
  PRD ids: AC-3
  Covers: FR-4
- AC-3: A fixture command line appears in the README outside the range between "Install" and "What it supports" (for example in the "Commands" section) but not in `readme_commands` -> the guard fails on it, naming the page and the line.
  Covers: FR-4
- AC-4: A fixture get-started page holds an inline code span with `data-command` that starts with a command and is not in `readme_inline_spans` -> the guard fails naming the span; the same span without `data-command`, and a span that is in `readme_inline_spans`, pass.
  Covers: FR-4
- AC-5: A synced fixture page (a guide) holds a command line that is not in the README and the text "five minutes" -> the guard exits 0 for both (the guards read site-written pages only).
  Covers: FR-4
- AC-6: PROBES.md has no `result:` line in its PB-3 item, and a site-written fixture page holds each of "5 minutes", "five-minute", "5 mins", "beş dakika" and "5 dk" in turn -> the guard exits non-zero for each and names the page and the pattern; the texts "15 minutes", "twenty-five minutes" and "a few seconds" pass.
  PRD ids: AC-4
  Covers: FR-5, NFR-4
- AC-7: PROBES.md has the PB-3 item with `result: failed`, and then with `result: inconclusive`, and a site-written page holds "5 minutes" -> the guard fails each time; with `result: confirmed` in the PB-3 item the same page passes.
  PRD ids: AC-36
  Covers: FR-6
- AC-8: PROBES.md has `result: confirmed` in the PB-1 and PB-2 items only, and a site-written page holds "5 minutes" -> the guard fails (only the PB-3 item counts), and a PB-3 `result:` value spelled `Confirmed` or `confirmed?` does not count as `confirmed`.
  PRD ids: AC-36
  Covers: FR-6
- AC-9: The guard runs on the real `docs/product/site/PROBES.md` and on a built site that holds no install-time text and no get-started page -> it exits 0 and prints the PB-3 state (`PB-3: no result`) without failing.
  Covers: NFR-4
- AC-10: `npm run build` runs on a fixture site that holds a failing page -> it exits with a non-zero code after the Astro build step and the output names the page and the line or pattern.
  Covers: NFR-4
- AC-11: Failure criterion (anti-goal): the task is not done if the guard passes a command line that is absent from the README range because it is present in some other README section, if a synced page makes it fail, if `confirmed` in the PB-1 or PB-2 item lets an install time pass, or if it fails without naming the page, even when the fixtures for the passing cases are green.

## Out of scope

- The get-started page itself and its hand-written blocks (TASK-021), and the pin facts extraction (TASK-010).
- Running PB-3 and writing its result line (TASK-044, an owner step).
- The title rules, hreflang, sitemap and the other `check-dist` checks (TASK-029, TASK-030).
- The stale-Turkish-page warning and the sentence checks of the trust and Claude Code and Codex pages (NFR-4 parts handled by their own tasks).
- A proof that the sentences are true; the AC-4 pattern is a guard, not a proof (PRD AC-4).

## Constraints

- Expected test exception: none; guards over fixture trees have a RED.
- The two patterns of AC-4 are used exactly as the PRD writes them, including the look-behind; no word boundary is added (`/docs/design/ARCHITECTURE.md`, "Trade-offs").
- Plain `.mjs` and `node --test`, Node 24.x (ADR 0001); no new dependency (`cheerio` is already a development dependency of `package.json`).
- Tests use fixtures only; no network.

## Risks

- The pattern has false positives by design (PRD: it is a guard); a legitimate sentence such as "5 minutes of reading" on a site page blocks the build until reworded.
- "Site-written page" must be told from "synced page" in `dist/`; a wrong class either misses a claim or blocks a synced document that says "5 minutes".
- TASK-010 decides what the README range holds; an upstream change to the heading names makes the pin facts fail first (by design).
- `package.json` is edited by many tasks; a merge conflict on the `build` script is likely if tasks run in parallel.

## Pre-existing defects

none

## Suggested class

COMPLEX - two or more modules (guard library, dist checker, build script, tests) and a change to the build pipeline that decides whether a deployment can happen

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run check:guards`
- `npm run test:axe`

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-020 -->
- run: TASK-020
- type: feature
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-23T10:45:49Z
- runtime: claude
- session: 8303465e-75e9-456e-b28c-83159dca7957
- estimate: size M
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-020 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-020 -->
# Completion Report: TASK-020

<!-- proofline:summary:begin -->
Changed: the build now fails, naming the page and the line, when a get-started command is not in the README of the pinned commit or when a site-written page states an install time before the first-time installation probe is confirmed.
Verify: `npm test`
<!-- proofline:summary:end -->

## Implementation Summary

- Delivery: nothing is committed; commit and push each need the user's explicit approval (`commit`, `push`)
- Task: TASK-020 — Install-time and README command guards; class COMPLEX; tier full; branch `proofline/TASK-020-install-time-and-readme-command-guards`
- Changed: `scripts/lib/guards.mjs` (AC-1 to AC-9, AC-11), `scripts/check-dist.mjs` (AC-1, AC-9, AC-10), `package.json` (AC-10), `tests/guards.test.mjs` (AC-1 to AC-9, AC-11), `tests/sync.test.mjs` (AC-9, AC-10), and the fixture pages and PROBES file under `tests/fixtures/guards/` (AC-1 to AC-9)
- The guard tells a site-written page from a synced page by its address (a page under `/docs/` or `/tr/docs/` is synced, except the three index pages); no marker is written into the built pages and no `src/` file changed.
- The existing test that asserted the old `build` script text and ran the build in a temp project without the checker was in plan scope from the start and is amended.

## TDD Evidence

| path | RED | GREEN/FIX | owner |
|---|---|---|---|
| scripts/lib/guards.mjs, scripts/check-dist.mjs, package.json, tests/guards.test.mjs, tests/sync.test.mjs | `npm test` fails against a stub guard: the ten guard tests and the amended build-script test fail on assertions | `npm test` passes | implementer |
| tests/guards.test.mjs (defaults, duplicate option, bare pre, valued data-command attribute) | `npm test` fails with the five review mutants applied | `npm test` passes | implementer |
| tests/guards.test.mjs (comment line filter, option test split) | `npm test` fails with the comment-filter mutant applied | `npm test` passes | implementer |
| tests/fixtures/guards/ fixture files | tdd_exemption: fixture data read by the guard tests, no behaviour to test first | not applicable | implementer |

## Verification

- VERIFY: PASS (high); commands: `npm test`, `npm run build`, `npm run check:determinism`, `npm run check:links`, `npm run check:guards`, `npm run test:axe`

## Assumptions

- AS-1 (low): a site-written page is told from a synced page by the address rule, with no marker in the built HTML — unverified
- AS-2 (low): the real repository passes a guard run today — unverified (the shared build and the guard run on the real tree exit 0 and print `PB-3: no result`; the register row was not updated)
- AS-3 (low): the trailing comment is removed on both sides with the expression pin-facts uses — unverified

## Review Result

| gate | status | confidence | fix round | findings |
|---|---|---|---|---|
| SECRETS | pass | high | 2 | none |
| REVIEW_PLAN | pass | high | 2 | REVIEW_PLAN-1, REVIEW_PLAN-2, REVIEW_PLAN-3 |
| REVIEW_RULES | pass | high | 2 | REVIEW_RULES-1, REVIEW_RULES-2, REVIEW_RULES-3 |
| REVIEW_TESTS | pass | medium | 2 | none |
| SECURITY | pass | medium | 2 | none |
| QA | pass | high | 2 | QA-1, QA-2, QA-3, QA-4 |
| VERIFY | pass | high | 2 | none |

Fix rounds used: 2 of 2 (the numbers of the Facts block).

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- SECURITY:dependencies: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)
- QA:visual: not reproduced (NOT_RERUN)
- REVIEW_PLAN: REVIEW_PLAN-1 info the space-joined text form serves AC-6 and is not unrequested behaviour
- REVIEW_PLAN: REVIEW_PLAN-2 info a regular file given as the checked folder exits 1 with the no-HTML-page message, as the plan lists
- REVIEW_PLAN: REVIEW_PLAN-3 info the space-joined form also matches a pass text split by markup such as one digit in one element and another in a bold element; no page has such markup today
- REVIEW_RULES: REVIEW_RULES-1 info the install-time scan reads the title, the meta description and body text nodes only, not attribute text such as an image alternative text
- REVIEW_RULES: REVIEW_RULES-2 info a pre block that separates lines with line-break elements is read as one line and fails by naming it
- REVIEW_RULES: REVIEW_RULES-3 info the extra scan forms only add matches; the two AC-4 patterns equal the task text
- QA: QA-1 info text split across tags, adjacent paragraphs and a non-breaking space all match the patterns (undefined by the plan, observed)
- QA: QA-2 info a CRLF PROBES file with a confirmed PB-3 exits 0 (observed)
- QA: QA-3 info a page line with a comment but no white space before the hash does not equal the README line and exits 1 (observed)
- QA: QA-4 info an empty PROBES file with a clean site exits 0 with the state no item (observed)

## QA Result

QA: PASS (high); scenarios 37/37.

## Unsupported Checks

none

## Amendments

- 001-qa-plan-finalised-after-freeze.md: the QA plan file was finalised a few seconds after the first freeze, so the frozen QA plan hash was refrozen; no scope path, criterion or test title changed; plan approval covered by the batch approval.

## Reopen History

- The plan was refrozen once (amendment 001) because the QA plan file was finalised a few seconds after the first freeze, before any worker evidence existed; no scope, criterion or test title changed.

## Execution

Generated from the decision records by `agent.sh report-execution TASK-020` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| architect | - | claude | opus | high | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | sonnet | high | none | agent path |
| implementer | - | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | plan | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| security_reviewer | dependencies | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| qa | visual | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| qa | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |
| security_reviewer | - | claude | opus | high | large_diff,fix_round_2 | agent path |
| verifier | - | claude | sonnet | medium | large_diff,fix_round_2 | agent path |

## Known Limitations / Follow-up

- Three design rationales were approved for this run through the batch answer for the accept list: mono-labels, hairline-newspaper and numbered-steps.
- The AC-9 test expects `PB-3: no result` from the real PROBES file; TASK-044 must update that expectation when it writes the PB-3 result.
- The guard reads no attribute text and joins text pieces with and without a space; a pass text split by markup can be a false positive until reworded.
- When the search task adds `pagefind` to the `build` script it must go before the guard step and the exact build text in `tests/sync.test.mjs` must be updated.
- The mutation budget was spent before every rule of the comment line filter and the argument parser was mutated; the unmutated rules are covered by tests that were read, not proven by mutation.

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 11)
- Gate REVIEW_PLAN: ran on an EARLIER tree (gate REVIEW_PLAN, record 5; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate REVIEW_RULES: ran on an EARLIER tree (gate REVIEW_RULES, record 4; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 15)
- Gate SECURITY: ran on the final tree: pass (gate SECURITY, record 12)
- Check SECURITY:dependencies: ran on an EARLIER tree (focus SECURITY:dependencies, record 2; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate QA: ran on the final tree: pass (gate QA, record 14)
- Visual/browser check: ran on an EARLIER tree (visual/browser check, gate QA:visual, record 6; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 13)

Final message line (paste it unchanged): Verification claims (from the ledger): 5 of 7 gates hold a record for the final tree; not on the final tree: REVIEW_PLAN (earlier tree), REVIEW_RULES (earlier tree), SECURITY:dependencies (earlier tree), QA:visual (earlier tree); visual/browser check: ran on an EARLIER tree (gate QA:visual, record 6; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree.
Claims-hash: e811be43b23033e97c1024a0ddd4aa6f9cf11557ebdd43f5d66275745d5b294d
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-020` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: COMPLEX
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: REVIEW_PLAN-1 REVIEW_PLAN-2 REVIEW_PLAN-3
- Gate REVIEW_RULES: pass; findings: REVIEW_RULES-1 REVIEW_RULES-2 REVIEW_RULES-3
- Gate REVIEW_TESTS: pass; findings: none
- Gate SECURITY: pass; findings: none
  - Focus SECURITY:dependencies: pass; findings: none
- Gate QA: pass; findings: QA-1 QA-2 QA-3 QA-4
  - Focus QA:visual: pass; findings: QA-1
- Gate VERIFY: pass; findings: none
- Friction notes recorded (A200): proofline_bug 0, user-command 0, user-shell 0
- Knowledge step: not_applicable; not_applicable reason: batch default (A291): no knowledge page was written, the suggestion to the user is in the report
- Suggestion to the user (knowledge): TASK-020: no knowledge note was written and nothing was changed under docs/, in skills or in rules; PLAN.md lists a contract change; if you want it kept, write a wiki page or a design-document change yourself, or ask for a documentation task
- Fix rounds: 2 of 2
- Refreezes: 1
- Files changed (task-owned paths): 12
- Worker-evidence run records: total 6, ended pass 3, ended fail 3 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-020 -->
