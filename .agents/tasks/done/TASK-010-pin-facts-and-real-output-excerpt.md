# Task: TASK-010 - Pin facts and real-output excerpt

**Status:** done

---
origin: prd:site
type: feature
size: M
depends_on:
  - TASK-007
prd: site
---

## Goal

One module reads the facts the site pages state about proofline from the pinned documents (the version and the date of the figures, the "does not prove" anchor, the README Status sentences, the README install commands, and the "Real output" excerpt) and fails the build, naming the page and the pattern, when a sentence, a figure or a heading is missing, so no page ever carries a hand-typed copy of them.

## Context

- Source requirements in `/docs/product/site/PRD.md`: NFR-4 (the build fails on a sentence, a figure or a heading that the trust page or the Claude Code and Codex page reads from the pinned commit and does not find, naming the page and the pattern), FR-7 and FR-8 (the data part only: the pinned version, the figures date, the link target of "does not prove", the not-yet-proven sentence and the Codex limit sentence; the pages that show them are TASK-022 and TASK-023), and the user story AC-8 (version and figures date generated from the synced proof page at the pinned commit).
- ADR `/docs/adr/0003-document-sync-pin-lock-and-sync-workflow.md` point 7 (the patterns, the Status sentences, the Install range, the Codex sentence, the version never read from the README because it states two) and `/docs/design/DESIGN-marketing.md` section "Real output as the visual material". Architecture component C17 and the boundary row C17-C19 in `/docs/design/ARCHITECTURE.md`.
- Inputs: the cache `.cache/sync/{commit}/` of TASK-007 (the synced files and `README.md`, which the lock lists as a read-only input) and `sync/pin.json`.
- Output contract (architecture boundary C17-C19): `{version, figures_date, does_not_prove_id, not_proven_sentence, codex_sentence, readme_commands[], readme_inline_spans[], commit, tag, real_output}`.
- Patterns (ADR 0003 point 7): in the whitespace-collapsed first paragraph of `docs/proof.md`, `Figures\s+were\s+taken\s+on\s+(\d{4}-\d{2}-\d{2})\s+at\s+proofline\s+(\d+\.\d+\.\d+)`; the H2 `What this does not prove` with its github-slugger id; in `README.md` section `## Status`, the sentence `It is not yet proven on real projects.` and the pattern `Codex as implementer is supported \([^)]*\); other Codex roles are not yet verified in real use\.`; the README range from the heading `## Install` to the heading `## What it supports`.
- The real-output source (`docs/concepts/workflow.md`, heading `## Real output`, anchor `real-output`) is one fenced `text` block holding the lead's final message. The approved sample shows the opening paragraph, the paragraphs that start `**Cause:**`, `**Tests:**` and `**Review:**`, and the list item that starts `**Commit:**`; the other parts are left out and the caption says so.
- Expected scope (3 paths): `scripts/lib/pin-facts.mjs`, `tests/pin-facts.test.mjs`, `tests/fixtures/pin-facts/` (fixture `README.md`, `docs/proof.md` and `docs/concepts/workflow.md`).
- Assumption: in the README range a line that starts with `#` after trimming is a shell comment and is not a command; every other non-empty line of every fenced block is a command line. After trimming white space and removing a trailing comment that starts with " #", the line is added to `readme_commands` in document order (the rule of FR-4, applied here to the README side only).
- Assumption: `readme_inline_spans` holds the text of every inline code span of the prose in the same range, without the backticks, in document order (FR-4 compares the get-started page's marked command spans with it).
- Assumption: `real_output` holds the five selected items as unedited Markdown text, in source order, with a label for each (`opening`, `cause`, `tests`, `review`, `commit`), plus the anchor `real-output`; the caption and the link are TASK-019's.

## Acceptance criteria

- AC-1: A fixture `docs/proof.md` whose first paragraph reads "Figures were taken on 2026-11-19 at proofline 0.0.171 (`main` at 9790c3ed)" across two lines is read, together with a fixture README that states two different Version lines -> `figures_date` equals `2026-11-19` and `version` equals `0.0.171`, and neither value comes from the README.
  Satisfies: AC-8.
  Covers: NFR-4, FR-7
- AC-2: The fixture `docs/proof.md` loses the sentence, or states the date in another form -> the module throws, the build exits non-zero, and the message holds the page `docs/proof.md` and the pattern text.
  Satisfies: AC-8.
  Covers: NFR-4, FR-7
- AC-3: A fixture `docs/proof.md` holds the heading `## What this does not prove` -> `does_not_prove_id` equals `what-this-does-not-prove`; with the heading missing or reworded the build exits non-zero naming `docs/proof.md` and the heading text.
  Satisfies: AC-8.
  Covers: NFR-4, FR-7
- AC-4: A fixture README `## Status` section holds the sentence "It is not yet proven on real projects." -> `not_proven_sentence` equals that sentence; with the sentence reworded ("It is not proven yet on real projects.") the build exits non-zero naming `README.md` and the pattern.
  Satisfies: AC-8.
  Covers: NFR-4, FR-7
- AC-5: A fixture README `## Status` section holds "Codex as implementer is supported (real use, 2026-10-23 to 25); other Codex roles are not yet verified in real use." -> `codex_sentence` equals that whole sentence; with the sentence missing or its second half reworded the build exits non-zero naming `README.md` and the pattern.
  Covers: NFR-4, FR-8
- AC-6: A fixture README holds a fenced block between `## Install` and `## What it supports` with the lines `/plugin marketplace add furkansarikaya/proofline # add the marketplace`, an empty line and `# a comment line`, and a second fenced block in the section `## Quick start` -> `readme_commands` holds `/plugin marketplace add furkansarikaya/proofline` and no line from the second block, the empty line or the comment line.
  Covers: NFR-4
- AC-7: The same README holds the inline code span `npx skills add furkansarikaya/proofline` in the prose between the two headings and another span outside them -> `readme_inline_spans` holds the first span's text without backticks and not the second.
  Covers: NFR-4
- AC-8: A fixture README lacks the heading `## Install`, and another lacks `## What it supports` -> each build exits non-zero naming `README.md` and the missing heading.
  Covers: NFR-4
- AC-9: A fixture `docs/concepts/workflow.md` holds `## Real output` with a `text` block that has the opening paragraph, the `**Cause:**` paragraph, one more labelled paragraph, the `**Tests:**` and `**Review:**` paragraphs, and a `**Not done:**` list with a `**Commit:**` item -> `real_output` holds exactly the five selected items in source order, each equal to its source text byte for byte, and holds neither the extra labelled paragraph nor the other list items.
  Covers: NFR-4
- AC-10: The fixture lacks the `## Real output` heading, or lacks one of the five items -> the build exits non-zero naming `docs/concepts/workflow.md` and the missing item or heading.
  Covers: NFR-4
- AC-11: The module is called with a pin file and the cache -> the output holds `commit` and `tag` equal to the values of `sync/pin.json`, and two calls on the same cache return values that are equal key for key.
  Covers: FR-7
- AC-12: At delivery, with network access and the cache of the launch pin, the module runs on the real pinned files -> it returns the facts without an error, and its `version` and `figures_date` equal what the pinned `docs/proof.md` states (the delivery report quotes both).
  Satisfies: AC-8.
  Covers: NFR-4, FR-7
- AC-13: Failure criterion (anti-goal): the task is not done if any fact is read from the README's Version lines, if a missing sentence, figure or heading is replaced by a default value or only warns, or if the module returns a sentence written in the module's own source instead of the pinned text, even when the fixtures pass.

## Out of scope

- The trust page, the Claude Code and Codex page and the home page that show these facts (TASK-022, TASK-023, TASK-019); the Turkish translations of the two sentences.
- Comparing the get-started page's commands with `readme_commands` and the install-time guard (TASK-020).
- Fetching and verifying the archive (TASK-007) and rendering Markdown (TASK-008).
- The README change that removes "(5 minutes)" and the second Version line (upstream, TASK-043).

## Constraints

- ADR 0003 point 7: the version is read from `docs/proof.md` only; the sentences are matched on whitespace-collapsed plain text; a missing item fails the build and names the page and the pattern.
- ADR 0001: plain `.mjs`; Markdown is read with the pipeline of TASK-008 or plain text matching, and no dependency is added.
- Expected test exception: none; the live run of AC-12 is a delivery check, the unit tests use fixtures and make no network request.

## Risks

- An upstream rewording of a guarded sentence keeps every later sync red; this is intended (NFR-4, ADR 0003 consequences) and the message must be precise enough to file upstream.
- The candidate pin's README has two Version lines in Status and in Versioning and license; the module must not read either.
- The excerpt rule (five items by their bold labels) rests on the layout of one upstream section; a layout change upstream fails the build rather than changing the excerpt.

## Pre-existing defects

none

## Suggested class

COMPLEX - a data contract between the sync core and several pages (C17 to C19) with build-failing guards over external text

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-010 -->
- run: TASK-010
- type: feature
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-22T22:05:25Z
- runtime: claude
- session: 539cc842-8fd6-4aa6-9892-b38539b7c09f
- estimate: size M
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-010 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-010 -->
# Completion Report: TASK-010

<!-- proofline:summary:begin -->
Changed: one module now reads the pinned facts (version, figures date, does-not-prove anchor, README Status sentences, install commands, real-output excerpt) and fails with the page and the pattern when one is missing.
Verify: `npm test`
<!-- proofline:summary:end -->

## Implementation Summary

- Delivery: nothing is committed; commit and push each need the user's explicit approval (`commit`, `push`)
- Task: TASK-010 — Pin facts and real-output excerpt; class COMPLEX; tier full; branch `proofline/TASK-010-pin-facts-and-real-output-excerpt`
- Changed: scripts/lib/pin-facts.mjs (AC-1 to AC-13), tests/pin-facts.test.mjs (AC-1 to AC-11, AC-13), tests/fixtures/pin-facts/README.md, tests/fixtures/pin-facts/docs/proof.md and tests/fixtures/pin-facts/docs/concepts/workflow.md (fixture data).
- Knowledge step: the C17 row and the C17 to C19 boundary row of docs/design/ARCHITECTURE.md now name the Real output excerpt and the tenth key real_output, and the build-order sentence says the pages call the module inside the site build.

## TDD Evidence

| path | RED | GREEN/FIX | owner |
|---|---|---|---|
| scripts/lib/pin-facts.mjs, tests/pin-facts.test.mjs | tests fail on assertions against a stub module and against single-rule mutants of the module | `npm test` passes | implementer |
| tests/fixtures/pin-facts/README.md | exempt (fixture markdown read by tests/pin-facts.test.mjs) | `npm test` passes | implementer |
| tests/fixtures/pin-facts/docs/proof.md | exempt (fixture markdown read by tests/pin-facts.test.mjs) | `npm test` passes | implementer |
| tests/fixtures/pin-facts/docs/concepts/workflow.md | exempt (fixture markdown read by tests/pin-facts.test.mjs) | `npm test` passes | implementer |

## Verification

- VERIFY: PASS (high); commands: `npm ci`, `npm test`, `npm run build`, `npm run check:determinism`, `npm run check:links`

## Assumptions

- AS-3 (low): at the real pin the README Quick start section lies between Install and What it supports, so its fenced commands enter readme_commands under the task range rule — unverified (the evidence register read it from the cached pinned README of the main checkout, which this worktree does not hold; the architect and QA read it there again)

## Review Result

| gate | status | confidence | fix round | findings |
|---|---|---|---|---|
| SECRETS | pass | high | 1 | none |
| REVIEW_PLAN | pass | high | 1 | none |
| REVIEW_RULES | pass | high | 1 | REVIEW_RULES-1 REVIEW_RULES-2 REVIEW_RULES-3 |
| REVIEW_TESTS | pass | medium | 1 | REVIEW_TESTS-1 REVIEW_TESTS-2 REVIEW_TESTS-3 |
| SECURITY | pass | high | 1 | SECURITY-1 |
| QA | pass | high | 1 | none |
| VERIFY | pass | high | 1 | none |

Fix rounds used: 1 of 2 (the numbers of the Facts block).

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)

