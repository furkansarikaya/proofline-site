# Task: TASK-002 - CI and test hygiene: pinned actions, measured job timeout, no leftover temp directories

**Status:** done

---
type: chore
size: S
---

## Goal

The `ci` workflow uses only actions pinned to a commit hash, its `verify` job has a timeout set from measured run durations, and the test suites leave no `proofline-site-*` or `proofline-axe-*` temporary directories behind, also when a run is interrupted.

## Context

Request (user's words):

> 1 ve 3'ü tek bir task olarak yaz: CI ve test hijyeni (action'ları commit
> hash'iyle sabitle, işlere ölçülmüş zaman aşımı ekle, yarım kalan bir
> koşuda proofline-site-* geçici klasörleri kalmasın). 2 raporda kalsın.

- Source: the observations of the TASK-001 completion report (`.agents/tasks/done/TASK-001-astro-static-site-skeleton-with-bilingual.md`): the actions are pinned by major tag `@v7` and the job has no `timeout-minutes` (`.github/workflows/ci.yml:16`, `:18`); the test temporary directories are removed in `after` hooks (`tests/site.test.mjs:21`, `tests/axe.mjs:47`) and can survive an interrupted run.
- Observation 2 of that report (the `determinism` command deletes `node_modules/.astro` and `.astro`; a moved Astro `cacheDir` needs the clean list changed) stays in the report and is not part of this task.
- Measured durations (GitHub runs of the `ci` workflow on 2026-11-20): pull request run 44704593187, job 1 min 6 s (install step 40 s); push run 44704839510, 47 s. Two samples only.
- Decisions from the user's answers: the `verify` job timeout is 5 minutes; interrupted runs are cleaned by signal handling plus a sweep at the start of the next run (directories older than 1 hour); `proofline-axe-*` directories (`tests/axe.mjs:40`) are included with `proofline-site-*` (`tests/site.test.mjs:60`).
- Assumption: "the commit hash" of an action is the full 40-character commit SHA of the release tag of the version now in use, written with the tag in a comment on the same line.
- Assumption: both pinned actions keep the major version they have now (`@v7`); the pin resolves the newest `v7.x.y` release tag of each.
- Assumption: a process killed with SIGKILL (or a power loss) cannot clean up after itself; its directories are removed by the sweep of the next run.

## Acceptance criteria

- AC-1: Every `uses:` entry in every file under `.github/workflows/` names a 40-character commit SHA after `@`, and the same line ends with a comment holding the version tag (for example `# v7.1.0`); a test fails when any `uses:` entry names a tag, a branch or a short SHA.
- AC-2: For each pinned action, `git ls-remote --tags` on the action's GitHub repository returns the commented tag with the same commit SHA as the pin (checked once at delivery).
- AC-3: Job `verify` in `.github/workflows/ci.yml` has `timeout-minutes: 5`, and a comment next to it names the measured runs (44704593187 with 1 min 6 s and 44704839510 with 47 s); a test fails when the key is missing or not 5.
- AC-4: When `tests/site.test.mjs` is stopped with SIGINT or SIGTERM while its fixture directories exist, no `proofline-site-*` directory created by that run remains in the system temporary directory.
- AC-5: When `tests/axe.mjs` is stopped with SIGINT or SIGTERM while its fixture directory exists, no `proofline-axe-*` directory created by that run remains in the system temporary directory.
- AC-6: When a test in either file fails by an assertion or a thrown error, the directories that run created are removed as well.
- AC-7: At the start of a run of either file, `proofline-site-*` and `proofline-axe-*` directories in the system temporary directory that are older than 1 hour are removed; a directory of those names younger than 1 hour and a directory with any other name are left untouched.
- AC-8: The completion report states that a process killed with SIGKILL leaves its directories until the sweep of the next run (AC-7).
- AC-9: The workflow still has the name `ci`, the single job `verify`, the same step names in the same order, the top-level `permissions: contents: read` and the triggers `pull_request` and `push` to `main`, and `npm ci`, `npm test`, `npm run build`, `npm run check:determinism`, `npm run check:links` and `npm run test:axe` exit 0.
- AC-10: Failure criterion (anti-goal): the task is not done if any `uses:` entry is still on a tag, if `timeout-minutes` is missing from `verify`, if an interrupted run leaves a `proofline-site-*` or `proofline-axe-*` directory behind, or if the sweep removes a directory younger than 1 hour or one with another name, even when `ci / verify` is green.