Findings by id (all info):

- REVIEW_RULES: REVIEW_RULES-1 info the removed dead condition changes no result (equivalence shown on 30000 random blocks). REVIEW_RULES-2 info a byte order mark is written as a literal character in the module and in the test file. REVIEW_RULES-3 info the top-level commit key and real_output.commit share a name, and TASK-019 reads both.
- REVIEW_TESTS: REVIEW_TESTS-1 info the direct-run test and REVIEW_TESTS-2 info the missing-figures test are slower than the file median because each starts a child process. REVIEW_TESTS-3 info the control plane's measurement row covers only part of the tests while every plan-named test has a recorded duration.
- SECURITY: SECURITY-1 info two patterns get slow on very long hostile lines of the pinned text (about 2.4 s for 40000 spaces); the only source is the pinned upstream commit and the worst case is a slow build.

## Unsupported Checks

- REVIEW_RULES:contract: no contract file in a format the differ reads (the contract is an in-process object); not proven: a mechanical compatibility check of the ten keys against the consumers, which was traced by hand instead.

## QA Result

QA: PASS (high); scenarios 30/30.

## Waivers

None.

## Reopen History

The run ended FAILED after two fix rounds on surviving test mutants. The user approved the reopen and asked for every parsing rule of readReadme and readRealOutput to be covered by its own test and for the test review to try all reachable mutants of both functions; the mutation budget was raised to 40 within the batch cap. Fix rounds restarted at 0 and one round closed the 25 surviving mutants with rule tables; the full scan then killed all 40 mutants it ran.

## Execution

Generated from the decision records by `agent.sh report-execution TASK-010` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| explorer | - | claude | sonnet | medium | none | agent path |
| architect | - | claude | opus | high | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | sonnet | high | none | agent path |
| reviewer | plan | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | rules | claude | opus | high | large_diff | escalated (ESCALATED_MODEL); agent path |
| reviewer | contract | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | contract | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| verifier | - | claude | sonnet | medium | large_diff | agent path |
| implementer | - | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | plan | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | rules | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | contract | claude | sonnet | high | large_diff,fix_round_2 | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,fix_round_2,recent_fail_same_focus | agent path |
| security_reviewer | - | claude | opus | high | large_diff,fix_round_2 | agent path |
| implementer | - | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| reviewer | plan | claude | sonnet | high | large_diff | agent path |
| reviewer | rules | claude | sonnet | high | large_diff | agent path |
| reviewer | contract | claude | sonnet | high | large_diff | agent path |
| reviewer | tests | claude | sonnet | high | large_diff,recent_fail_same_focus | agent path |
| security_reviewer | - | claude | opus | high | large_diff | agent path |
| qa | - | claude | sonnet | medium | large_diff | agent path |
| verifier | - | claude | sonnet | medium | large_diff | agent path |

## Known Limitations / Follow-up