## Out of scope

- Observation 2 of the TASK-001 report (the `determinism` clean list and Astro's `cacheDir`); it stays in the report.
- Automatic updating of pinned actions (Dependabot, Renovate or a script); pins are updated by hand in a later task.
- Moving the actions to a newer major version, changing the runner image, adding caching or step-level timeouts.
- Re-measuring the timeout over more runs; 5 minutes is the user's decision from two samples.
- Making `ci / verify` the required check on `main` (the owner's step) and any change to the check name.
- Fixture directories created by anything other than `tests/site.test.mjs` and `tests/axe.mjs`.

## Constraints

- The user chose a `verify` timeout of 5 minutes (answer of 2026-11-20 to the question on the timeout value).
- ADR 0008: `ci.yml` keeps a least-privilege top-level `permissions:` block (`contents: read`) and one job `verify`; the step names and their order (TASK-001 AC-10) stay.
- ADR 0001: plain `.mjs` scripts and `node --test`; Node 24.x; every dependency in `package.json` stays an exact version, and no dependency is added.
- The workflow check `scripts/check-workflows.mjs` and its tests keep passing.

## Risks

- Only two measured runs: a slow Chromium download could make 5 minutes a false red on the required check.
- A tag can be moved by its publisher; the commit SHA is what the pin is for, and AC-2 is checked once at delivery, not on every run.
- The start-of-run sweep deletes directories in the shared system temporary directory; the 1 hour age and the two name patterns bound what it can touch (AC-7, AC-10).
- SIGKILL and power loss cannot be handled in the process; only the next run's sweep removes those directories (AC-8).
- CI indicator: `ci.yml` is the workflow of the required check, but it has `contents: read`, no secrets and no deploy, so it is classed below CRITICAL; the lead classifies by script.

## Pre-existing defects

none

## Suggested class

COMPLEX - change to the CI workflow `.github/workflows/ci.yml` that carries the required check, plus test code in two files (CRITICAL considered: no secrets, no deploy, read-only permissions)

## Verification commands

- `npm ci`
- `npm test`
- `npm run build`
- `npm run check:determinism`
- `npm run check:links`
- `npm run test:axe`

## Proofline Status

<!-- PROOFLINE-STATUS:BEGIN:TASK-002 -->
- run: TASK-002
- type: chore
- stage: RUNNING (PLANNING, handoff PLANNED)
- event: run-start
- updated: 2026-11-20T10:52:48Z
- runtime: claude
- session: 8bfe83d7-18e5-44d1-9008-a045f052b9c8
- estimate: size S
- duration: 0 min
<!-- PROOFLINE-STATUS:END:TASK-002 -->

## Completion Report

<!-- COMPLETION-REPORT:BEGIN:TASK-002 -->
# Completion Report: TASK-002

<!-- proofline:summary:begin -->
Changed: CI actions pinned to full commit SHAs with version comments, `verify` job timeout set to 5 minutes, and the test suites now remove their temporary directories on failure, SIGINT and SIGTERM, with a start-of-run sweep for leftovers.
Verify: `npm test`
<!-- proofline:summary:end -->

Written by the lead from run evidence only.

## Implementation Summary

- Delivery: nothing is committed; commit and push each need the user's explicit approval (`commit`, `push`)
- Task: TASK-002 — CI and test hygiene: pinned actions, measured job timeout, no leftover temp directories; class COMPLEX; tier full; branch `proofline/TASK-002-ci-and-test-hygiene`
- Changed: `.github/workflows/ci.yml` (AC-1, AC-2, AC-3, AC-9, AC-10), `scripts/check-workflows.mjs` (AC-1, AC-10), `tests/temp-dirs.mjs` new (AC-4, AC-5, AC-6, AC-7, AC-8, AC-10), `tests/site.test.mjs` (AC-1 to AC-10), `tests/axe.mjs` (AC-5, AC-6, AC-7)
- Knowledge step: `docs/adr/0008-ci-checks-budgets-and-workflow-permissions.md` got a dated amendment; it also records that the script does not check secrets or `snapshot.yml` triggers as the ADR text said earlier.
- AC-8: a process killed with SIGKILL, or a power loss, leaves its `proofline-site-*` and `proofline-axe-*` directories in the system temporary directory until the start-of-run sweep of the next run removes them (the sweep only touches directories older than 1 hour). The same sentence is the header comment of `tests/temp-dirs.mjs`.
- AC-2: `git ls-remote --tags` returned `3d3c42e5aac5ba805825da76410c181273ba90b1` for `actions/checkout` v7.0.1 and `949feb2413d6458794dcd2491c4babbbce0c15c1` for `actions/setup-node` v7.1.0; both equal the pins in `ci.yml`, and both are the newest v7 tags.
- Not changed, as the task says: the `determinism` clean list and Astro's `cacheDir` (observation 2 of the TASK-001 report) stay in that report.

## TDD Evidence

| path | RED | GREEN/FIX | owner |
|---|---|---|---|
| `scripts/check-workflows.mjs` | pin rule tests fail before the rule exists | `npm test` passes | implementer |
| `tests/temp-dirs.mjs` | sweep, signal and failing-run tests fail before the helper exists | `npm test` passes | implementer |
| `tests/site.test.mjs` | covered by the tests above; the later fix passes added fixtures and a socket handshake | `npm test` passes | implementer |
| `.github/workflows/ci.yml` | exempt: workflow configuration, proven by the pin and timeout tests | `npm test` passes | implementer |
| `tests/axe.mjs` | exempt: needs the accessibility run; wiring proven by the start-of-run sweep test | `npm run test:axe` passes | implementer |

## Verification

- VERIFY: PASS (high); commands: `npm ci`, `npm test`, `npm run build`, `npm run check:determinism`, `npm run check:links`, `npm run test:axe`, `npm run check:workflows`. `npm ci` ran in the first VERIFY round; the later rounds did not repeat it because `package.json` and `package-lock.json` did not change.

## Assumptions

- AS-1 (low): the newest v7.x.y tag of each action resolves to a full commit SHA — unverified in the plan register; checked at the review and QA gates against `git ls-remote --tags`.
- AS-2 (medium): a signal sent to the test runner reaches a handler registered inside the file process — unverified in the plan register; the committed signal tests cover it and passed on Node 24.14.1.

## Review Result

| gate | status | confidence | fix round | findings |
|---|---|---|---|---|
| SECRETS | pass | high | 2 | none |
| REVIEW_PLAN | pass | high | 0 | REVIEW_PLAN-1 REVIEW_PLAN-2 REVIEW_PLAN-3 |
| REVIEW_RULES | pass | high | 2 | REVIEW_RULES-1 REVIEW_RULES-2 REVIEW_RULES-3 REVIEW_RULES-4 REVIEW_RULES-5 |
| REVIEW_TESTS | pass | high | 2 | REVIEW_TESTS-1 REVIEW_TESTS-2 REVIEW_TESTS-3 REVIEW_TESTS-4 REVIEW_TESTS-5 REVIEW_TESTS-6 REVIEW_TESTS-7 REVIEW_TESTS-8 |
| SECURITY | pass | medium | 0 | SECURITY-1 SECURITY-2 |
| QA | pass | high | 2 | QA-1 QA-2 QA-3 |
| VERIFY | pass | high | 2 | none |

Fix rounds used: 2 of 2.

- REVIEW_PLAN: REVIEW_PLAN-1 info extra stream error handlers in the helper tie to AC-4; REVIEW_PLAN-2 info AC-2 pins match the remote tags; REVIEW_PLAN-3 info the AC-8 sentence belongs in this report.
- REVIEW_RULES: REVIEW_RULES-1 to REVIEW_RULES-5 info, unproven risks: one-shot signal listeners, a sweep of a live run older than 1 hour, a non-EPIPE stream error, two drivers without a deadline, and the pid taken from the first connection.
- REVIEW_TESTS: REVIEW_TESTS-1 to REVIEW_TESTS-8 info, slow tests that spawn node or a test runner; none is over its budget.
- SECURITY: SECURITY-1 info a recursive delete of another user's stale directory on a shared Linux temporary directory is a suspicion that was not reproduced; SECURITY-2 info the pins were checked at delivery by AC-2.
- QA: QA-1 info the plan grep for `mkdtempSync` matches the guard assertion; QA-2 info `npm ci` was not repeated in the shared tree; QA-3 info the SIGKILL sentence is stated above.

The two flaky interrupted-run tests, the survivors of the sweep name pattern and the two timer-based waits were found by the REVIEW_TESTS, REVIEW_RULES and QA gates in rounds 1 and 2 and fixed; the final gates ran on the final tree.

- REVIEW_PLAN:plan: not reproduced (NOT_RERUN)
- REVIEW_RULES:rules: not reproduced (NOT_RERUN)
- REVIEW_RULES:concurrency: not reproduced (NOT_RERUN)
- REVIEW_TESTS:tests: not reproduced (NOT_RERUN)
- SECURITY:-: not reproduced (NOT_RERUN)
- QA:-: not reproduced (NOT_RERUN)

## QA Result

QA: PASS (high); scenarios 25/25 passed, with the interrupted-run tests repeated 20 times without a hang.

## Execution

Generated from the decision records by `agent.sh report-execution TASK-002` when the report is published; never edited by hand.

| role | focus | runtime | model | effort | signals | note |
|---|---|---|---|---|---|---|
| explorer | - | claude | sonnet | medium | none | agent path |
| architect | - | claude | opus | high | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| implementer | - | codex | gpt-6-sol | high | none | - |
| implementer | - | claude | sonnet | high | none | runtime set by the operator |
| implementer | - | claude | sonnet | high | none | runtime set by the operator |
| reviewer | plan | claude | sonnet | high | none | agent path |
| reviewer | rules | claude | sonnet | high | none | agent path |
| reviewer | concurrency | claude | sonnet | high | none | agent path |
| reviewer | tests | claude | sonnet | high | none | agent path |
| security_reviewer | - | claude | opus | high | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| verifier | - | claude | sonnet | medium | none | agent path |
| reviewer | rules | claude | sonnet | high | none | agent path |
| reviewer | tests | claude | sonnet | high | none | agent path |
| implementer | - | claude | sonnet | high | none | runtime set by the operator |
| reviewer | concurrency | claude | sonnet | high | none | agent path |
| reviewer | tests | claude | opus | high | recent_fail_same_focus | escalated (ESCALATED_MODEL); agent path |
| reviewer | rules | claude | sonnet | high | none | agent path |
| qa | - | claude | sonnet | medium | none | agent path |
| verifier | - | claude | sonnet | medium | none | agent path |
| implementer | - | claude | opus | high | fix_round_2 | runtime set by the operator; escalated (ESCALATED_MODEL) |
| reviewer | concurrency | claude | sonnet | high | fix_round_2,recent_fail_same_focus | agent path |
| reviewer | tests | claude | sonnet | high | fix_round_2,recent_fail_same_focus | agent path |
| qa | - | claude | sonnet | medium | fix_round_2,recent_fail_same_focus | agent path |
| verifier | - | claude | sonnet | medium | fix_round_2 | agent path |

## Known Limitations / Follow-up

- The 5 minute timeout rests on two measured runs (44704593187 in 1 min 6 s, 44704839510 in 47 s); raise it if `ci / verify` turns red on a slow download.
- Observation of the implementer: the local-server tests need a sandbox that allows binding 127.0.0.1; the first implementer runtime (codex) could not, the second (claude) could.
- Several `node --test` driver processes left by earlier gate runs may still be running on the machine; they were not stopped because processes are only stopped by the pid of their starter.

## Execution

<!-- proofline:claims:begin -->
## Verification claims

Generated from the gate records by the publish step and checked again by verify-completion-report; never edited by hand. A gate or check is "ran on the final tree" only when its record carries the fingerprint of the tree being published. No sentence outside this block may claim a visual, browser, screenshot or UI check.

- Gate SECRETS: ran on the final tree: pass (gate SECRETS, record 14)
- Gate REVIEW_PLAN: ran on an EARLIER tree (gate REVIEW_PLAN, record 2; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate REVIEW_RULES: ran on an EARLIER tree (gate REVIEW_RULES, record 6; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Check REVIEW_RULES:concurrency: ran on the final tree: pass (focus REVIEW_RULES:concurrency, record 18)
- Gate REVIEW_TESTS: ran on the final tree: pass (gate REVIEW_TESTS, record 17)
- Gate SECURITY: ran on an EARLIER tree (gate SECURITY, record 4; fix rounds used in the run: 2, as in the Facts block); it is not a check of the final tree
- Gate QA: ran on the final tree: pass (gate QA, record 16)
- Gate VERIFY: ran on the final tree: pass (gate VERIFY, record 15)
- Visual/browser check: not part of this run (no QA:visual gate); no visual, browser or screenshot check is claimed

Final message line (paste it unchanged): Verification claims (from the ledger): 4 of 7 gates hold a record for the final tree; not on the final tree: REVIEW_PLAN (earlier tree), REVIEW_RULES (earlier tree), SECURITY (earlier tree); visual/browser check: not part of this run (no QA:visual gate); no visual, browser or screenshot check is claimed.
Claims-hash: d1fd093882f43fe6bfcf35ed4c415ae4c594f1a08437ca25f5da859cf9185e1a
<!-- proofline:claims:end -->

<!-- proofline:facts:begin -->
## Facts

Generated from the run records by `agent.sh report-facts TASK-002` when the report is published; never edited by hand. Numbers in the text above must match it.

- Class: COMPLEX
- Required gates: 7
- Gate SECRETS: pass; findings: none
- Gate REVIEW_PLAN: pass; findings: REVIEW_PLAN-1 REVIEW_PLAN-2 REVIEW_PLAN-3
- Gate REVIEW_RULES: pass; findings: none
  - Focus REVIEW_RULES:concurrency: pass; findings: REVIEW_RULES-1 REVIEW_RULES-2 REVIEW_RULES-3 REVIEW_RULES-4 REVIEW_RULES-5
- Gate REVIEW_TESTS: pass; findings: REVIEW_TESTS-1 REVIEW_TESTS-2 REVIEW_TESTS-3 REVIEW_TESTS-4 REVIEW_TESTS-5 REVIEW_TESTS-6 REVIEW_TESTS-7 REVIEW_TESTS-8
- Gate SECURITY: pass; findings: SECURITY-1 SECURITY-2
- Gate QA: pass; findings: QA-1 QA-2 QA-3
- Gate VERIFY: pass; findings: none
- Friction notes recorded (A200): proofline_bug 0, user-command 0, user-shell 0
- Knowledge step: KNOWLEDGE_DONE
- Fix rounds: 2 of 2
- Refreezes: 0
- Files changed (task-owned paths): 5
- Worker-evidence run records: total 69, ended pass 40, ended fail 29 (a RED record ends fail on purpose; this is not a count of failing tests)
- Test cases: no record carries the number of individual tests, so no such number is stated here.
<!-- proofline:facts:end -->
<!-- COMPLETION-REPORT:END:TASK-002 -->