- `npm run build` does not call the module yet; the failure on a missing fact shows through the module's direct run (exit 1) until TASK-019, TASK-022 and TASK-023 import it.
- At the real pin the README Quick start section lies inside the Install range, so readme_commands also holds the Quick start commands and readme_inline_spans holds repeated spans; TASK-020 must expect that.
- TASK-019 must use real_output.commit as returned (the list marker is removed).
- Four mutants of the implementer's own scan stay alive because they change no behaviour; the test review did not run model, slugs, sectionEnd and codeSpans mutants in its last round.

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 22)
- Gate REVIEW_PLAN: ran on the final tree: pass (gate REVIEW_PLAN, record 23)
- Gate REVIEW_RULES: ran on the final tree: pass (gate REVIEW_RULES, record 26)
- Check REVIEW_RULES:contract: unsupported: it could not run here (focus REVIEW_RULES:contract, record 24); nothing is claimed
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 29)
- Gate SECURITY: ran on the final tree: pass (gate SECURITY, record 25)
- Gate QA: ran on the final tree: pass (gate QA, record 28)
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 27)
- Visual/browser check: not part of this run (no QA:visual gate); no visual, browser or screenshot check is claimed

Final message line (paste it unchanged): Verification claims (from the ledger): 7 of 7 gates hold a record for the final tree; visual/browser check: not part of this run (no QA:visual gate); no visual, browser or screenshot check is claimed.
Claims-hash: a030b5d24a9108d31c9d68fff4f39cf27dbb5f2d49efe4fd32e527e9f7bc0a79
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-010` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: COMPLEX
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: none
- Gate REVIEW_RULES: pass (unsupported: contract); findings: REVIEW_RULES-1 REVIEW_RULES-2
  - Focus REVIEW_RULES:contract: unsupported; findings: REVIEW_RULES-1 REVIEW_RULES-2 REVIEW_RULES-3
- Gate REVIEW_TESTS: pass; findings: REVIEW_TESTS-1 REVIEW_TESTS-2 REVIEW_TESTS-3
- Gate SECURITY: pass; findings: SECURITY-1
- Gate QA: pass; findings: none
- Gate VERIFY: pass; findings: none
- Friction notes recorded (A200): proofline_bug 0, user-command 0, user-shell 0
- Knowledge step: KNOWLEDGE_DONE
- Fix rounds: 1 of 2
- Refreezes: 0
- Files changed (task-owned paths): 5
- Worker-evidence run records: total 56, ended pass 29, ended fail 27 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-010 -->
